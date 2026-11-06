//! `remanso --bench`: mediciones reproducibles de arranque, derivación de clave y
//! consultas. Usa un directorio temporal; no toca los datos reales.

use std::time::Instant;

use crate::crypto::{KdfParams, Password};
use crate::domain::{diary, notebooks, search};
use crate::paths::DataDir;
use crate::storage::Db;

pub fn run(_dir: &DataDir) -> Result<(), Box<dyn std::error::Error>> {
    let t_start = Instant::now();
    let tmp = std::env::temp_dir().join(format!("remanso-bench-{}", std::process::id()));
    std::fs::create_dir_all(&tmp)?;
    let dir = DataDir::at(tmp.clone());
    let pw = Password("contraseña de prueba".into());

    for (m, t) in [(19 * 1024, 2), (32 * 1024, 3), (64 * 1024, 3)] {
        let p = KdfParams::generate().with_cost(m, t);
        let t0 = Instant::now();
        let _k = p.derive(pw.0.as_bytes())?;
        println!("argon2id m={:>2} MiB t={t}: {:>6} ms", m / 1024, t0.elapsed().as_millis());
    }

    let t0 = Instant::now();
    let db = Db::create_with_params(&dir, &pw, KdfParams::generate().with_cost(32 * 1024, 3))?;
    println!("crear base + migraciones: {} ms", t0.elapsed().as_millis());

    let t0 = Instant::now();
    let tx = db.conn.unchecked_transaction()?;
    for i in 0..2000 {
        let id = diary::create(&db.conn)?;
        diary::save_body(&db.conn, id, None, &format!("Entrada {i}. Hoy he caminado media hora y he leído veinte páginas. Pensamiento recurrente número {i}."))?;
    }
    let nb = notebooks::create_notebook(&db.conn, "Pruebas")?;
    for i in 0..3000 {
        let id = notebooks::create_note(&db.conn, nb, &format!("Nota {i}"))?;
        notebooks::save_note(&db.conn, id, &format!("Nota {i}"), &format!("Cuerpo de la nota {i} con palabras variadas: montaña, río, sueño, proyecto {}.", i % 97))?;
    }
    tx.commit()?;
    println!("insertar 2000 entradas + 3000 notas: {} ms", t0.elapsed().as_millis());

    let t0 = Instant::now();
    let l = diary::list(&db.conn, 0, 5000)?;
    println!("listar diario ({}): {} ms", l.len(), t0.elapsed().as_millis());

    let t0 = Instant::now();
    let hits = search::search_all(&db.conn, "sueño proyecto 42", 60)?;
    println!("búsqueda FTS ({} resultados): {} µs", hits.len(), t0.elapsed().as_micros());

    let t0 = Instant::now();
    let big: String = (0..3000).map(|i| format!("Línea {i} de una nota muy larga con texto suficiente para ajustar.\n")).collect();
    let id = notebooks::create_note(&db.conn, nb, "Grande")?;
    notebooks::save_note(&db.conn, id, "Grande", &big)?;
    let n = notebooks::get_note(&db.conn, id)?.unwrap();
    let mut ed = crate::ui::editor::Editor::from_text(&n.body);
    let t1 = Instant::now();
    let rows: usize = (0..ed.line_count()).map(|r| ed.segs(r).len()).sum();
    ed.move_to_end();
    println!("abrir nota de {} líneas: {} ms (ajuste de {} filas: {} ms)", n.body.lines().count(), t0.elapsed().as_millis(), rows, t1.elapsed().as_millis());

    let t0 = Instant::now();
    db.check()?;
    println!("quick_check + fts integrity: {} ms", t0.elapsed().as_millis());
    db.close();

    let t0 = Instant::now();
    let db = Db::open(&dir, &pw)?;
    println!("abrir base existente (incluye Argon2id 32 MiB): {} ms", t0.elapsed().as_millis());
    db.close();

    #[cfg(target_os = "linux")]
    if let Ok(s) = std::fs::read_to_string("/proc/self/status") {
        for l in s.lines().filter(|l| l.starts_with("VmRSS") || l.starts_with("VmHWM")) {
            println!("{l}");
        }
    }
    println!("total bench: {} ms", t_start.elapsed().as_millis());
    let _ = std::fs::remove_dir_all(&tmp);
    Ok(())
}
