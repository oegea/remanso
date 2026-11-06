//! Remanso: diario, cuadernos, tareas, objetivos y cambio conductual.
//! Personal, offline, cifrado, ligero.
//!
//! Organización del código:
//! - `cli`         argumentos de línea de órdenes (sin dependencias).
//! - `paths`       localización del directorio de datos.
//! - `prefs`       preferencias no sensibles (tema, bloqueo) en texto plano.
//! - `crypto`      derivación de clave (Argon2id) y manejo seguro de secretos.
//! - `storage`     base de datos cifrada (SQLCipher), migraciones, copias, exportación.
//! - `domain`      modelos y repositorios de cada módulo funcional.
//! - `analysis`    cálculos deterministas (tendencias, calendarios, patrones).
//! - `interventions` modelo declarativo de técnicas conductuales.
//! - `ui`          tema, glifos, widgets (editor, listas, diálogos).
//! - `app`         máquina de estados de pantallas y bucle de eventos.
//! - `text`        todos los textos visibles, en español, centralizados.

mod analysis;
mod app;
mod cli;
mod crypto;
mod dates;
mod domain;
mod interventions;
mod paths;
mod prefs;
mod storage;
mod text;
mod ui;

use std::process::ExitCode;

/// En Linux: sin volcados de memoria (`RLIMIT_CORE = 0`) y proceso no
/// «dumpable» (`PR_SET_DUMPABLE = 0`), lo que además impide que otro proceso del
/// mismo usuario lea `/proc/<pid>/mem` cuando Yama está en 0. Mejor esfuerzo:
/// los errores se ignoran y no cambian el comportamiento.
fn harden_process() {
    #[cfg(target_os = "linux")]
    unsafe {
        let lim = libc::rlimit { rlim_cur: 0, rlim_max: 0 };
        let _ = libc::setrlimit(libc::RLIMIT_CORE, &lim);
        let _ = libc::prctl(libc::PR_SET_DUMPABLE, 0, 0, 0, 0);
    }
}

fn main() -> ExitCode {
    harden_process();
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = match cli::parse(&args) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("{e}\n\n{}", cli::USAGE);
            return ExitCode::from(2);
        }
    };
    match cli::run(cmd) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            // Los errores nunca incluyen contenido del usuario; sólo la causa técnica.
            eprintln!("remanso: {e}");
            ExitCode::FAILURE
        }
    }
}
