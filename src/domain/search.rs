//! Búsqueda local con FTS5 (dentro de la base cifrada).

use rusqlite::{params, Connection};

use super::Id;
use crate::storage::Result;

#[derive(Debug, Clone, PartialEq)]
pub enum Hit {
    Diary { id: Id, day: String, title: Option<String>, snippet: String },
    Note { id: Id, notebook_id: Id, notebook: String, title: String, snippet: String },
}

/// Convierte texto libre en una consulta FTS5 segura: cada término entre
/// comillas y con prefijo, para que la sintaxis del usuario nunca se interprete.
pub fn fts_query(input: &str) -> Option<String> {
    let terms: Vec<String> = input
        .split_whitespace()
        .map(|t| t.replace('"', ""))
        .filter(|t| !t.is_empty())
        .map(|t| format!("\"{t}\"*"))
        .collect();
    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

pub fn search_all(conn: &Connection, input: &str, limit: usize) -> Result<Vec<Hit>> {
    let Some(q) = fts_query(input) else { return Ok(vec![]) };
    let mut out = vec![];
    {
        let mut st = conn.prepare_cached(
            "SELECT e.id, e.day, e.title, snippet(diary_fts, 1, '', '', '…', 14)
             FROM diary_fts JOIN diary_entries e ON e.id = diary_fts.rowid
             WHERE diary_fts MATCH ?1 AND e.deleted_at IS NULL ORDER BY rank LIMIT ?2",
        )?;
        let rows = st.query_map(params![q, limit as i64], |r| {
            Ok(Hit::Diary { id: r.get(0)?, day: r.get(1)?, title: r.get(2)?, snippet: clean(r.get::<_, String>(3)?) })
        })?;
        out.extend(rows.collect::<rusqlite::Result<Vec<_>>>()?);
    }
    {
        let mut st = conn.prepare_cached(
            "SELECT n.id, n.notebook_id, b.name, n.title, snippet(notes_fts, 1, '', '', '…', 14)
             FROM notes_fts JOIN notes n ON n.id = notes_fts.rowid JOIN notebooks b ON b.id = n.notebook_id
             WHERE notes_fts MATCH ?1 ORDER BY rank LIMIT ?2",
        )?;
        let rows = st.query_map(params![q, limit as i64], |r| {
            Ok(Hit::Note {
                id: r.get(0)?,
                notebook_id: r.get(1)?,
                notebook: r.get(2)?,
                title: r.get(3)?,
                snippet: clean(r.get::<_, String>(4)?),
            })
        })?;
        out.extend(rows.collect::<rusqlite::Result<Vec<_>>>()?);
    }
    Ok(out)
}

pub fn search_diary(conn: &Connection, input: &str, limit: usize) -> Result<Vec<Hit>> {
    Ok(search_all(conn, input, limit)?.into_iter().filter(|h| matches!(h, Hit::Diary { .. })).collect())
}

pub fn search_notes(conn: &Connection, input: &str, limit: usize) -> Result<Vec<Hit>> {
    Ok(search_all(conn, input, limit)?.into_iter().filter(|h| matches!(h, Hit::Note { .. })).collect())
}

fn clean(s: String) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{diary, notebooks};
    use crate::storage::test_support::temp_db;

    #[test]
    fn query_is_sanitised() {
        assert_eq!(fts_query("hola mundo").unwrap(), "\"hola\"* \"mundo\"*");
        assert_eq!(fts_query("a\"b OR NOT").unwrap(), "\"ab\"* \"OR\"* \"NOT\"*");
        assert!(fts_query("   ").is_none());
    }

    #[test]
    fn finds_in_diary_and_notes_with_diacritics() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let e = diary::create(c).unwrap();
        diary::save_body(c, e, None, "Hoy he dormido mejor que ayer, la camión... no, el camión pasó tarde.").unwrap();
        let nb = notebooks::create_notebook(c, "Casa").unwrap();
        let n = notebooks::create_note(c, nb, "Sueño").unwrap();
        notebooks::save_note(c, n, "Sueño", "Rutina para dormir: luz tenue, sin pantallas.").unwrap();

        let hits = search_all(c, "dormi", 10).unwrap();
        assert_eq!(hits.len(), 2);
        assert!(matches!(&hits[0], Hit::Diary { id, .. } if *id == e));
        assert!(matches!(&hits[1], Hit::Note { title, .. } if title == "Sueño"));
        // Sin tilde también encuentra «camión».
        assert_eq!(search_diary(c, "camion", 10).unwrap().len(), 1);
        // Sintaxis FTS no se interpreta.
        assert!(search_all(c, "dormido OR", 10).unwrap().is_empty());
        assert!(search_all(c, "col:x", 10).unwrap().is_empty());
    }
}
