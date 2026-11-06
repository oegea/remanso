//! Preferencias no sensibles, legibles antes de desbloquear (necesarias para
//! dibujar la pantalla de bloqueo). Nunca contienen datos del usuario.

use serde::{Deserialize, Serialize};

use crate::paths::{write_atomic, DataDir};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    Dark,
    Light,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Prefs {
    pub theme: Theme,
    pub ascii: bool,
    /// Minutos de inactividad antes de bloquear. 0 = nunca.
    pub lock_after_minutes: u32,
    /// Mostrar asteriscos al escribir la contraseña.
    pub password_feedback: bool,
}

impl Default for Prefs {
    fn default() -> Self {
        Self { theme: Theme::Dark, ascii: false, lock_after_minutes: 10, password_feedback: true }
    }
}

impl Prefs {
    pub fn load(dir: &DataDir) -> Self {
        std::fs::read(dir.prefs_path())
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, dir: &DataDir) -> std::io::Result<()> {
        let json = serde_json::to_vec_pretty(self).expect("prefs serializables");
        write_atomic(&dir.prefs_path(), &json)
    }
}
