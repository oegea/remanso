//! Etiquetas opcionales sobre cualquier entidad.

use rusqlite::{params, Connection};

use super::Id;
use crate::storage::Result;

pub fn set_tags(conn: &Connection, kind: &str, id: Id, tags: &[String]) -> Result<()> {
    conn.execute("DELETE FROM taggings WHERE entity_kind = ?1 AND entity_id = ?2", params![kind, id])?;
    for t in tags {
        let t = t.trim().trim_start_matches('#').to_lowercase();
        if t.is_empty() {
            continue;
        }
        conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?1)", [&t])?;
        let tag_id: Id = conn.query_row("SELECT id FROM tags WHERE name = ?1", [&t], |r| r.get(0))?;
        conn.execute(
            "INSERT OR IGNORE INTO taggings(tag_id, entity_kind, entity_id) VALUES (?1, ?2, ?3)",
            params![tag_id, kind, id],
        )?;
    }
    conn.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM taggings)", [])?;
    Ok(())
}

pub fn tags_of(conn: &Connection, kind: &str, id: Id) -> Result<Vec<String>> {
    let mut st = conn.prepare_cached(
        "SELECT t.name FROM tags t JOIN taggings g ON g.tag_id = t.id WHERE g.entity_kind = ?1 AND g.entity_id = ?2 ORDER BY t.name",
    )?;
    let rows = st.query_map(params![kind, id], |r| r.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn all_tags(conn: &Connection) -> Result<Vec<(String, usize)>> {
    let mut st = conn.prepare_cached(
        "SELECT t.name, count(*) FROM tags t JOIN taggings g ON g.tag_id = t.id GROUP BY t.id ORDER BY t.name",
    )?;
    let rows = st.query_map([], |r| Ok((r.get(0)?, r.get::<_, i64>(1)? as usize)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Divide «a, b c #d» en etiquetas.
pub fn parse_tags(s: &str) -> Vec<String> {
    s.split(|c: char| c == ',' || c.is_whitespace())
        .map(|t| t.trim().trim_start_matches('#').to_lowercase())
        .filter(|t| !t.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn tag_roundtrip_and_cleanup() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        set_tags(c, "diary", 1, &parse_tags("Trabajo, #sueño  salud")).unwrap();
        assert_eq!(tags_of(c, "diary", 1).unwrap(), vec!["salud", "sueño", "trabajo"]);
        set_tags(c, "diary", 1, &parse_tags("salud")).unwrap();
        assert_eq!(all_tags(c).unwrap(), vec![("salud".to_string(), 1)]);
    }
}
