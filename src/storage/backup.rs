//! Copias de seguridad cifradas y restauración.
//!
//! Una copia es un directorio con tres ficheros:
//!   remanso.db     base de datos SQLCipher (misma clave que la original)
//!   kdf.json       sal y parámetros Argon2id para rederivar la clave
//!   manifest.json  versión de esquema, fecha, tamaño y verificación
//!
//! Se genera con `sqlcipher_export`, el mecanismo documentado de SQLCipher, de
//! modo que la copia puede abrirse con la herramienta `sqlcipher` de línea de
//! órdenes sin esta aplicación (docs/security/recovery.md).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::{Db, DbError, Result};
use crate::crypto::{KdfParams, Key, Password};
use crate::paths::DataDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct Manifest {
    pub format: u32,
    pub app_version: String,
    pub schema_version: i32,
    pub created_at: i64,
    pub db_bytes: u64,
}

pub fn backup_to(db: &Db, dir: &DataDir, dest: &Path) -> Result<Manifest> {
    if dest.exists() && dest.read_dir().map(|mut d| d.next().is_some()).unwrap_or(true) {
        return Err(DbError::Io(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            "el destino existe y no está vacío",
        )));
    }
    std::fs::create_dir_all(dest)?;
    crate::paths::restrict_permissions(dest);
    let db_dest = dest.join("remanso.db");
    let kdf = KdfParams::load(&dir.kdf_path())?;
    // El fichero adjunto se cifra con la misma clave en uso (SQLCipher reutiliza la
    // clave de la conexión principal cuando KEY se omite y la base está vacía).
    let path_str = db_dest.to_string_lossy().to_string();
    db.conn.execute("ATTACH DATABASE ?1 AS backup", [path_str.as_str()])?;
    // sqlcipher_export copia esquema y datos pero no `user_version`: lo fijamos.
    let version = db.schema_version()?;
    let r = db
        .conn
        .execute_batch(&format!("SELECT sqlcipher_export('backup'); PRAGMA backup.user_version = {version};"));
    // Verificación de la copia antes de soltarla (no requiere rederivar la clave).
    let check: std::result::Result<String, _> = db.conn.query_row("PRAGMA backup.quick_check", [], |r| r.get(0));
    db.conn.execute_batch("DETACH DATABASE backup;")?;
    r?;
    match check {
        Ok(s) if s == "ok" => {}
        Ok(s) => return Err(DbError::Corrupt(format!("la copia no pasa quick_check: {s}"))),
        Err(e) => return Err(DbError::Sql(e)),
    }
    crate::paths::restrict_permissions(&db_dest);
    kdf.save(&dest.join("kdf.json"))?;
    let manifest = Manifest {
        format: 1,
        app_version: env!("CARGO_PKG_VERSION").into(),
        schema_version: db.schema_version()?,
        created_at: crate::dates::now_ts(),
        db_bytes: std::fs::metadata(&db_dest)?.len(),
    };
    crate::paths::write_atomic(&dest.join("manifest.json"), &serde_json::to_vec_pretty(&manifest).unwrap())?;
    Ok(manifest)
}

/// Comprueba que la copia se abre con la clave y pasa `quick_check`.
pub fn verify_backup(src: &Path, key: &Key) -> Result<i32> {
    let db = Db::open_with_key(&src.join("remanso.db"), key)?;
    db.check()?;
    let v = db.schema_version()?;
    db.close();
    Ok(v)
}

/// Restaura una copia sobre el directorio de datos. La base anterior, si
/// existe, se renombra a `remanso.db.anterior` (no se borra nada).
pub fn restore_from(src: &Path, dir: &DataDir, password: &Password) -> Result<()> {
    let kdf = KdfParams::load(&src.join("kdf.json"))?;
    let key = kdf.derive(password.0.as_bytes())?;
    verify_backup(src, &key)?;
    let db_path = dir.db_path();
    if db_path.exists() {
        std::fs::rename(&db_path, dir.root().join("remanso.db.anterior"))?;
        let _ = std::fs::remove_file(dir.root().join("remanso.db-wal"));
        let _ = std::fs::remove_file(dir.root().join("remanso.db-shm"));
    }
    if dir.kdf_path().exists() {
        std::fs::rename(dir.kdf_path(), dir.root().join("kdf.json.anterior"))?;
    }
    std::fs::copy(src.join("remanso.db"), &db_path)?;
    std::fs::copy(src.join("kdf.json"), dir.kdf_path())?;
    crate::paths::restrict_permissions(&db_path);
    crate::paths::restrict_permissions(&dir.kdf_path());
    let db = Db::open_with_key(&db_path, &key)?;
    db.rebuild_search()?;
    db.close();
    Ok(())
}

/// Nombre de copia por defecto: `remanso-AAAA-MM-DD-HHMM`.
pub fn default_backup_name() -> String {
    let now = crate::dates::now_local();
    now.format("remanso-%Y-%m-%d-%H%M").to_string()
}

pub fn list_backups(root: &Path) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = std::fs::read_dir(root)
        .map(|rd| {
            rd.filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| p.join("manifest.json").exists() && p.join("remanso.db").exists())
                .collect()
        })
        .unwrap_or_default();
    v.sort();
    v
}

/// Rotación: conserva las `keep` copias más recientes de `root`.
pub fn rotate(root: &Path, keep: usize) -> std::io::Result<Vec<PathBuf>> {
    let list = list_backups(root);
    let mut removed = vec![];
    if list.len() > keep {
        for p in &list[..list.len() - keep] {
            std::fs::remove_dir_all(p)?;
            removed.push(p.clone());
        }
    }
    Ok(removed)
}

// ---- Órdenes de línea de comandos -------------------------------------------

pub fn cli_backup(dir: &DataDir, dest: &Path) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let pw = crate::cli::prompt_password("Contraseña: ")?;
    let db = Db::open(dir, &pw)?;
    let m = backup_to(&db, dir, dest)?;
    let kdf = KdfParams::load(&dir.kdf_path())?;
    let key = kdf.derive(pw.0.as_bytes())?;
    verify_backup(dest, &key)?;
    eprintln!("Copia creada y verificada en {} ({} bytes, esquema v{}).", dest.display(), m.db_bytes, m.schema_version);
    Ok(())
}

pub fn cli_restore(dir: &DataDir, src: &Path) -> std::result::Result<(), Box<dyn std::error::Error>> {
    if dir.exists() && !crate::cli::confirm("Ya existen datos. Se conservarán como remanso.db.anterior. ¿Continuar?")? {
        return Ok(());
    }
    let pw = crate::cli::prompt_password("Contraseña de la copia: ")?;
    restore_from(src, dir, &pw)?;
    eprintln!("Copia restaurada en {}.", dir.root().display());
    Ok(())
}

pub fn cli_check(dir: &DataDir) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let pw = crate::cli::prompt_password("Contraseña: ")?;
    let db = Db::open(dir, &pw)?;
    db.check()?;
    eprintln!("Integridad correcta (esquema v{}).", db.schema_version()?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::*;

    #[test]
    fn backup_restore_roundtrip() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = DataDir::at(tmp.path().join("data"));
        std::fs::create_dir_all(dir.root()).unwrap();
        let pw = Password("clave".into());
        let db = Db::create_with_params(&dir, &pw, cheap_params()).unwrap();
        db.conn
            .execute(
                "INSERT INTO diary_entries(created_at, updated_at, day, body) VALUES (1,1,'2026-01-01','hola mundo')",
                [],
            )
            .unwrap();
        let dest = tmp.path().join("copia");
        let m = backup_to(&db, &dir, &dest).unwrap();
        assert_eq!(m.schema_version, crate::storage::migrations::CURRENT_VERSION);
        db.close();

        // La copia es cifrada: no contiene el texto.
        let bytes = std::fs::read(dest.join("remanso.db")).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("hola mundo"));

        // Verificación con la clave correcta.
        let kdf = KdfParams::load(&dest.join("kdf.json")).unwrap();
        let key = kdf.derive(b"clave").unwrap();
        verify_backup(&dest, &key).unwrap();

        // Restaurar sobre un directorio nuevo.
        let dir2 = DataDir::at(tmp.path().join("data2"));
        std::fs::create_dir_all(dir2.root()).unwrap();
        assert!(matches!(restore_from(&dest, &dir2, &Password("mal".into())), Err(DbError::WrongPassword)));
        restore_from(&dest, &dir2, &pw).unwrap();
        let db2 = Db::open(&dir2, &pw).unwrap();
        let body: String = db2.conn.query_row("SELECT body FROM diary_entries", [], |r| r.get(0)).unwrap();
        assert_eq!(body, "hola mundo");
        let n: i64 = db2
            .conn
            .query_row("SELECT count(*) FROM diary_fts WHERE diary_fts MATCH 'mundo'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn refuses_non_empty_destination() {
        let (tmp, db) = temp_db();
        let dest = tmp.path();
        assert!(backup_to(&db, &DataDir::at(tmp.path().to_path_buf()), dest).is_err());
    }

    #[test]
    fn rotation_keeps_newest() {
        let tmp = tempfile::tempdir().unwrap();
        for n in ["remanso-2026-01-01-0900", "remanso-2026-01-02-0900", "remanso-2026-01-03-0900"] {
            let p = tmp.path().join(n);
            std::fs::create_dir_all(&p).unwrap();
            std::fs::write(p.join("manifest.json"), "{}").unwrap();
            std::fs::write(p.join("remanso.db"), "").unwrap();
        }
        let removed = rotate(tmp.path(), 2).unwrap();
        assert_eq!(removed.len(), 1);
        assert!(removed[0].ends_with("remanso-2026-01-01-0900"));
        assert_eq!(list_backups(tmp.path()).len(), 2);
    }
}
