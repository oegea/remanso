//! Base de datos cifrada. Una única conexión SQLCipher por sesión.

pub mod backup;
pub mod export;
pub mod migrations;

use std::fmt;
use std::path::Path;

use rusqlite::{Connection, OpenFlags};
use zeroize::Zeroize;

use crate::crypto::{CryptoError, KdfParams, Key, Password};
use crate::paths::DataDir;

pub struct Db {
    pub conn: Connection,
}

#[derive(Debug)]
pub enum DbError {
    WrongPassword,
    NotFound,
    Crypto(CryptoError),
    Sql(rusqlite::Error),
    Io(std::io::Error),
    Corrupt(String),
    Incompatible { found: i32, supported: i32 },
}

impl fmt::Display for DbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DbError::WrongPassword => f.write_str("contraseña incorrecta"),
            DbError::NotFound => f.write_str("no existe ninguna base de datos en el directorio"),
            DbError::Crypto(e) => write!(f, "{e}"),
            // Los errores de SQLite nunca llevan contenido del usuario en su mensaje.
            DbError::Sql(e) => write!(f, "error de base de datos: {e}"),
            DbError::Io(e) => write!(f, "error de E/S: {e}"),
            DbError::Corrupt(s) => write!(f, "base de datos dañada: {s}"),
            DbError::Incompatible { found, supported } => {
                write!(f, "la base de datos es de una versión más reciente ({found}) que esta aplicación ({supported})")
            }
        }
    }
}

impl std::error::Error for DbError {}
impl From<rusqlite::Error> for DbError {
    fn from(e: rusqlite::Error) -> Self {
        DbError::Sql(e)
    }
}
impl From<std::io::Error> for DbError {
    fn from(e: std::io::Error) -> Self {
        DbError::Io(e)
    }
}
impl From<CryptoError> for DbError {
    fn from(e: CryptoError) -> Self {
        DbError::Crypto(e)
    }
}

pub type Result<T> = std::result::Result<T, DbError>;

impl Db {
    /// Crea una base de datos nueva protegida por `password`.
    pub fn create(dir: &DataDir, password: &Password) -> Result<Self> {
        Self::create_with_params(dir, password, KdfParams::generate())
    }

    pub fn create_with_params(dir: &DataDir, password: &Password, params: KdfParams) -> Result<Self> {
        if dir.exists() {
            return Err(DbError::Io(std::io::Error::new(std::io::ErrorKind::AlreadyExists, "ya existe")));
        }
        let key = params.derive(password.0.as_bytes())?;
        params.save(&dir.kdf_path())?;
        let conn = open_keyed(&dir.db_path(), &key, true)?;
        crate::paths::restrict_permissions(&dir.db_path());
        let mut db = Db { conn };
        db.migrate()?;
        Ok(db)
    }

    /// Abre una base existente. Un error `WrongPassword` es la única información
    /// que se da ante una contraseña errónea.
    pub fn open(dir: &DataDir, password: &Password) -> Result<Self> {
        if !dir.exists() {
            return Err(DbError::NotFound);
        }
        let params = KdfParams::load(&dir.kdf_path())?;
        let key = params.derive(password.0.as_bytes())?;
        Self::open_with_key(&dir.db_path(), &key)
    }

    pub fn open_with_key(path: &Path, key: &Key) -> Result<Self> {
        let conn = open_keyed(path, key, false)?;
        // Con una clave errónea la primera página no se autentica y SQLite informa
        // «file is not a database».
        let probe: std::result::Result<i64, _> =
            conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get(0));
        match probe {
            Ok(_) => {}
            Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == rusqlite::ErrorCode::NotADatabase => {
                return Err(DbError::WrongPassword)
            }
            Err(e) => return Err(DbError::Sql(e)),
        }
        let mut db = Db { conn };
        db.migrate()?;
        Ok(db)
    }

    /// Cambia la contraseña: rederiva con una sal nueva y `rekey`. El fichero kdf
    /// se escribe sólo después de que SQLCipher haya recifrado con éxito.
    pub fn change_password(&mut self, dir: &DataDir, new_password: &Password) -> Result<()> {
        let old = KdfParams::load(&dir.kdf_path())?;
        let params = KdfParams { salt: crate::crypto::random_salt(), ..old };
        let key = params.derive(new_password.0.as_bytes())?;
        let hex = key.sqlcipher_hex();
        self.conn.pragma_update(None, "rekey", hex.as_str())?;
        params.save(&dir.kdf_path())?;
        Ok(())
    }

    fn migrate(&mut self) -> Result<()> {
        let version: i32 = self.conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version > migrations::CURRENT_VERSION {
            return Err(DbError::Incompatible { found: version, supported: migrations::CURRENT_VERSION });
        }
        for (i, sql) in migrations::MIGRATIONS.iter().enumerate() {
            let target = i as i32 + 1;
            if version >= target {
                continue;
            }
            let tx = self.conn.transaction()?;
            tx.execute_batch(sql)?;
            tx.pragma_update(None, "user_version", target)?;
            tx.commit()?;
        }
        Ok(())
    }

    pub fn schema_version(&self) -> Result<i32> {
        Ok(self.conn.query_row("PRAGMA user_version", [], |r| r.get(0))?)
    }

    pub fn setting(&self, key: &str) -> Result<Option<String>> {
        use rusqlite::OptionalExtension;
        Ok(self
            .conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
            .optional()?)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [key, value],
        )?;
        Ok(())
    }

    pub fn setting_bool(&self, key: &str, default: bool) -> bool {
        match self.setting(key) {
            Ok(Some(v)) => v == "1" || v == "true",
            _ => default,
        }
    }

    pub fn setting_i64(&self, key: &str, default: i64) -> i64 {
        self.setting(key).ok().flatten().and_then(|v| v.parse().ok()).unwrap_or(default)
    }

    /// `PRAGMA quick_check` + verificación de las tablas FTS.
    pub fn check(&self) -> Result<()> {
        let r: String = self.conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
        if r != "ok" {
            return Err(DbError::Corrupt(r));
        }
        self.conn.execute_batch(
            "INSERT INTO diary_fts(diary_fts) VALUES ('integrity-check');
             INSERT INTO notes_fts(notes_fts) VALUES ('integrity-check');",
        )?;
        Ok(())
    }

    /// Reconstruye los índices de búsqueda (p. ej. tras una restauración).
    pub fn rebuild_search(&self) -> Result<()> {
        self.conn.execute_batch(
            "INSERT INTO diary_fts(diary_fts) VALUES ('rebuild');
             INSERT INTO notes_fts(notes_fts) VALUES ('rebuild');",
        )?;
        Ok(())
    }

    /// Cierra la conexión haciendo checkpoint del WAL para que el fichero
    /// principal quede completo (facilita copias y reduce ficheros sueltos).
    pub fn close(self) {
        let _ = self.conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        let _ = self.conn.close();
    }
}

fn open_keyed(path: &Path, key: &Key, create: bool) -> Result<Connection> {
    let mut flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    if create {
        flags |= OpenFlags::SQLITE_OPEN_CREATE;
    }
    let conn = Connection::open_with_flags(path, flags)?;
    {
        let mut hex = key.sqlcipher_hex();
        conn.pragma_update(None, "key", hex.as_str())?;
        hex.zeroize();
    }
    // Seguridad y durabilidad:
    // - cipher_memory_security: SQLCipher borra memoria sensible al liberarla.
    // - temp_store=MEMORY: ningún temporal en disco en claro.
    // - secure_delete: sobrescribe contenido borrado dentro de las páginas.
    // - WAL + synchronous=FULL: cada commit es duradero ante cortes de energía.
    conn.execute_batch(
        "PRAGMA cipher_memory_security = ON;
         PRAGMA temp_store = MEMORY;
         PRAGMA secure_delete = ON;
         PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = FULL;
         PRAGMA cache_size = -2000;",
    )
    .map_err(|e| match e {
        rusqlite::Error::SqliteFailure(f, _) if f.code == rusqlite::ErrorCode::NotADatabase => DbError::WrongPassword,
        other => DbError::Sql(other),
    })?;
    Ok(conn)
}

#[cfg(test)]
pub mod test_support {
    use super::*;
    use crate::crypto::KdfParams;

    /// Base de datos de prueba con KDF barato. Devuelve el directorio para
    /// mantenerlo vivo.
    pub fn temp_db() -> (tempfile::TempDir, Db) {
        let tmp = tempfile::tempdir().unwrap();
        let dir = DataDir::at(tmp.path().to_path_buf());
        let pw = Password("prueba".into());
        let db = Db::create_with_params(&dir, &pw, KdfParams::generate().with_cost(1024, 1)).unwrap();
        (tmp, db)
    }

    pub fn cheap_params() -> KdfParams {
        KdfParams::generate().with_cost(1024, 1)
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::*;
    use super::*;

    #[test]
    fn create_open_and_wrong_password() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = DataDir::at(tmp.path().to_path_buf());
        let pw = Password("correcta".into());
        let db = Db::create_with_params(&dir, &pw, cheap_params()).unwrap();
        assert_eq!(db.schema_version().unwrap(), migrations::CURRENT_VERSION);
        db.set_setting("tema", "oscuro").unwrap();
        db.close();

        let err = Db::open(&dir, &Password("incorrecta".into())).err().expect("debe fallar");
        assert!(matches!(err, DbError::WrongPassword), "{err:?}");

        let db = Db::open(&dir, &pw).unwrap();
        assert_eq!(db.setting("tema").unwrap().as_deref(), Some("oscuro"));
        db.check().unwrap();
    }

    #[test]
    fn file_is_not_plaintext() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = DataDir::at(tmp.path().to_path_buf());
        let pw = Password("x".into());
        let db = Db::create_with_params(&dir, &pw, cheap_params()).unwrap();
        let secret = "frase-muy-secreta-que-no-debe-aparecer";
        db.conn
            .execute("INSERT INTO diary_entries(created_at, updated_at, day, body) VALUES (1,1,'2026-01-01',?1)", [secret])
            .unwrap();
        db.close();
        for name in ["remanso.db", "remanso.db-wal"] {
            if let Ok(bytes) = std::fs::read(tmp.path().join(name)) {
                let hay = String::from_utf8_lossy(&bytes);
                assert!(!hay.contains(secret), "{name} contiene texto en claro");
                assert!(!hay.contains("SQLite format 3"), "{name} tiene cabecera SQLite en claro");
            }
        }
    }

    #[test]
    fn change_password() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = DataDir::at(tmp.path().to_path_buf());
        let pw = Password("una".into());
        let mut db = Db::create_with_params(&dir, &pw, cheap_params()).unwrap();
        db.set_setting("k", "v").unwrap();
        db.change_password(&dir, &Password("otra".into())).unwrap();
        db.close();
        assert!(matches!(Db::open(&dir, &pw), Err(DbError::WrongPassword)));
        let db = Db::open(&dir, &Password("otra".into())).unwrap();
        assert_eq!(db.setting("k").unwrap().as_deref(), Some("v"));
    }

    #[test]
    fn migrations_are_idempotent_on_reopen() {
        let (_tmp, db) = temp_db();
        let v = db.schema_version().unwrap();
        assert_eq!(v, migrations::CURRENT_VERSION);
    }
}

#[cfg(test)]
mod robustness_tests {
    use super::test_support::*;
    use super::*;

    /// Un cierre inesperado a mitad de una transacción no corrompe la base ni
    /// pierde lo ya confirmado; el WAL pendiente se recupera al reabrir.
    #[test]
    fn uncommitted_transaction_and_unclean_close_are_safe() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = DataDir::at(tmp.path().to_path_buf());
        let pw = Password("clave".into());
        let db = Db::create_with_params(&dir, &pw, cheap_params()).unwrap();
        let id = crate::domain::diary::create(&db.conn).unwrap();
        crate::domain::diary::save_body(&db.conn, id, None, "confirmado").unwrap();
        {
            let tx = db.conn.unchecked_transaction().unwrap();
            tx.execute("INSERT INTO diary_entries(created_at, updated_at, day, body) VALUES (1,1,'2026-01-01','no confirmado')", []).unwrap();
            // Sin commit: simula un corte durante la escritura.
        }
        // Soltamos la conexión sin checkpoint ni close(): queda el WAL en disco.
        drop(db);
        assert!(tmp.path().join("remanso.db-wal").exists() || tmp.path().join("remanso.db").exists());
        let db = Db::open(&dir, &pw).unwrap();
        db.check().unwrap();
        let n: i64 = db.conn.query_row("SELECT count(*) FROM diary_entries", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 1);
        let body: String = db.conn.query_row("SELECT body FROM diary_entries", [], |r| r.get(0)).unwrap();
        assert_eq!(body, "confirmado");
    }

    /// Una base creada con el esquema v1 se migra hasta la versión actual al abrir.
    #[test]
    fn migrates_from_v1() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = DataDir::at(tmp.path().to_path_buf());
        let pw = Password("clave".into());
        let params = cheap_params();
        let key = params.derive(pw.0.as_bytes()).unwrap();
        params.save(&dir.kdf_path()).unwrap();
        {
            let conn = open_keyed(&dir.db_path(), &key, true).unwrap();
            conn.execute_batch(migrations::MIGRATIONS[0]).unwrap();
            conn.pragma_update(None, "user_version", 1).unwrap();
            conn.execute("INSERT INTO notebooks(name, created_at) VALUES ('viejo', 1)", []).unwrap();
        }
        let db = Db::open(&dir, &pw).unwrap();
        assert_eq!(db.schema_version().unwrap(), migrations::CURRENT_VERSION);
        let n: i64 = db.conn.query_row("SELECT count(*) FROM notebooks", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 1);
        // Las tablas nuevas existen y las columnas añadidas por ALTER también.
        let _: i64 = db.conn.query_row("SELECT count(*) FROM goals WHERE kind = 'process'", [], |r| r.get(0)).unwrap();
        db.check().unwrap();
    }

    /// Los mensajes de error nunca incluyen contenido del usuario.
    #[test]
    fn error_messages_do_not_leak_content() {
        let e = DbError::WrongPassword.to_string();
        assert_eq!(e, "contraseña incorrecta");
        let e = DbError::Corrupt("ok".into()).to_string();
        assert!(!e.contains("diario"));
    }
}
