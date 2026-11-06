//! Acciones recurrentes de un objetivo («hábitos»). Se registran por día; un
//! hueco es un hueco, nunca un «no hecho» implícito. La métrica principal es la
//! frecuencia en ventana (7 / 30 días), no la racha de días consecutivos.

use chrono::{Datelike, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Schedule {
    Daily,
    Weekdays([bool; 7]),
    /// N veces por semana, cualquier día.
    PerWeek(u32),
}

impl Schedule {
    pub fn parse(s: &str) -> Schedule {
        if let Some(n) = s.strip_prefix("per_week:").and_then(|n| n.parse().ok()) {
            return Schedule::PerWeek(n);
        }
        if let Some(rest) = s.strip_prefix("weekdays:") {
            let mut d = [false; 7];
            for c in rest.chars() {
                if let Some(i) = "LMXJVSD".find(c.to_ascii_uppercase()) {
                    d[i] = true;
                }
            }
            return Schedule::Weekdays(d);
        }
        Schedule::Daily
    }

    pub fn to_storage(&self) -> String {
        match self {
            Schedule::Daily => "daily".into(),
            Schedule::Weekdays(d) => format!("weekdays:{}", d.iter().zip("LMXJVSD".chars()).filter(|(on, _)| **on).map(|(_, c)| c).collect::<String>()),
            Schedule::PerWeek(n) => format!("per_week:{n}"),
        }
    }

    /// «cada día», «laborables», «L X V», «3 veces por semana», «3/semana».
    pub fn parse_human(s: &str) -> Option<Schedule> {
        let t = s.trim().to_lowercase();
        if t.is_empty() {
            return None;
        }
        if let Some(n) = t.split_once(|c: char| !c.is_ascii_digit()).map(|(n, _)| n).filter(|n| !n.is_empty()).and_then(|n| n.parse::<u32>().ok()) {
            if t.contains("semana") || t.contains("/s") {
                return (1..=7).contains(&n).then_some(Schedule::PerWeek(n));
            }
        }
        match crate::domain::recurrence::Rule::parse_human(&t)? {
            crate::domain::recurrence::Rule::Daily => Some(Schedule::Daily),
            crate::domain::recurrence::Rule::Weekdays(d) => Some(Schedule::Weekdays(d)),
            crate::domain::recurrence::Rule::Every(1, crate::domain::recurrence::Unit::Weeks) => Some(Schedule::PerWeek(1)),
            _ => None,
        }
    }

    pub fn describe(&self) -> String {
        match self {
            Schedule::Daily => "cada día".into(),
            Schedule::Weekdays(d) => crate::domain::recurrence::Rule::Weekdays(*d).describe(),
            Schedule::PerWeek(1) => "1 vez por semana".into(),
            Schedule::PerWeek(n) => format!("{n} veces por semana"),
        }
    }

    /// Veces previstas por semana.
    pub fn per_week(&self) -> u32 {
        match self {
            Schedule::Daily => 7,
            Schedule::Weekdays(d) => d.iter().filter(|x| **x).count() as u32,
            Schedule::PerWeek(n) => *n,
        }
    }

    pub fn planned_on(&self, d: NaiveDate) -> bool {
        match self {
            Schedule::Daily => true,
            Schedule::Weekdays(days) => days[d.weekday().num_days_from_monday() as usize],
            Schedule::PerWeek(_) => true,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Action {
    pub id: Id,
    pub goal_id: Option<Id>,
    pub name: String,
    pub cue: String,
    pub avoid: bool,
    pub schedule: Schedule,
    pub paused: bool,
    pub archived: bool,
    pub created_at: i64,
}

const SELECT: &str = "SELECT id, goal_id, name, cue, kind, schedule, paused_at, archived_at, created_at FROM actions";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Action> {
    Ok(Action {
        id: r.get(0)?,
        goal_id: r.get(1)?,
        name: r.get(2)?,
        cue: r.get(3)?,
        avoid: r.get::<_, String>(4)? == "avoid",
        schedule: Schedule::parse(&r.get::<_, String>(5)?),
        paused: r.get::<_, Option<i64>>(6)?.is_some(),
        archived: r.get::<_, Option<i64>>(7)?.is_some(),
        created_at: r.get(8)?,
    })
}

pub fn create(conn: &Connection, goal_id: Option<Id>, name: &str, schedule: &Schedule, avoid: bool) -> Result<Id> {
    conn.execute(
        "INSERT INTO actions(goal_id, name, kind, schedule, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![goal_id, name.trim(), if avoid { "avoid" } else { "do" }, schedule.to_storage(), dates::now_ts()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Action>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], map).optional()?)
}

pub fn list_for_goal(conn: &Connection, goal_id: Id, include_archived: bool) -> Result<Vec<Action>> {
    let sql = format!("{SELECT} WHERE goal_id = ?1 {} ORDER BY archived_at IS NOT NULL, paused_at IS NOT NULL, id", if include_archived { "" } else { "AND archived_at IS NULL" });
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map([goal_id], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Acciones activas de todos los objetivos activos, para «Hoy» en Inicio.
pub fn list_active(conn: &Connection) -> Result<Vec<Action>> {
    let mut st = conn.prepare(&format!(
        "{SELECT} WHERE archived_at IS NULL AND paused_at IS NULL AND (goal_id IS NULL OR goal_id IN (SELECT id FROM goals WHERE status = 'active' AND archived_at IS NULL)) ORDER BY id"
    ))?;
    let rows = st.query_map([], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn set_name(conn: &Connection, id: Id, v: &str) -> Result<()> {
    conn.execute("UPDATE actions SET name = ?2 WHERE id = ?1", params![id, v.trim()])?;
    Ok(())
}
pub fn set_cue(conn: &Connection, id: Id, v: &str) -> Result<()> {
    conn.execute("UPDATE actions SET cue = ?2 WHERE id = ?1", params![id, v.trim()])?;
    Ok(())
}
pub fn set_schedule(conn: &Connection, id: Id, s: &Schedule) -> Result<()> {
    conn.execute("UPDATE actions SET schedule = ?2 WHERE id = ?1", params![id, s.to_storage()])?;
    Ok(())
}
pub fn set_paused(conn: &Connection, id: Id, paused: bool) -> Result<()> {
    let v: Option<i64> = if paused { Some(dates::now_ts()) } else { None };
    conn.execute("UPDATE actions SET paused_at = ?2 WHERE id = ?1", params![id, v])?;
    Ok(())
}
pub fn set_archived(conn: &Connection, id: Id, archived: bool) -> Result<()> {
    let v: Option<i64> = if archived { Some(dates::now_ts()) } else { None };
    conn.execute("UPDATE actions SET archived_at = ?2 WHERE id = ?1", params![id, v])?;
    Ok(())
}
pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM actions WHERE id = ?1", [id])?;
    Ok(())
}

/// Registra el día: `Some(true)` hecha, `Some(false)` registrada como no hecha
/// (sólo si el usuario lo indica), `None` borra el registro (vuelve a ser hueco).
pub fn log(conn: &Connection, action_id: Id, day: NaiveDate, done: Option<bool>, note: &str) -> Result<()> {
    let d = dates::date_to_iso(day);
    match done {
        None => {
            conn.execute("DELETE FROM action_log WHERE action_id = ?1 AND day = ?2", params![action_id, d])?;
        }
        Some(v) => {
            conn.execute(
                "INSERT INTO action_log(action_id, day, done, note, logged_at) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(action_id, day) DO UPDATE SET done = excluded.done, note = excluded.note, logged_at = excluded.logged_at",
                params![action_id, d, v as i64, note, dates::now_ts()],
            )?;
        }
    }
    Ok(())
}

/// Estado del día: `Some(true)` hecha, `Some(false)` marcada no hecha, `None` sin registro.
pub fn status_on(conn: &Connection, action_id: Id, day: NaiveDate) -> Result<Option<bool>> {
    Ok(conn
        .query_row("SELECT done FROM action_log WHERE action_id = ?1 AND day = ?2", params![action_id, dates::date_to_iso(day)], |r| r.get::<_, i64>(0))
        .optional()?
        .map(|v| v != 0))
}

/// Días hechos en el rango [from, to], ascendente.
pub fn done_days(conn: &Connection, action_id: Id, from: NaiveDate, to: NaiveDate) -> Result<Vec<NaiveDate>> {
    let mut st = conn.prepare_cached("SELECT day FROM action_log WHERE action_id = ?1 AND done = 1 AND day BETWEEN ?2 AND ?3 ORDER BY day")?;
    let rows = st.query_map(params![action_id, dates::date_to_iso(from), dates::date_to_iso(to)], |r| r.get::<_, String>(0))?;
    Ok(rows.filter_map(|r| r.ok()).filter_map(|s| dates::parse_iso_date(&s)).collect())
}

pub fn total_done(conn: &Connection, action_id: Id) -> Result<i64> {
    Ok(conn.query_row("SELECT count(*) FROM action_log WHERE action_id = ?1 AND done = 1", [action_id], |r| r.get(0))?)
}

pub fn first_done(conn: &Connection, action_id: Id) -> Result<Option<NaiveDate>> {
    let d: Option<String> = conn.query_row("SELECT min(day) FROM action_log WHERE action_id = ?1 AND done = 1", [action_id], |r| r.get(0))?;
    Ok(d.and_then(|s| dates::parse_iso_date(&s)))
}

/// Resumen descriptivo: hechos en los últimos 7 y 30 días, previstos por semana,
/// semanas consecutivas (hasta la actual) en que se alcanzó la frecuencia, y total.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Summary {
    pub last7: usize,
    pub last30: usize,
    pub per_week: u32,
    pub this_week: usize,
    pub last_week: usize,
    pub weeks_meeting_target: usize,
    pub total: i64,
}

pub fn summary(conn: &Connection, action: &Action, today: NaiveDate) -> Result<Summary> {
    let from = today - chrono::Duration::days(120);
    let days = done_days(conn, action.id, from, today)?;
    let last7 = days.iter().filter(|d| **d > today - chrono::Duration::days(7)).count();
    let last30 = days.iter().filter(|d| **d > today - chrono::Duration::days(30)).count();
    let ws = dates::week_start(today);
    let this_week = days.iter().filter(|d| **d >= ws).count();
    let last_week = days.iter().filter(|d| **d >= ws - chrono::Duration::days(7) && **d < ws).count();
    let target = action.schedule.per_week() as usize;
    // Semanas completas anteriores consecutivas con frecuencia alcanzada (la actual cuenta si ya la alcanzó).
    let mut weeks = 0;
    let mut w = ws;
    if this_week >= target {
        weeks += 1;
    }
    loop {
        let start = w - chrono::Duration::days(7);
        if start < from + chrono::Duration::days(7) {
            break;
        }
        let n = days.iter().filter(|d| **d >= start && **d < w).count();
        if n >= target {
            weeks += 1;
            w = start;
        } else {
            break;
        }
    }
    Ok(Summary { last7, last30, per_week: action.schedule.per_week(), this_week, last_week, weeks_meeting_target: weeks, total: total_done(conn, action.id)? })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn schedule_parsing() {
        assert_eq!(Schedule::parse_human("3 veces por semana"), Some(Schedule::PerWeek(3)));
        assert_eq!(Schedule::parse_human("3/semana"), Some(Schedule::PerWeek(3)));
        assert_eq!(Schedule::parse_human("cada día"), Some(Schedule::Daily));
        assert_eq!(Schedule::parse_human("L X V").map(|s| s.per_week()), Some(3));
        assert_eq!(Schedule::parse("per_week:4"), Schedule::PerWeek(4));
        assert_eq!(Schedule::PerWeek(4).to_storage(), "per_week:4");
        assert_eq!(Schedule::PerWeek(4).describe(), "4 veces por semana");
    }

    #[test]
    fn logging_and_summary() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let a = create(c, None, "Caminar 20 minutos", &Schedule::PerWeek(3), false).unwrap();
        let today = dates::today();
        for i in [0, 1, 3, 8, 9, 10, 40] {
            log(c, a, today - chrono::Duration::days(i), Some(true), "").unwrap();
        }
        log(c, a, today - chrono::Duration::days(2), Some(false), "resfriado").unwrap();
        assert_eq!(status_on(c, a, today).unwrap(), Some(true));
        assert_eq!(status_on(c, a, today - chrono::Duration::days(2)).unwrap(), Some(false));
        assert_eq!(status_on(c, a, today - chrono::Duration::days(5)).unwrap(), None, "hueco, no fallo");
        let act = get(c, a).unwrap().unwrap();
        let s = summary(c, &act, today).unwrap();
        assert_eq!(s.last7, 3);
        assert_eq!(s.last30, 6);
        assert_eq!(s.total, 7);
        assert_eq!(s.per_week, 3);
        log(c, a, today, None, "").unwrap();
        assert_eq!(status_on(c, a, today).unwrap(), None);
        assert_eq!(total_done(c, a).unwrap(), 6);
    }
}
