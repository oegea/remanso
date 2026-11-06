//! Cuadernos y notas.

use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

#[derive(Debug, Clone, PartialEq)]
pub struct Notebook {
    pub id: Id,
    pub name: String,
    pub description: String,
    pub position: i64,
    pub created_at: i64,
    pub archived: bool,
    pub note_count: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Note {
    pub id: Id,
    pub notebook_id: Id,
    pub title: String,
    pub body: String,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub archived: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NoteSummary {
    pub id: Id,
    pub notebook_id: Id,
    pub title: String,
    pub preview: String,
    pub pinned: bool,
    pub updated_at: i64,
    pub archived: bool,
}

pub fn create_notebook(conn: &Connection, name: &str) -> Result<Id> {
    let pos: i64 = conn.query_row("SELECT coalesce(max(position), 0) + 1 FROM notebooks", [], |r| r.get(0))?;
    conn.execute(
        "INSERT INTO notebooks(name, position, created_at) VALUES (?1, ?2, ?3)",
        params![name.trim(), pos, dates::now_ts()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn rename_notebook(conn: &Connection, id: Id, name: &str, description: &str) -> Result<()> {
    conn.execute("UPDATE notebooks SET name = ?2, description = ?3 WHERE id = ?1", params![id, name.trim(), description])?;
    Ok(())
}

pub fn set_notebook_archived(conn: &Connection, id: Id, archived: bool) -> Result<()> {
    let v: Option<i64> = if archived { Some(dates::now_ts()) } else { None };
    conn.execute("UPDATE notebooks SET archived_at = ?2 WHERE id = ?1", params![id, v])?;
    Ok(())
}

/// Borra el cuaderno y todas sus notas (irreversible; la UI pide confirmación).
pub fn delete_notebook(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM notebooks WHERE id = ?1", [id])?;
    Ok(())
}

pub fn list_notebooks(conn: &Connection, include_archived: bool) -> Result<Vec<Notebook>> {
    let sql = format!(
        "SELECT b.id, b.name, b.description, b.position, b.created_at, b.archived_at,
                (SELECT count(*) FROM notes n WHERE n.notebook_id = b.id AND n.archived_at IS NULL)
         FROM notebooks b {} ORDER BY b.archived_at IS NOT NULL, b.position, b.id",
        if include_archived { "" } else { "WHERE b.archived_at IS NULL" }
    );
    let mut st = conn.prepare_cached(&sql)?;
    let rows = st.query_map([], |r| {
        Ok(Notebook {
            id: r.get(0)?,
            name: r.get(1)?,
            description: r.get(2)?,
            position: r.get(3)?,
            created_at: r.get(4)?,
            archived: r.get::<_, Option<i64>>(5)?.is_some(),
            note_count: r.get::<_, i64>(6)? as usize,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn get_notebook(conn: &Connection, id: Id) -> Result<Option<Notebook>> {
    Ok(conn
        .query_row(
            "SELECT id, name, description, position, created_at, archived_at,
                    (SELECT count(*) FROM notes n WHERE n.notebook_id = notebooks.id AND n.archived_at IS NULL)
             FROM notebooks WHERE id = ?1",
            [id],
            |r| {
                Ok(Notebook {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    description: r.get(2)?,
                    position: r.get(3)?,
                    created_at: r.get(4)?,
                    archived: r.get::<_, Option<i64>>(5)?.is_some(),
                    note_count: r.get::<_, i64>(6)? as usize,
                })
            },
        )
        .optional()?)
}

pub fn create_note(conn: &Connection, notebook_id: Id, title: &str) -> Result<Id> {
    let now = dates::now_ts();
    conn.execute(
        "INSERT INTO notes(notebook_id, title, body, created_at, updated_at) VALUES (?1, ?2, '', ?3, ?3)",
        params![notebook_id, title.trim(), now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_note(conn: &Connection, id: Id) -> Result<Option<Note>> {
    Ok(conn
        .query_row(
            "SELECT id, notebook_id, title, body, pinned, created_at, updated_at, archived_at FROM notes WHERE id = ?1",
            [id],
            |r| {
                Ok(Note {
                    id: r.get(0)?,
                    notebook_id: r.get(1)?,
                    title: r.get(2)?,
                    body: r.get(3)?,
                    pinned: r.get::<_, i64>(4)? != 0,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                    archived: r.get::<_, Option<i64>>(7)?.is_some(),
                })
            },
        )
        .optional()?)
}

pub fn save_note(conn: &Connection, id: Id, title: &str, body: &str) -> Result<()> {
    conn.execute(
        "UPDATE notes SET title = ?2, body = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, title.trim(), body, dates::now_ts()],
    )?;
    Ok(())
}

pub fn set_note_pinned(conn: &Connection, id: Id, pinned: bool) -> Result<()> {
    conn.execute("UPDATE notes SET pinned = ?2 WHERE id = ?1", params![id, pinned as i64])?;
    Ok(())
}

pub fn set_note_archived(conn: &Connection, id: Id, archived: bool) -> Result<()> {
    let v: Option<i64> = if archived { Some(dates::now_ts()) } else { None };
    conn.execute("UPDATE notes SET archived_at = ?2 WHERE id = ?1", params![id, v])?;
    Ok(())
}

pub fn move_note(conn: &Connection, id: Id, notebook_id: Id) -> Result<()> {
    conn.execute("UPDATE notes SET notebook_id = ?2 WHERE id = ?1", params![id, notebook_id])?;
    Ok(())
}

pub fn delete_note(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", [id])?;
    Ok(())
}

pub fn is_note_empty(conn: &Connection, id: Id) -> Result<bool> {
    let (t, b): (String, String) =
        conn.query_row("SELECT title, body FROM notes WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(t.trim().is_empty() && b.trim().is_empty())
}

pub fn list_notes(conn: &Connection, notebook_id: Id, include_archived: bool) -> Result<Vec<NoteSummary>> {
    let sql = format!(
        "SELECT id, notebook_id, title, substr(body, 1, 200), pinned, updated_at, archived_at FROM notes
         WHERE notebook_id = ?1 {} ORDER BY archived_at IS NOT NULL, pinned DESC, updated_at DESC",
        if include_archived { "" } else { "AND archived_at IS NULL" }
    );
    let mut st = conn.prepare_cached(&sql)?;
    let rows = st.query_map([notebook_id], |r| {
        Ok(NoteSummary {
            id: r.get(0)?,
            notebook_id: r.get(1)?,
            title: r.get(2)?,
            preview: super::diary::preview_of(&r.get::<_, String>(3)?),
            pinned: r.get::<_, i64>(4)? != 0,
            updated_at: r.get(5)?,
            archived: r.get::<_, Option<i64>>(6)?.is_some(),
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Resuelve una referencia `[[Título]]` al id de nota con ese título (sin
/// distinguir mayúsculas). Devuelve la primera coincidencia no archivada.
pub fn find_note_by_title(conn: &Connection, title: &str) -> Result<Option<Id>> {
    Ok(conn
        .query_row(
            "SELECT id FROM notes WHERE title = ?1 COLLATE NOCASE AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 1",
            [title.trim()],
            |r| r.get(0),
        )
        .optional()?)
}

/// Extrae los enlaces `[[…]]` de un texto.
pub fn wiki_links(body: &str) -> Vec<String> {
    let mut out = vec![];
    let mut rest = body;
    while let Some(start) = rest.find("[[") {
        let after = &rest[start + 2..];
        match after.find("]]") {
            Some(end) => {
                let t = after[..end].trim();
                if !t.is_empty() && !t.contains('\n') {
                    out.push(t.to_string());
                }
                rest = &after[end + 2..];
            }
            None => break,
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn notebooks_and_notes() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let nb = create_notebook(c, " Ideas ").unwrap();
        let n1 = create_note(c, nb, "Primera").unwrap();
        let n2 = create_note(c, nb, "Segunda").unwrap();
        save_note(c, n2, "Segunda", "Ver [[Primera]] y [[  Primera ]] y [[Inexistente]]").unwrap();
        set_note_pinned(c, n2, true).unwrap();
        let books = list_notebooks(c, false).unwrap();
        assert_eq!(books[0].name, "Ideas");
        assert_eq!(books[0].note_count, 2);
        let notes = list_notes(c, nb, false).unwrap();
        assert_eq!(notes[0].id, n2, "las fijadas van primero");
        let links = wiki_links(&get_note(c, n2).unwrap().unwrap().body);
        assert_eq!(links, vec!["Primera", "Primera", "Inexistente"]);
        assert_eq!(find_note_by_title(c, "primera").unwrap(), Some(n1));
        assert_eq!(find_note_by_title(c, "Inexistente").unwrap(), None);

        set_note_archived(c, n1, true).unwrap();
        assert_eq!(list_notes(c, nb, false).unwrap().len(), 1);
        assert_eq!(list_notes(c, nb, true).unwrap().len(), 2);
        set_notebook_archived(c, nb, true).unwrap();
        assert!(list_notebooks(c, false).unwrap().is_empty());
        assert_eq!(list_notebooks(c, true).unwrap().len(), 1);
        delete_notebook(c, nb).unwrap();
        assert!(get_note(c, n1).unwrap().is_none(), "borrado en cascada");
    }
}
