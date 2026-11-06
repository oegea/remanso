//! Hitos: opcionales, definidos sobre conducta acumulada o valores de métrica,
//! reprogramables sin perder historial. Alcanzar un hito produce un mensaje
//! descriptivo; no alcanzarlo no produce ninguna evaluación.

use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MilestoneKind {
    /// Una métrica alcanza un valor (según la dirección de la métrica).
    MetricValue,
    /// Una acción acumula N registros hechos.
    ActionCount,
    /// Una acción alcanza su frecuencia durante N semanas (consecutivas).
    SustainWeeks,
    /// Llegar a una fecha.
    Date,
    /// Fase o criterio cualitativo: se marca a mano.
    Manual,
}

impl MilestoneKind {
    pub const ALL: [MilestoneKind; 5] = [MilestoneKind::Manual, MilestoneKind::ActionCount, MilestoneKind::SustainWeeks, MilestoneKind::MetricValue, MilestoneKind::Date];
    pub fn as_str(self) -> &'static str {
        match self {
            MilestoneKind::MetricValue => "metric_value",
            MilestoneKind::ActionCount => "action_count",
            MilestoneKind::SustainWeeks => "sustain_weeks",
            MilestoneKind::Date => "date",
            MilestoneKind::Manual => "manual",
        }
    }
    pub fn parse(s: &str) -> Self {
        match s {
            "metric_value" => MilestoneKind::MetricValue,
            "action_count" => MilestoneKind::ActionCount,
            "sustain_weeks" | "sustain_days" => MilestoneKind::SustainWeeks,
            "date" => MilestoneKind::Date,
            _ => MilestoneKind::Manual,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            MilestoneKind::MetricValue => "una métrica llega a un valor",
            MilestoneKind::ActionCount => "una acción acumula N veces",
            MilestoneKind::SustainWeeks => "mantener una acción N semanas",
            MilestoneKind::Date => "llegar a una fecha",
            MilestoneKind::Manual => "fase o criterio que marco yo",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MilestoneStatus {
    Pending,
    Reached,
    Dropped,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Milestone {
    pub id: Id,
    pub goal_id: Id,
    pub title: String,
    pub kind: MilestoneKind,
    pub metric_id: Option<Id>,
    pub action_id: Option<Id>,
    pub target_value: Option<f64>,
    pub target_day: Option<String>,
    pub position: i64,
    pub status: MilestoneStatus,
    pub reached_at: Option<i64>,
    pub notes: String,
}

const SELECT: &str = "SELECT id, goal_id, title, kind, metric_id, action_id, target_value, target_day, position, status, reached_at, notes FROM milestones";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Milestone> {
    Ok(Milestone {
        id: r.get(0)?,
        goal_id: r.get(1)?,
        title: r.get(2)?,
        kind: MilestoneKind::parse(&r.get::<_, String>(3)?),
        metric_id: r.get(4)?,
        action_id: r.get(5)?,
        target_value: r.get(6)?,
        target_day: r.get(7)?,
        position: r.get(8)?,
        status: match r.get::<_, String>(9)?.as_str() {
            "reached" => MilestoneStatus::Reached,
            "dropped" => MilestoneStatus::Dropped,
            _ => MilestoneStatus::Pending,
        },
        reached_at: r.get(10)?,
        notes: r.get(11)?,
    })
}

pub struct NewMilestone<'a> {
    pub goal_id: Id,
    pub title: &'a str,
    pub kind: MilestoneKind,
    pub metric_id: Option<Id>,
    pub action_id: Option<Id>,
    pub target_value: Option<f64>,
    pub target_day: Option<chrono::NaiveDate>,
}

pub fn create(conn: &Connection, m: NewMilestone) -> Result<Id> {
    let pos: i64 = conn.query_row("SELECT coalesce(max(position), 0) + 1 FROM milestones WHERE goal_id = ?1", [m.goal_id], |r| r.get(0))?;
    conn.execute(
        "INSERT INTO milestones(goal_id, title, kind, metric_id, action_id, target_value, target_day, position, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![m.goal_id, m.title.trim(), m.kind.as_str(), m.metric_id, m.action_id, m.target_value, m.target_day.map(dates::date_to_iso), pos, dates::now_ts()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Milestone>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], map).optional()?)
}

pub fn list_for_goal(conn: &Connection, goal_id: Id) -> Result<Vec<Milestone>> {
    let mut st = conn.prepare(&format!("{SELECT} WHERE goal_id = ?1 ORDER BY position, id"))?;
    let rows = st.query_map([goal_id], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn history(conn: &Connection, id: Id, field: &str, old: Option<String>, new: Option<String>, note: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO milestone_history(milestone_id, changed_at, field, old_value, new_value, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, dates::now_ts(), field, old, new, note],
    )?;
    Ok(())
}

/// Reprogramar conserva el historial de fechas y valores anteriores.
pub fn reschedule(conn: &Connection, id: Id, target_day: Option<chrono::NaiveDate>, note: &str) -> Result<()> {
    let Some(m) = get(conn, id)? else { return Ok(()) };
    let new = target_day.map(dates::date_to_iso);
    history(conn, id, "target_day", m.target_day.clone(), new.clone(), note)?;
    conn.execute("UPDATE milestones SET target_day = ?2 WHERE id = ?1", params![id, new])?;
    Ok(())
}

pub fn set_target_value(conn: &Connection, id: Id, v: Option<f64>, note: &str) -> Result<()> {
    let Some(m) = get(conn, id)? else { return Ok(()) };
    history(conn, id, "target_value", m.target_value.map(|x| x.to_string()), v.map(|x| x.to_string()), note)?;
    conn.execute("UPDATE milestones SET target_value = ?2 WHERE id = ?1", params![id, v])?;
    Ok(())
}

pub fn set_title(conn: &Connection, id: Id, title: &str) -> Result<()> {
    conn.execute("UPDATE milestones SET title = ?2 WHERE id = ?1", params![id, title.trim()])?;
    Ok(())
}

pub fn mark_reached(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("UPDATE milestones SET status = 'reached', reached_at = ?2 WHERE id = ?1 AND status != 'reached'", params![id, dates::now_ts()])?;
    Ok(())
}

pub fn mark_pending(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("UPDATE milestones SET status = 'pending', reached_at = NULL WHERE id = ?1", [id])?;
    Ok(())
}

pub fn mark_dropped(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("UPDATE milestones SET status = 'dropped' WHERE id = ?1", [id])?;
    Ok(())
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM milestones WHERE id = ?1", [id])?;
    Ok(())
}

pub fn history_of(conn: &Connection, id: Id) -> Result<Vec<(i64, String, Option<String>, Option<String>, String)>> {
    let mut st = conn.prepare("SELECT changed_at, field, old_value, new_value, note FROM milestone_history WHERE milestone_id = ?1 ORDER BY changed_at")?;
    let rows = st.query_map([id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Progreso descriptivo de un hito: (actual, objetivo) cuando es computable.
pub fn progress(conn: &Connection, m: &Milestone, today: chrono::NaiveDate) -> Result<Option<(f64, f64)>> {
    use super::{actions, metrics};
    Ok(match m.kind {
        MilestoneKind::ActionCount => match (m.action_id, m.target_value) {
            (Some(a), Some(t)) => Some((actions::total_done(conn, a)? as f64, t)),
            _ => None,
        },
        MilestoneKind::SustainWeeks => match (m.action_id, m.target_value) {
            (Some(a), Some(t)) => match actions::get(conn, a)? {
                Some(act) => Some((actions::summary(conn, &act, today)?.weeks_meeting_target as f64, t)),
                None => None,
            },
            _ => None,
        },
        MilestoneKind::MetricValue => match (m.metric_id, m.target_value) {
            (Some(mid), Some(t)) => match metrics::get(conn, mid)? {
                Some(met) => {
                    let series = metrics::daily_series(conn, &met, 3650)?;
                    series.last().map(|(_, v)| (*v, t))
                }
                None => None,
            },
            _ => None,
        },
        MilestoneKind::Date | MilestoneKind::Manual => None,
    })
}

/// Comprueba hitos automáticos y marca los alcanzados. Devuelve los recién alcanzados.
pub fn evaluate(conn: &Connection, goal_id: Id, today: chrono::NaiveDate) -> Result<Vec<Milestone>> {
    use super::metrics::{self, Direction};
    let mut newly = vec![];
    for m in list_for_goal(conn, goal_id)? {
        if m.status != MilestoneStatus::Pending {
            continue;
        }
        let reached = match m.kind {
            MilestoneKind::Date => m.target_day.as_deref().and_then(dates::parse_iso_date).map(|d| d <= today).unwrap_or(false),
            MilestoneKind::ActionCount | MilestoneKind::SustainWeeks => progress(conn, &m, today)?.map(|(c, t)| c >= t).unwrap_or(false),
            MilestoneKind::MetricValue => match (m.metric_id, m.target_value) {
                (Some(mid), Some(t)) => match metrics::get(conn, mid)? {
                    Some(met) => {
                        let series = metrics::daily_series(conn, &met, 3650)?;
                        // Para métricas ruidosas se usa la tendencia (media de 7 días), no el último punto.
                        let current = crate::analysis::trend::current_level(&series, met.kind);
                        match (current, met.direction) {
                            (Some(c), Direction::Down) => c <= t,
                            (Some(c), _) => c >= t,
                            (None, _) => false,
                        }
                    }
                    None => false,
                },
                _ => false,
            },
            MilestoneKind::Manual => false,
        };
        if reached {
            mark_reached(conn, m.id)?;
            newly.push(get(conn, m.id)?.unwrap());
        }
    }
    Ok(newly)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::actions::{self, Schedule};
    use crate::domain::goals::{self, GoalKind};
    use crate::storage::test_support::temp_db;

    #[test]
    fn action_count_milestone_and_history() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let g = goals::create(c, "Correr", GoalKind::Process, "activity").unwrap();
        let a = actions::create(c, Some(g), "Salir a correr", &Schedule::PerWeek(2), false).unwrap();
        let m = create(c, NewMilestone { goal_id: g, title: "Diez salidas", kind: MilestoneKind::ActionCount, metric_id: None, action_id: Some(a), target_value: Some(3.0), target_day: None }).unwrap();
        let today = dates::today();
        assert!(evaluate(c, g, today).unwrap().is_empty());
        for i in 0..3 {
            actions::log(c, a, today - chrono::Duration::days(i), Some(true), "").unwrap();
        }
        assert_eq!(progress(c, &get(c, m).unwrap().unwrap(), today).unwrap(), Some((3.0, 3.0)));
        let reached = evaluate(c, g, today).unwrap();
        assert_eq!(reached.len(), 1);
        assert_eq!(reached[0].status, MilestoneStatus::Reached);
        assert!(evaluate(c, g, today).unwrap().is_empty(), "no se repite");

        let d = create(c, NewMilestone { goal_id: g, title: "Fecha", kind: MilestoneKind::Date, metric_id: None, action_id: None, target_value: None, target_day: Some(today + chrono::Duration::days(10)) }).unwrap();
        reschedule(c, d, Some(today + chrono::Duration::days(20)), "necesito más tiempo").unwrap();
        let h = history_of(c, d).unwrap();
        assert_eq!(h.len(), 1);
        assert_eq!(h[0].4, "necesito más tiempo");
        assert_eq!(get(c, d).unwrap().unwrap().target_day, Some(dates::date_to_iso(today + chrono::Duration::days(20))));
    }
}
