//! Derivación de la clave de cifrado a partir de la contraseña maestra.
//!
//! Esquema: Argon2id(contraseña, sal) → 32 bytes → clave «raw» de SQLCipher
//! (`PRAGMA key = "x'…'"`). SQLCipher cifra cada página con AES-256-CBC y la
//! autentica con HMAC-SHA512. No se implementa criptografía propia: sólo se
//! combinan primitivas auditadas (crate `argon2` de RustCrypto, SQLCipher/OpenSSL).
//!
//! La sal y los parámetros se guardan en `kdf.json` en texto plano: no son
//! secretos. La sal es una cadena imprimible para que la clave pueda rederivarse
//! con la herramienta `argon2` de línea de órdenes sin esta aplicación
//! (véase docs/security/recovery.md).

use std::fmt;
use std::io::Read;
use std::path::Path;

use argon2::{Algorithm, Argon2, Params, Version};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const KEY_LEN: usize = 32;

/// Parámetros por defecto (medidos en docs/performance.md): memoria 32 MiB,
/// 3 pasadas, 1 hilo. Están entre la recomendación «baja memoria» de RFC 9106
/// (64 MiB, t=3) y la de OWASP (19 MiB, t=2). Potencias de dos para que la
/// herramienta `argon2` de línea de órdenes pueda rederivar la clave
/// (docs/security/recovery.md). Cambiarlos exige rederivar y `rekey`; todavía
/// no hay opción en Ajustes para ello.
pub const DEFAULT_M_KIB: u32 = 32 * 1024;
pub const DEFAULT_T: u32 = 3;
pub const DEFAULT_P: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KdfParams {
    pub version: u32,
    pub algorithm: String,
    /// Sal como texto imprimible; sus bytes UTF-8 son la sal real.
    pub salt: String,
    pub m_kib: u32,
    pub t: u32,
    pub p: u32,
    pub key_len: usize,
}

impl KdfParams {
    pub fn generate() -> Self {
        Self {
            version: 1,
            algorithm: "argon2id".into(),
            salt: random_salt(),
            m_kib: DEFAULT_M_KIB,
            t: DEFAULT_T,
            p: DEFAULT_P,
            key_len: KEY_LEN,
        }
    }

    pub fn with_cost(mut self, m_kib: u32, t: u32) -> Self {
        self.m_kib = m_kib;
        self.t = t;
        self
    }

    pub fn load(path: &Path) -> Result<Self, CryptoError> {
        let bytes = std::fs::read(path).map_err(|_| CryptoError::MissingKdf)?;
        let p: Self = serde_json::from_slice(&bytes).map_err(|_| CryptoError::CorruptKdf)?;
        if p.algorithm != "argon2id" || p.key_len != KEY_LEN {
            return Err(CryptoError::Unsupported);
        }
        Ok(p)
    }

    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        let json = serde_json::to_vec_pretty(self).expect("kdf serializable");
        crate::paths::write_atomic(path, &json)
    }

    /// Deriva la clave. Operación deliberadamente costosa (segundos en una CPU
    /// antigua): es lo que protege el fichero frente a fuerza bruta.
    pub fn derive(&self, password: &[u8]) -> Result<Key, CryptoError> {
        let params = Params::new(self.m_kib, self.t, self.p, Some(KEY_LEN)).map_err(|_| CryptoError::Unsupported)?;
        let a = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        let mut key = Key([0u8; KEY_LEN]);
        a.hash_password_into(password, self.salt.as_bytes(), &mut key.0).map_err(|_| CryptoError::Derivation)?;
        Ok(key)
    }
}

/// Clave de 32 bytes que se borra de memoria al destruirse.
#[derive(Zeroize, ZeroizeOnDrop, Clone)]
pub struct Key(pub [u8; KEY_LEN]);

impl Key {
    /// `x'…'` para `PRAGMA key`. El `String` resultante también debe borrarse
    /// tras usarse; `storage` lo hace.
    pub fn sqlcipher_hex(&self) -> zeroize::Zeroizing<String> {
        let mut s = String::with_capacity(KEY_LEN * 2 + 3);
        s.push_str("x'");
        for b in self.0 {
            s.push_str(&format!("{b:02x}"));
        }
        s.push('\'');
        zeroize::Zeroizing::new(s)
    }
}

impl fmt::Debug for Key {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Key(<oculta>)")
    }
}

/// Contraseña en memoria con borrado al destruirse.
#[derive(Zeroize, ZeroizeOnDrop, Default, Clone)]
pub struct Password(pub String);

impl fmt::Debug for Password {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Password(<oculta>)")
    }
}

#[derive(Debug)]
pub enum CryptoError {
    MissingKdf,
    CorruptKdf,
    Unsupported,
    Derivation,
    Random,
}

impl fmt::Display for CryptoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            CryptoError::MissingKdf => "falta el fichero kdf.json junto a la base de datos",
            CryptoError::CorruptKdf => "kdf.json ilegible",
            CryptoError::Unsupported => "parámetros de derivación no soportados",
            CryptoError::Derivation => "error al derivar la clave",
            CryptoError::Random => "no se pudo obtener aleatoriedad del sistema",
        };
        f.write_str(s)
    }
}

impl std::error::Error for CryptoError {}

/// Bytes aleatorios del sistema (`/dev/urandom`). Sin crates adicionales.
pub fn random_bytes(n: usize) -> Result<Vec<u8>, CryptoError> {
    let mut buf = vec![0u8; n];
    let mut f = std::fs::File::open("/dev/urandom").map_err(|_| CryptoError::Random)?;
    f.read_exact(&mut buf).map_err(|_| CryptoError::Random)?;
    Ok(buf)
}

const SALT_ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/// 24 caracteres alfanuméricos ≈ 143 bits de entropía. Imprimible a propósito.
pub fn random_salt() -> String {
    let bytes = random_bytes(48).expect("aleatoriedad del sistema");
    // Rechazo de sesgo: 62 símbolos; descartamos valores ≥ 248 (4 × 62).
    let mut out = String::with_capacity(24);
    for b in bytes {
        if out.len() == 24 {
            break;
        }
        if b < 248 {
            out.push(SALT_ALPHABET[(b % 62) as usize] as char);
        }
    }
    while out.len() < 24 {
        out.push_str(&random_salt()[..24 - out.len()]);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_is_deterministic_and_salt_sensitive() {
        let p = KdfParams::generate().with_cost(1024, 1);
        let k1 = p.derive(b"abc").unwrap();
        let k2 = p.derive(b"abc").unwrap();
        assert_eq!(k1.0, k2.0);
        let p2 = KdfParams::generate().with_cost(1024, 1);
        assert_ne!(p.salt, p2.salt);
        let k3 = p2.derive(b"abc").unwrap();
        assert_ne!(k1.0, k3.0);
        assert_ne!(p.derive(b"abd").unwrap().0, k1.0);
    }

    #[test]
    fn hex_format() {
        let k = Key([0xab; 32]);
        let h = k.sqlcipher_hex();
        assert!(h.starts_with("x'") && h.ends_with('\'') && h.len() == 67);
    }

    #[test]
    fn salt_is_printable() {
        let s = random_salt();
        assert_eq!(s.len(), 24);
        assert!(s.bytes().all(|b| b.is_ascii_alphanumeric()));
    }

    #[test]
    fn kdf_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("kdf.json");
        let p = KdfParams::generate();
        p.save(&path).unwrap();
        assert_eq!(KdfParams::load(&path).unwrap(), p);
    }
}
