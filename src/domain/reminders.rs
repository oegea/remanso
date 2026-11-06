//! Recordatorios locales. Se comprueban al abrir la aplicación y al interactuar
//! con ella; no hay proceso residente. Un recordatorio nunca se considera
//! «incumplido» porque la aplicación estuviera cerrada: aparece como pendiente.

use rusqlite::{params, Connection, OptionalExtension};

use super::recurrence::Rule;
use super::Id;
use crate::dates;
use crate::storage::Result;

/// Tras este número de apariciones del mismo aviso, la interfaz ofrece revisar
/// en lugar de volver a avisar (habituación y «alarm fatigue»).
pub const MAX_SHOWS_DEFAULT: i64 = 2;

#[derive(Debug, Clone, PartialEq)]
pub struct Reminder {
    pub id: Id,
    pub title: String,
    pub due_at: i64,
    pub repeat: Option<Rule>,
    pub ref_kind: Option<String>,
    pub ref_id: Option<Id>,
    pub snoozed_until: Option<i64>,
    pub shown_count: i64,
    pub max_shows: i64,
    pub done_at: Option<i64>,
}

impl Reminder {
    /// Momento efectivo en que debe aparecer.
    pub fn effective_at(&self) -> i64 {
        self.snoozed_until.unwrap_or(self.due_at)
    }
    pub fn needs_review(&self) -> bool {
        self.shown_count >= self.max_shows
    }
}

const SELECT: &str =
    "SELECT id, title, due_at, repeat, ref_kind, ref_id, snoozed_until, shown_count, max_shows, done_at FROM reminders";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Reminder> {
    Ok(Reminder {
        id: r.get(0)?,
        title: r.get(1)?,
        due_at: r.get(2)?,
        repeat: r.get::<_, Option<String>>(3)?.and_then(|s| Rule::parse(&s)),
        ref_kind: r.get(4)?,
        ref_id: r.get(5)?,
        snoozed_until: r.get(6)?,
        shown_count: r.get(7)?,
        max_shows: r.get(8)?,
        done_at: r.get(9)?,
    })
}

pub fn create(conn: &Connection, title: &str, due_at: i64, repeat: Option<&Rule>, ref_kind: Option<&str>, ref_id: Option<Id>) -> Result<Id> {
    conn.execute(
        "INSERT INTO reminders(title, due_at, repeat, ref_kind, ref_id, max_shows, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![title.trim(), due_at, repeat.map(|r| r.to_storage()), ref_kind, ref_id, MAX_SHOWS_DEFAULT, dates::now_ts()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Reminder>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], map).optional()?)
}

/// Recordatorios cuyo momento efectivo ya pasó y no están cerrados.
pub fn due(conn: &Connection, now: i64) -> Result<Vec<Reminder>> {
    let mut st = conn.prepare_cached(&format!(
        "{SELECT} WHERE done_at IS NULL AND archived_at IS NULL AND coalesce(snoozed_until, due_at) <= ?1 ORDER BY coalesce(snoozed_until, due_at)"
    ))?;
    let rows = st.query_map([now], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Próximos (no vencidos), para la lista de recordatorios.
pub fn upcoming(conn: &Connection, now: i64, limit: usize) -> Result<Vec<Reminder>> {
    let mut st = conn.prepare_cached(&format!(
        "{SELECT} WHERE done_at IS NULL AND archived_at IS NULL AND coalesce(snoozed_until, due_at) > ?1 ORDER BY coalesce(snoozed_until, due_at) LIMIT ?2"
    ))?;
    let rows = st.query_map(params![now, limit as i64], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Instante del próximo recordatorio pendiente (para despertar el bucle justo entonces).
pub fn next_due_at(conn: &Connection, now: i64) -> Result<Option<i64>> {
    Ok(conn
        .query_row(
            "SELECT min(coalesce(snoozed_until, due_at)) FROM reminders WHERE done_at IS NULL AND archived_at IS NULL AND coalesce(snoozed_until, due_at) > ?1",
            [now],
            |r| r.get(0),
        )
        .optional()?
        .flatten())
}

/// Registra que el aviso se ha mostrado al usuario.
pub fn mark_shown(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("UPDATE reminders SET shown_count = shown_count + 1 WHERE id = ?1", [id])?;
    Ok(())
}

pub fn snooze(conn: &Connection, id: Id, until: i64) -> Result<()> {
    conn.execute("UPDATE reminders SET snoozed_until = ?2 WHERE id = ?1", params![id, until])?;
    Ok(())
}

/// Cierra el aviso. Si se repite, programa la siguiente aparición (desde hoy,
/// nunca acumulando apariciones pasadas) y reinicia el contador de muestras.
pub fn dismiss(conn: &Connection, id: Id) -> Result<()> {
    let Some(r) = get(conn, id)? else { return Ok(()) };
    let now = dates::now_ts();
    match &r.repeat {
        Some(rule) => {
            let due = dates::ts_to_local(r.due_at);
            let base_day = dates::ts_to_date(r.due_at).max(dates::today());
            let next_day = rule.next_after(base_day);
            let next_dt = next_day.and_hms_opt(chrono::Timelike::hour(&due), chrono::Timelike::minute(&due), 0).unwrap();
            let next_ts = chrono::TimeZone::from_local_datetime(&chrono::Local, &next_dt).single().map(|t| t.timestamp()).unwrap_or(now + 86_400);
            conn.execute(
                "UPDATE reminders SET due_at = ?2, snoozed_until = NULL, shown_count = 0 WHERE id = ?1",
                params![id, next_ts],
            )?;
        }
        None => {
            conn.execute("UPDATE reminders SET done_at = ?2 WHERE id = ?1", params![id, now])?;
        }
    }
    Ok(())
}

pub fn set_repeat(conn: &Connection, id: Id, rule: Option<&Rule>) -> Result<()> {
    conn.execute("UPDATE reminders SET repeat = ?2 WHERE id = ?1", params![id, rule.map(|r| r.to_storage())])?;
    Ok(())
}

pub fn reschedule(conn: &Connection, id: Id, due_at: i64) -> Result<()> {
    conn.execute("UPDATE reminders SET due_at = ?2, snoozed_until = NULL, shown_count = 0 WHERE id = ?1", params![id, due_at])?;
    Ok(())
}

pub fn archive(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("UPDATE reminders SET archived_at = ?2 WHERE id = ?1", params![id, dates::now_ts()])?;
    Ok(())
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM reminders WHERE id = ?1", [id])?;
    Ok(())
}

pub fn for_ref(conn: &Connection, kind: &str, ref_id: Id) -> Result<Vec<Reminder>> {
    let mut st = conn.prepare_cached(&format!(
        "{SELECT} WHERE ref_kind = ?1 AND ref_id = ?2 AND done_at IS NULL AND archived_at IS NULL ORDER BY due_at"
    ))?;
    let rows = st.query_map(params![kind, ref_id], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn due_snooze_dismiss() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let now = 1_700_000_000;
        let a = create(c, "Revisar objetivos", now - 60, None, None, None).unwrap();
        let b = create(c, "Más tarde", now + 3600, None, None, None).unwrap();
        assert_eq!(due(c, now).unwrap().iter().map(|r| r.id).collect::<Vec<_>>(), vec![a]);
        assert_eq!(next_due_at(c, now).unwrap(), Some(now + 3600));
        snooze(c, a, now + 600).unwrap();
        assert!(due(c, now).unwrap().is_empty());
        assert_eq!(next_due_at(c, now).unwrap(), Some(now + 600));
        assert_eq!(due(c, now + 601).unwrap().len(), 1);
        mark_shown(c, a).unwrap();
        mark_shown(c, a).unwrap();
        assert!(get(c, a).unwrap().unwrap().needs_review());
        dismiss(c, a).unwrap();
        assert!(get(c, a).unwrap().unwrap().done_at.is_some());
        assert_eq!(upcoming(c, now, 10).unwrap()[0].id, b);
    }

    #[test]
    fn repeating_reminder_rolls_forward_from_today() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        // Vencido hace 10 días, repetición diaria: al cerrarlo salta a mañana, no a hace 9 días.
        let old = dates::now_ts() - 10 * 86_400;
        let id = create(c, "Agua a las plantas", old, Some(&Rule::Daily), None, None).unwrap();
        dismiss(c, id).unwrap();
        let r = get(c, id).unwrap().unwrap();
        assert!(r.done_at.is_none());
        assert_eq!(dates::ts_to_date(r.due_at), dates::today() + chrono::Duration::days(1));
        assert_eq!(r.shown_count, 0);
    }
}
