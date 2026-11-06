//! Sesiones de revisión (apertura, cierre, semanal, objetivo). Una sesión
//! guiada al día como máximo; la semanal se sugiere, no se exige.

use chrono::{Datelike, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

pub fn start(conn: &Connection, kind: &str, goal_id: Option<Id>) -> Result<Id> {
    let now = dates::now_ts();
    conn.execute(
        "INSERT INTO reviews(kind, goal_id, day, started_at) VALUES (?1, ?2, ?3, ?4)",
        params![kind, goal_id, dates::date_to_iso(dates::ts_to_date(now)), now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn complete(conn: &Connection, id: Id, notes: &str) -> Result<()> {
    conn.execute("UPDATE reviews SET completed_at = ?2, notes = ?3 WHERE id = ?1", params![id, dates::now_ts(), notes])?;
    Ok(())
}

/// ¿Hubo ya una sesión guiada (apertura/cierre/semanal) hoy?
pub fn guided_today(conn: &Connection, today: NaiveDate) -> Result<Option<String>> {
    Ok(conn
        .query_row(
            "SELECT kind FROM reviews WHERE day = ?1 AND kind IN ('open','close','weekly') AND completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 1",
            [dates::date_to_iso(today)],
            |r| r.get(0),
        )
        .optional()?)
}

pub fn last_of_kind(conn: &Connection, kind: &str) -> Result<Option<String>> {
    Ok(conn
        .query_row("SELECT max(day) FROM reviews WHERE kind = ?1 AND completed_at IS NOT NULL", [kind], |r| r.get::<_, Option<String>>(0))
        .optional()?
        .flatten())
}

/// La revisión semanal «toca» si está activada, hoy es el día elegido (o
/// posterior en la misma semana) y no se ha hecho esta semana.
pub fn weekly_available(conn: &Connection, today: NaiveDate, weekday: u32) -> Result<bool> {
    if !super::prompts::set_enabled(conn, "weekly")? {
        return Ok(false);
    }
    let ws = dates::week_start(today);
    let done_this_week = conn
        .query_row(
            "SELECT count(*) FROM reviews WHERE kind = 'weekly' AND completed_at IS NOT NULL AND day >= ?1",
            [dates::date_to_iso(ws)],
            |r| r.get::<_, i64>(0),
        )?
        > 0;
    Ok(!done_this_week && today.weekday().num_days_from_monday() >= weekday)
}

/// Cuántas revisiones semanales seguidas se abrieron y cerraron sin respuestas
/// (para ofrecer desactivarla, spec §b.8).
pub fn empty_weekly_streak(conn: &Connection) -> Result<i64> {
    let mut st = conn.prepare(
        "SELECT (SELECT count(*) FROM prompt_answers a WHERE a.review_id = r.id) FROM reviews r
         WHERE r.kind = 'weekly' AND r.completed_at IS NOT NULL ORDER BY r.started_at DESC LIMIT 3",
    )?;
    let counts: Vec<i64> = st.query_map([], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
    Ok(counts.iter().take_while(|c| **c == 0).count() as i64)
}

pub fn count(conn: &Connection, kind: &str) -> Result<i64> {
    Ok(conn.query_row("SELECT count(*) FROM reviews WHERE kind = ?1 AND completed_at IS NOT NULL", [kind], |r| r.get(0))?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn sessions_and_weekly_rule() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let today = dates::today();
        assert!(guided_today(c, today).unwrap().is_none());
        let id = start(c, "close", None).unwrap();
        complete(c, id, "").unwrap();
        assert_eq!(guided_today(c, today).unwrap().as_deref(), Some("close"));
        assert!(!weekly_available(c, today, 0).unwrap(), "sin preguntas semanales activas");
        super::super::prompts::install_set(c, "weekly").unwrap();
        assert!(weekly_available(c, today, 0).unwrap());
        assert!(!weekly_available(c, today, 6).unwrap() || today.weekday().num_days_from_monday() == 6);
        let w = start(c, "weekly", None).unwrap();
        complete(c, w, "").unwrap();
        assert!(!weekly_available(c, today, 0).unwrap());
        assert_eq!(empty_weekly_streak(c).unwrap(), 1);
    }
}
