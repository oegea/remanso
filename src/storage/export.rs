//! Exportación deliberada a formatos abiertos, EN CLARO. Sólo se ejecuta por
//! orden explícita y tras confirmación. Produce:
//!   diario/AAAA/AAAA-MM-DD-<id>.md       una entrada por fichero
//!   cuadernos/<cuaderno>/<id>-<título>.md una nota por fichero
//!   datos.json                            volcado completo de todas las tablas
//! El volcado JSON es genérico: recorre `sqlite_master`, así que cualquier
//! tabla futura queda incluida sin tocar este código.

use std::path::Path;

use rusqlite::types::ValueRef;
use serde_json::{json, Map, Value};

use super::{Db, Result};
use crate::paths::DataDir;

pub fn export_all(db: &Db, dest: &Path) -> Result<usize> {
    std::fs::create_dir_all(dest)?;
    crate::paths::restrict_permissions(dest);
    let mut files = 0;

    // Diario
    let mut st = db.conn.prepare(
        "SELECT id, day, created_at, title, body FROM diary_entries WHERE deleted_at IS NULL ORDER BY day, created_at",
    )?;
    let rows = st.query_map([], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?, r.get::<_, Option<String>>(3)?, r.get::<_, String>(4)?))
    })?;
    for row in rows {
        let (id, day, created, title, body) = row?;
        let year = &day[..4];
        let d = dest.join("diario").join(year);
        std::fs::create_dir_all(&d)?;
        let mut md = String::new();
        md.push_str(&format!("# {}{}\n\n", day, title.as_deref().map(|t| format!(" · {t}")).unwrap_or_default()));
        md.push_str(&format!("_{} {}_\n\n", day, crate::dates::fmt_time(created)));
        md.push_str(&body);
        md.push('\n');
        let path = d.join(format!("{day}-{id}.md"));
        std::fs::write(&path, md)?;
        crate::paths::restrict_permissions(&path);
        files += 1;
    }

    // Cuadernos
    let mut st = db.conn.prepare(
        "SELECT n.id, n.title, n.body, b.name FROM notes n JOIN notebooks b ON b.id = n.notebook_id ORDER BY b.position, n.id",
    )?;
    let rows = st.query_map([], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?))
    })?;
    for row in rows {
        let (id, title, body, nb) = row?;
        let d = dest.join("cuadernos").join(safe_name(&nb));
        std::fs::create_dir_all(&d)?;
        let name = if title.is_empty() { format!("{id}.md") } else { format!("{id}-{}.md", safe_name(&title)) };
        let md = if title.is_empty() { body.clone() } else { format!("# {title}\n\n{body}\n") };
        let path = d.join(name);
        std::fs::write(&path, md)?;
        crate::paths::restrict_permissions(&path);
        files += 1;
    }

    // Volcado JSON genérico
    let dump = dump_json(db)?;
    let json_path = dest.join("datos.json");
    std::fs::write(&json_path, serde_json::to_vec_pretty(&dump).unwrap())?;
    crate::paths::restrict_permissions(&json_path);
    files += 1;
    Ok(files)
}

pub fn dump_json(db: &Db) -> Result<Value> {
    let mut tables: Vec<String> = {
        let mut st = db.conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%' ORDER BY name",
        )?;
        let v = st.query_map([], |r| r.get(0))?.collect::<std::result::Result<Vec<String>, _>>()?;
        v
    };
    tables.retain(|t| !t.ends_with("_fts"));
    let mut root = Map::new();
    root.insert("formato".into(), json!(1));
    root.insert("aplicacion".into(), json!(format!("remanso {}", env!("CARGO_PKG_VERSION"))));
    root.insert("esquema".into(), json!(db.schema_version()?));
    root.insert("exportado_en".into(), json!(crate::dates::now_ts()));
    let mut data = Map::new();
    for t in tables {
        let mut st = db.conn.prepare(&format!("SELECT * FROM \"{t}\""))?;
        let cols: Vec<String> = st.column_names().iter().map(|s| s.to_string()).collect();
        let mut rows_out = vec![];
        let mut rows = st.query([])?;
        while let Some(row) = rows.next()? {
            let mut obj = Map::new();
            for (i, c) in cols.iter().enumerate() {
                let v = match row.get_ref(i)? {
                    ValueRef::Null => Value::Null,
                    ValueRef::Integer(n) => json!(n),
                    ValueRef::Real(f) => json!(f),
                    ValueRef::Text(t) => json!(String::from_utf8_lossy(t)),
                    ValueRef::Blob(b) => json!(b.iter().map(|x| format!("{x:02x}")).collect::<String>()),
                };
                obj.insert(c.clone(), v);
            }
            rows_out.push(Value::Object(obj));
        }
        data.insert(t, Value::Array(rows_out));
    }
    root.insert("tablas".into(), Value::Object(data));
    Ok(Value::Object(root))
}

fn safe_name(s: &str) -> String {
    let mut out: String = s
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' })
        .collect();
    out = out.trim().replace(' ', "-");
    if out.is_empty() {
        out.push_str("sin-nombre");
    }
    out.chars().take(60).collect()
}

pub fn cli_export(dir: &DataDir, dest: &Path) -> std::result::Result<(), Box<dyn std::error::Error>> {
    eprintln!("La exportación escribe TODO el contenido en texto plano, sin cifrar, en {}.", dest.display());
    if !crate::cli::confirm("¿Continuar?")? {
        return Ok(());
    }
    let pw = crate::cli::prompt_password("Contraseña: ")?;
    let db = Db::open(dir, &pw)?;
    let n = export_all(&db, dest)?;
    eprintln!("{n} ficheros exportados.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::*;

    #[test]
    fn exports_markdown_and_json() {
        let (tmp, db) = temp_db();
        db.conn
            .execute("INSERT INTO diary_entries(created_at, updated_at, day, title, body) VALUES (1,1,'2026-03-04','Día','texto del diario')", [])
            .unwrap();
        db.conn.execute("INSERT INTO notebooks(name, created_at) VALUES ('Ideas / proyectos', 1)", []).unwrap();
        db.conn
            .execute("INSERT INTO notes(notebook_id, title, body, created_at, updated_at) VALUES (1, 'Nota: uno', 'cuerpo', 1, 1)", [])
            .unwrap();
        let dest = tmp.path().join("export");
        let n = export_all(&db, &dest).unwrap();
        assert_eq!(n, 3);
        let md = std::fs::read_to_string(dest.join("diario/2026/2026-03-04-1.md")).unwrap();
        assert!(md.contains("texto del diario"));
        assert!(dest.join("cuadernos/Ideas-_-proyectos/1-Nota_-uno.md").exists());
        let json: Value = serde_json::from_slice(&std::fs::read(dest.join("datos.json")).unwrap()).unwrap();
        assert_eq!(json["tablas"]["notes"][0]["title"], "Nota: uno");
        assert!(json["tablas"].get("diary_fts").is_none());
    }
}
