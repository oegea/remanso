//! Directorio de datos. Todo lo que la aplicación escribe vive aquí.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct DataDir {
    root: PathBuf,
}

impl DataDir {
    pub fn resolve(explicit: Option<PathBuf>) -> io::Result<Self> {
        let root = if let Some(p) = explicit {
            p
        } else if let Some(p) = std::env::var_os("REMANSO_DIR") {
            PathBuf::from(p)
        } else if let Some(p) = std::env::var_os("XDG_DATA_HOME") {
            PathBuf::from(p).join("remanso")
        } else if let Some(h) = std::env::var_os("HOME") {
            PathBuf::from(h).join(".local").join("share").join("remanso")
        } else {
            return Err(io::Error::new(io::ErrorKind::NotFound, "no se puede determinar $HOME"));
        };
        fs::create_dir_all(&root)?;
        restrict_permissions(&root);
        Ok(Self { root })
    }

    pub fn at(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
    pub fn db_path(&self) -> PathBuf {
        self.root.join("remanso.db")
    }
    pub fn kdf_path(&self) -> PathBuf {
        self.root.join("kdf.json")
    }
    pub fn prefs_path(&self) -> PathBuf {
        self.root.join("prefs.json")
    }
    pub fn exists(&self) -> bool {
        self.db_path().exists() && self.kdf_path().exists()
    }
}

/// Sólo el propietario puede leer el directorio (0700). En otros sistemas, no-op.
pub fn restrict_permissions(p: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = if p.is_dir() { 0o700 } else { 0o600 };
        let _ = fs::set_permissions(p, fs::Permissions::from_mode(mode));
    }
    #[cfg(not(unix))]
    let _ = p;
}

/// Escritura atómica: fichero temporal en el mismo directorio + rename.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let tmp = path.with_extension("tmp");
    {
        use std::io::Write;
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    restrict_permissions(&tmp);
    fs::rename(&tmp, path)?;
    if let Some(dir) = path.parent() {
        if let Ok(d) = fs::File::open(dir) {
            let _ = d.sync_all();
        }
    }
    Ok(())
}
