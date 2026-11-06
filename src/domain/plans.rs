//! Planes «si–entonces» (intenciones de implementación) con revisión de utilidad
//! y recordatorios de refuerzo a 7 y 14 días (interventions.md §b.6).

use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

#[derive(Debug, Clone, PartialEq)]
pub struct Plan {
    pub id: Id,
    pub goal_id: Option<Id>,
    pub action_id: Option<Id>,
    pub situation: String,
    pub response: String,
    pub created_at: i64,
    pub last_reviewed_at: Option<i64>,
    pub archived: bool,
    pub helpful_yes: i64,
    pub helpful_partly: i64,
    pub helpful_no: i64,
    pub not_used: i64,
}

const SELECT: &str = "SELECT p.id, p.goal_id, p.action_id, p.situation, p.response, p.created_at, p.last_reviewed_at, p.archived_at,
    (SELECT count(*) FROM plan_reviews r WHERE r.plan_id = p.id AND r.helpful = 'yes'),
    (SELECT count(*) FROM plan_reviews r WHERE r.plan_id = p.id AND r.helpful = 'partly'),
    (SELECT count(*) FROM plan_reviews r WHERE r.plan_id = p.id AND r.helpful = 'no'),
    (SELECT count(*) FROM plan_reviews r WHERE r.plan_id = p.id AND r.helpful = 'not_used')
    FROM if_then_plans p";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Plan> {
    Ok(Plan {
        id: r.get(0)?,
        goal_id: r.get(1)?,
        action_id: r.get(2)?,
        situation: r.get(3)?,
        response: r.get(4)?,
        created_at: r.get(5)?,
        last_reviewed_at: r.get(6)?,
        archived: r.get::<_, Option<i64>>(7)?.is_some(),
        helpful_yes: r.get(8)?,
        helpful_partly: r.get(9)?,
        helpful_no: r.get(10)?,
        not_used: r.get(11)?,
    })
}

/// Frases vagas que desactivan el efecto del plan (lista cerrada, spec §b.6).
const VAGUE: &[&str] = &["cuando pueda", "algún día", "algun dia", "cuando tenga tiempo", "si me apetece", "cuando me acuerde", "ya veré", "ya vere"];

pub fn is_vague(situation: &str) -> bool {
    let s = situation.trim().to_lowercase();
    s.is_empty() || VAGUE.iter().any(|v| s.contains(v))
}

/// Crea el plan y, si hay fecha, los recordatorios de refuerzo a 7 y 14 días.
pub fn create(conn: &Connection, goal_id: Option<Id>, action_id: Option<Id>, situation: &str, response: &str, boosters: bool) -> Result<Id> {
    let now = dates::now_ts();
    conn.execute(
        "INSERT INTO if_then_plans(goal_id, action_id, situation, response, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![goal_id, action_id, situation.trim(), response.trim(), now],
    )?;
    let id = conn.last_insert_rowid();
    if boosters {
        for days in [7, 14] {
            let at = booster_time(now + days * 86_400);
            super::reminders::create(conn, &format!("Plan: si {} → {}", situation.trim(), response.trim()), at, None, Some("plan"), Some(id))?;
        }
    }
    Ok(id)
}

/// 09:00 local del día indicado.
fn booster_time(ts: i64) -> i64 {
    let day = dates::ts_to_date(ts);
    let dt = day.and_hms_opt(9, 0, 0).unwrap();
    chrono::TimeZone::from_local_datetime(&chrono::Local, &dt).single().map(|t| t.timestamp()).unwrap_or(ts)
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Plan>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE p.id = ?1"), [id], map).optional()?)
}

pub fn list_for_goal(conn: &Connection, goal_id: Id, include_archived: bool) -> Result<Vec<Plan>> {
    let sql = format!("{SELECT} WHERE p.goal_id = ?1 {} ORDER BY p.archived_at IS NOT NULL, p.id", if include_archived { "" } else { "AND p.archived_at IS NULL" });
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map([goal_id], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn list_active(conn: &Connection) -> Result<Vec<Plan>> {
    let mut st = conn.prepare(&format!("{SELECT} WHERE p.archived_at IS NULL ORDER BY p.goal_id, p.id"))?;
    let rows = st.query_map([], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn update(conn: &Connection, id: Id, situation: &str, response: &str) -> Result<()> {
    conn.execute("UPDATE if_then_plans SET situation = ?2, response = ?3 WHERE id = ?1", params![id, situation.trim(), response.trim()])?;
    Ok(())
}

pub fn set_archived(conn: &Connection, id: Id, archived: bool) -> Result<()> {
    let v: Option<i64> = if archived { Some(dates::now_ts()) } else { None };
    conn.execute("UPDATE if_then_plans SET archived_at = ?2 WHERE id = ?1", params![id, v])?;
    if archived {
        // Los recordatorios de refuerzo pendientes dejan de tener sentido.
        conn.execute("UPDATE reminders SET done_at = ?2 WHERE ref_kind = 'plan' AND ref_id = ?1 AND done_at IS NULL", params![id, dates::now_ts()])?;
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM reminders WHERE ref_kind = 'plan' AND ref_id = ?1", [id])?;
    conn.execute("DELETE FROM if_then_plans WHERE id = ?1", [id])?;
    Ok(())
}

pub const HELPFUL: &[(&str, &str)] = &[("yes", "Sí, me sirvió"), ("partly", "En parte"), ("no", "No"), ("not_used", "No se dio la situación")];

/// Registra «¿Te sirvió este plan?». Devuelve `true` si conviene ofrecer archivarlo
/// (dos revisiones seguidas «no se dio la situación»).
pub fn review(conn: &Connection, id: Id, helpful: &str, note: &str) -> Result<bool> {
    let now = dates::now_ts();
    conn.execute("INSERT INTO plan_reviews(plan_id, at, helpful, note) VALUES (?1, ?2, ?3, ?4)", params![id, now, helpful, note])?;
    conn.execute("UPDATE if_then_plans SET last_reviewed_at = ?2 WHERE id = ?1", params![id, now])?;
    let mut st = conn.prepare("SELECT helpful FROM plan_reviews WHERE plan_id = ?1 ORDER BY at DESC LIMIT 2")?;
    let last: Vec<String> = st.query_map([id], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
    Ok(last.len() == 2 && last.iter().all(|h| h == "not_used"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn vagueness_check() {
        assert!(is_vague("cuando pueda"));
        assert!(is_vague(""));
        assert!(!is_vague("al llegar a casa a las 19:00"));
    }

    #[test]
    fn create_with_boosters_and_review() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let id = create(c, None, None, "al terminar de cenar", "pongo el libro en la mesa y leo una página", true).unwrap();
        let r = super::super::reminders::for_ref(c, "plan", id).unwrap();
        assert_eq!(r.len(), 2);
        assert!(r[0].due_at > dates::now_ts() + 6 * 86_400);
        assert!(!review(c, id, "not_used", "").unwrap());
        assert!(review(c, id, "not_used", "").unwrap(), "dos «no se dio» → ofrecer archivar");
        let p = get(c, id).unwrap().unwrap();
        assert_eq!(p.not_used, 2);
        set_archived(c, id, true).unwrap();
        assert!(super::super::reminders::for_ref(c, "plan", id).unwrap().is_empty());
        assert!(list_active(c).unwrap().is_empty());
    }
}
