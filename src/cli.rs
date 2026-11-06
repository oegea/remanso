//! Argumentos de línea de órdenes. Hecho a mano: no merece una dependencia.

use std::path::PathBuf;

use crate::paths::DataDir;
use crate::prefs::Prefs;

pub const USAGE: &str = "\
remanso [opciones]

Opciones:
  --dir RUTA        Directorio de datos (por defecto $REMANSO_DIR o
                    $XDG_DATA_HOME/remanso).
  --ascii           Usar sólo caracteres ASCII (consolas sin Unicode).
  --light | --dark  Forzar tema claro u oscuro para esta sesión.
  --backup RUTA     Crear una copia de seguridad cifrada y salir.
  --restore RUTA    Restaurar una copia de seguridad y salir.
  --export DIR      Exportar todo en texto plano (Markdown + JSON) y salir.
                    ATENCIÓN: el resultado NO está cifrado.
  --check           Verificar integridad de la base de datos y salir.
  --bench           Medir arranque, derivación de clave y consultas y salir.
  --version         Mostrar la versión.
  --help            Mostrar esta ayuda.

Ninguna opción acepta la contraseña: siempre se pide de forma interactiva
para que no quede en el historial del intérprete.";

#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Run,
    Backup(PathBuf),
    Restore(PathBuf),
    Export(PathBuf),
    Check,
    Bench,
    Version,
    Help,
}

#[derive(Debug, Clone)]
pub struct Command {
    pub action: Action,
    pub dir: Option<PathBuf>,
    pub ascii: Option<bool>,
    pub theme: Option<crate::prefs::Theme>,
}

pub fn parse(args: &[String]) -> Result<Command, String> {
    let mut cmd = Command { action: Action::Run, dir: None, ascii: None, theme: None };
    let mut it = args.iter();
    while let Some(a) = it.next() {
        let mut need = |name: &str| -> Result<PathBuf, String> {
            it.next().map(PathBuf::from).ok_or_else(|| format!("{name} necesita una ruta"))
        };
        match a.as_str() {
            "--dir" => cmd.dir = Some(need("--dir")?),
            "--ascii" => cmd.ascii = Some(true),
            "--light" => cmd.theme = Some(crate::prefs::Theme::Light),
            "--dark" => cmd.theme = Some(crate::prefs::Theme::Dark),
            "--backup" => cmd.action = Action::Backup(need("--backup")?),
            "--restore" => cmd.action = Action::Restore(need("--restore")?),
            "--export" => cmd.action = Action::Export(need("--export")?),
            "--check" => cmd.action = Action::Check,
            "--bench" => cmd.action = Action::Bench,
            "--version" | "-V" => cmd.action = Action::Version,
            "--help" | "-h" => cmd.action = Action::Help,
            other => return Err(format!("opción desconocida: {other}")),
        }
    }
    Ok(cmd)
}

pub fn run(cmd: Command) -> Result<(), Box<dyn std::error::Error>> {
    match cmd.action {
        Action::Help => {
            println!("{USAGE}");
            return Ok(());
        }
        Action::Version => {
            println!("remanso {}", env!("CARGO_PKG_VERSION"));
            return Ok(());
        }
        _ => {}
    }
    let dir = DataDir::resolve(cmd.dir)?;
    let mut prefs = Prefs::load(&dir);
    if let Some(a) = cmd.ascii {
        prefs.ascii = a;
    }
    if let Some(t) = cmd.theme {
        prefs.theme = t;
    }
    match cmd.action {
        Action::Run => crate::app::run(dir, prefs),
        Action::Backup(p) => crate::storage::backup::cli_backup(&dir, &p),
        Action::Restore(p) => crate::storage::backup::cli_restore(&dir, &p),
        Action::Export(p) => crate::storage::export::cli_export(&dir, &p),
        Action::Check => crate::storage::backup::cli_check(&dir),
        Action::Bench => crate::app::bench::run(&dir),
        Action::Help | Action::Version => unreachable!(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn parses_basic() {
        let c = parse(&s(&["--ascii", "--dir", "/tmp/x", "--check"])).unwrap();
        assert_eq!(c.ascii, Some(true));
        assert_eq!(c.dir, Some(PathBuf::from("/tmp/x")));
        assert_eq!(c.action, Action::Check);
    }

    #[test]
    fn rejects_unknown_and_missing() {
        assert!(parse(&s(&["--nope"])).is_err());
        assert!(parse(&s(&["--backup"])).is_err());
    }

    #[test]
    fn never_accepts_password_flag() {
        assert!(parse(&s(&["--password", "x"])).is_err());
    }
}

/// Lee una contraseña del terminal sin eco. Nunca pasa por argumentos ni por
/// variables de entorno.
pub fn prompt_password(prompt: &str) -> std::io::Result<crate::crypto::Password> {
    use crossterm::event::{self, Event, KeyCode, KeyModifiers};
    use std::io::Write;
    let mut out = std::io::stderr();
    write!(out, "{prompt}")?;
    out.flush()?;
    crossterm::terminal::enable_raw_mode()?;
    let mut pw = crate::crypto::Password::default();
    let result = loop {
        match event::read()? {
            Event::Key(k) => match k.code {
                KeyCode::Enter => break Ok(()),
                KeyCode::Esc => break Err(std::io::Error::new(std::io::ErrorKind::Interrupted, "cancelado")),
                KeyCode::Char('c') if k.modifiers.contains(KeyModifiers::CONTROL) => {
                    break Err(std::io::Error::new(std::io::ErrorKind::Interrupted, "cancelado"))
                }
                KeyCode::Backspace => {
                    pw.0.pop();
                }
                KeyCode::Char(c) if !k.modifiers.contains(KeyModifiers::CONTROL) => pw.0.push(c),
                _ => {}
            },
            _ => {}
        }
    };
    crossterm::terminal::disable_raw_mode()?;
    writeln!(out)?;
    result.map(|_| pw)
}

pub fn confirm(prompt: &str) -> std::io::Result<bool> {
    use std::io::{BufRead, Write};
    let mut out = std::io::stderr();
    write!(out, "{prompt} [s/N] ")?;
    out.flush()?;
    let mut line = String::new();
    std::io::stdin().lock().read_line(&mut line)?;
    let l = line.trim().to_lowercase();
    Ok(l == "s" || l == "sí" || l == "si")
}
