//! Diario personal: entradas fechadas, varias por día, texto libre.

use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    pub id: Id,
    pub created_at: i64,
    pub updated_at: i64,
    pub day: String,
    pub title: Option<String>,
    pub body: String,
    pub goal_id: Option<Id>,
}

/// Resumen para listados (sin cuerpo completo).
#[derive(Debug, Clone, PartialEq)]
pub struct EntrySummary {
    pub id: Id,
    pub created_at: i64,
    pub day: String,
    pub title: Option<String>,
    pub preview: String,
    pub words: usize,
}

const SELECT: &str = "SELECT id, created_at, updated_at, day, title, body, goal_id FROM diary_entries";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Entry> {
    Ok(Entry {
        id: r.get(0)?,
        created_at: r.get(1)?,
        updated_at: r.get(2)?,
        day: r.get(3)?,
        title: r.get(4)?,
        body: r.get(5)?,
        goal_id: r.get(6)?,
    })
}

/// Crea una entrada vacía fechada ahora y devuelve su id.
pub fn create(conn: &Connection) -> Result<Id> {
    let now = dates::now_ts();
    conn.execute(
        "INSERT INTO diary_entries(created_at, updated_at, day, body) VALUES (?1, ?1, ?2, '')",
        params![now, dates::date_to_iso(dates::ts_to_date(now))],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Entry>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE id = ?1 AND deleted_at IS NULL"), [id], map).optional()?)
}

pub fn save_body(conn: &Connection, id: Id, title: Option<&str>, body: &str) -> Result<()> {
    conn.execute(
        "UPDATE diary_entries SET title = ?2, body = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, title.filter(|t| !t.trim().is_empty()), body, dates::now_ts()],
    )?;
    Ok(())
}

pub fn set_goal(conn: &Connection, id: Id, goal_id: Option<Id>) -> Result<()> {
    conn.execute("UPDATE diary_entries SET goal_id = ?2 WHERE id = ?1", params![id, goal_id])?;
    Ok(())
}

/// Borrado real. Las entradas vacías se eliminan al salir del editor sin aviso;
/// las demás sólo tras confirmación explícita.
pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM diary_entries WHERE id = ?1", [id])?;
    Ok(())
}

pub fn is_empty(conn: &Connection, id: Id) -> Result<bool> {
    let (t, b): (Option<String>, String) = conn.query_row(
        "SELECT title, body FROM diary_entries WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    Ok(t.map(|t| t.trim().is_empty()).unwrap_or(true) && b.trim().is_empty())
}

/// Listado cronológico inverso, paginado.
pub fn list(conn: &Connection, offset: usize, limit: usize) -> Result<Vec<EntrySummary>> {
    let mut st = conn.prepare_cached(
        "SELECT id, created_at, day, title, substr(body, 1, 200), body FROM diary_entries
         WHERE deleted_at IS NULL ORDER BY day DESC, created_at DESC LIMIT ?1 OFFSET ?2",
    )?;
    let rows = st.query_map(params![limit as i64, offset as i64], |r| {
        let body: String = r.get(5)?;
        Ok(EntrySummary {
            id: r.get(0)?,
            created_at: r.get(1)?,
            day: r.get(2)?,
            title: r.get(3)?,
            preview: preview_of(&r.get::<_, String>(4)?),
            words: word_count(&body),
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn count(conn: &Connection) -> Result<usize> {
    Ok(conn.query_row("SELECT count(*) FROM diary_entries WHERE deleted_at IS NULL", [], |r| r.get::<_, i64>(0))? as usize)
}

pub fn last_entry_day(conn: &Connection) -> Result<Option<String>> {
    Ok(conn.query_row("SELECT max(day) FROM diary_entries WHERE deleted_at IS NULL", [], |r| r.get(0))?)
}

/// Días con alguna entrada dentro de un rango (para el calendario).
pub fn days_with_entries(conn: &Connection, from: &str, to: &str) -> Result<Vec<String>> {
    let mut st = conn.prepare_cached(
        "SELECT DISTINCT day FROM diary_entries WHERE deleted_at IS NULL AND day BETWEEN ?1 AND ?2 ORDER BY day",
    )?;
    let rows = st.query_map([from, to], |r| r.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn for_goal(conn: &Connection, goal_id: Id, limit: usize) -> Result<Vec<EntrySummary>> {
    let mut st = conn.prepare_cached(
        "SELECT id, created_at, day, title, substr(body, 1, 200) FROM diary_entries
         WHERE deleted_at IS NULL AND goal_id = ?1 ORDER BY day DESC, created_at DESC LIMIT ?2",
    )?;
    let rows = st.query_map(params![goal_id, limit as i64], |r| {
        Ok(EntrySummary {
            id: r.get(0)?,
            created_at: r.get(1)?,
            day: r.get(2)?,
            title: r.get(3)?,
            preview: preview_of(&r.get::<_, String>(4)?),
            words: 0,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Palabras con al menos un carácter alfanumérico (los marcadores «#», «-» no cuentan).
pub fn word_count(text: &str) -> usize {
    text.split_whitespace().filter(|w| w.chars().any(char::is_alphanumeric)).count()
}

/// Primera línea no vacía, sin marcas Markdown, recortada.
pub fn preview_of(body: &str) -> String {
    let line = body.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("");
    let line = line.trim_start_matches(['#', '>', '-', '*', ' ']);
    let mut s: String = line.chars().take(120).collect();
    if line.chars().count() > 120 {
        s.push('…');
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn create_edit_list_delete() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let id = create(c).unwrap();
        assert!(is_empty(c, id).unwrap());
        save_body(c, id, Some("Un título"), "# Encabezado\n\nPrimera frase del día.").unwrap();
        let e = get(c, id).unwrap().unwrap();
        assert_eq!(e.title.as_deref(), Some("Un título"));
        assert!(!is_empty(c, id).unwrap());
        let l = list(c, 0, 10).unwrap();
        assert_eq!(l.len(), 1);
        assert_eq!(l[0].preview, "Encabezado");
        assert_eq!(l[0].words, 5);
        assert_eq!(count(c).unwrap(), 1);
        delete(c, id).unwrap();
        assert!(get(c, id).unwrap().is_none());
        assert_eq!(count(c).unwrap(), 0);
    }

    #[test]
    fn several_entries_per_day_ordered() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let a = create(c).unwrap();
        let b = create(c).unwrap();
        c.execute("UPDATE diary_entries SET created_at = created_at + 10 WHERE id = ?1", [b]).unwrap();
        let l = list(c, 0, 10).unwrap();
        assert_eq!(l.iter().map(|e| e.id).collect::<Vec<_>>(), vec![b, a]);
        assert_eq!(days_with_entries(c, "2000-01-01", "2999-12-31").unwrap().len(), 1);
    }

    #[test]
    fn empty_title_is_null() {
        let (_t, db) = temp_db();
        let id = create(&db.conn).unwrap();
        save_body(&db.conn, id, Some("   "), "x").unwrap();
        assert_eq!(get(&db.conn, id).unwrap().unwrap().title, None);
    }
}
