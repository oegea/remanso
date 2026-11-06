//! Objetivos: motor genérico, sin pantallas específicas por tipo de cambio.

use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalStatus {
    Active,
    Paused,
    Achieved,
    Closed,
}

impl GoalStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            GoalStatus::Active => "active",
            GoalStatus::Paused => "paused",
            GoalStatus::Achieved => "achieved",
            GoalStatus::Closed => "closed",
        }
    }
    pub fn parse(s: &str) -> Self {
        match s {
            "paused" => GoalStatus::Paused,
            "achieved" => GoalStatus::Achieved,
            "closed" => GoalStatus::Closed,
            _ => GoalStatus::Active,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            GoalStatus::Active => "activo",
            GoalStatus::Paused => "pausado",
            GoalStatus::Achieved => "alcanzado",
            GoalStatus::Closed => "cerrado",
        }
    }
}

/// Tipo de meta (nota C: proceso por defecto; Freund & Hennecke; Harkin).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalKind {
    Process,
    Outcome,
    Learning,
}

impl GoalKind {
    pub fn as_str(self) -> &'static str {
        match self {
            GoalKind::Process => "process",
            GoalKind::Outcome => "outcome",
            GoalKind::Learning => "learning",
        }
    }
    pub fn parse(s: &str) -> Self {
        match s {
            "outcome" => GoalKind::Outcome,
            "learning" => GoalKind::Learning,
            _ => GoalKind::Process,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            GoalKind::Process => "proceso (hacer algo con regularidad)",
            GoalKind::Outcome => "resultado (llegar a un valor o estado)",
            GoalKind::Learning => "aprendizaje (adquirir una habilidad)",
        }
    }
    pub const ALL: [GoalKind; 3] = [GoalKind::Process, GoalKind::Outcome, GoalKind::Learning];
}

/// Categorías cerradas. Las marcadas como `red_flag` activan, una sola vez, el
/// mensaje de derivación no bloqueante (docs/research/safety.md §3.2–3.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Category {
    pub key: &'static str,
    pub label: &'static str,
    pub sensitive: bool,
    pub red_flag: Option<RedFlag>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedFlag {
    Substance,
    Eating,
    SelfHarm,
    Gambling,
    Suicidal,
}

pub const CATEGORIES: &[Category] = &[
    Category { key: "general", label: "General", sensitive: false, red_flag: None },
    Category { key: "project", label: "Proyecto personal (escribir, crear, estudiar)", sensitive: false, red_flag: None },
    Category { key: "activity", label: "Actividad física", sensitive: false, red_flag: None },
    Category { key: "sleep", label: "Sueño y descanso", sensitive: false, red_flag: None },
    Category { key: "learning", label: "Aprender una habilidad", sensitive: false, red_flag: None },
    Category { key: "time", label: "Gestión del tiempo y hábitos de trabajo", sensitive: false, red_flag: None },
    Category { key: "reduce", label: "Reducir una conducta (móvil, compras, picoteo…)", sensitive: false, red_flag: None },
    Category { key: "food_weight", label: "Controlar lo que como o mi peso", sensitive: true, red_flag: Some(RedFlag::Eating) },
    Category { key: "substance", label: "Dejar de beber alcohol o de consumir una sustancia", sensitive: true, red_flag: Some(RedFlag::Substance) },
    Category { key: "gambling", label: "Dejar de apostar", sensitive: true, red_flag: Some(RedFlag::Gambling) },
    Category { key: "self_harm", label: "Dejar de hacerme daño", sensitive: true, red_flag: Some(RedFlag::SelfHarm) },
];
// Nota: no existe una categoría «dejar de tener pensamientos de muerte»: convertirlo en
// «objetivo» banaliza algo que necesita acompañamiento profesional. La ayuda se ofrece
// desde «Si necesitas ayuda» y desde la categoría de autolesión.

pub fn category(key: &str) -> Category {
    CATEGORIES.iter().copied().find(|c| c.key == key).unwrap_or(CATEGORIES[0])
}

#[derive(Debug, Clone, PartialEq)]
pub struct Goal {
    pub id: Id,
    pub name: String,
    pub description: String,
    pub why: String,
    pub success_criteria: String,
    pub status: GoalStatus,
    pub kind: GoalKind,
    pub category: String,
    pub context: String,
    pub started_on: String,
    pub horizon_on: Option<String>,
    pub review_every_days: Option<i64>,
    pub last_reviewed_at: Option<i64>,
    pub notebook_id: Option<Id>,
    pub close_reason: Option<String>,
    pub safety_shown: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

const SELECT: &str = "SELECT id, name, description, why, success_criteria, status, kind, category, context, started_on, horizon_on,
    review_every_days, last_reviewed_at, notebook_id, close_reason, safety_shown, created_at, updated_at FROM goals";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Goal> {
    Ok(Goal {
        id: r.get(0)?,
        name: r.get(1)?,
        description: r.get(2)?,
        why: r.get(3)?,
        success_criteria: r.get(4)?,
        status: GoalStatus::parse(&r.get::<_, String>(5)?),
        kind: GoalKind::parse(&r.get::<_, String>(6)?),
        category: r.get(7)?,
        context: r.get(8)?,
        started_on: r.get(9)?,
        horizon_on: r.get(10)?,
        review_every_days: r.get(11)?,
        last_reviewed_at: r.get(12)?,
        notebook_id: r.get(13)?,
        close_reason: r.get(14)?,
        safety_shown: r.get::<_, i64>(15)? != 0,
        created_at: r.get(16)?,
        updated_at: r.get(17)?,
    })
}

pub fn create(conn: &Connection, name: &str, kind: GoalKind, category: &str) -> Result<Id> {
    let now = dates::now_ts();
    conn.execute(
        "INSERT INTO goals(name, kind, category, started_on, review_every_days, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 7, ?5, ?5)",
        params![name.trim(), kind.as_str(), category, dates::date_to_iso(dates::today()), now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Goal>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE id = ?1"), [id], map).optional()?)
}

pub fn list(conn: &Connection, include_closed: bool) -> Result<Vec<Goal>> {
    let sql = format!(
        "{SELECT} WHERE archived_at IS NULL {} ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, updated_at DESC",
        if include_closed { "" } else { "AND status IN ('active','paused')" }
    );
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map([], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn active_count(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("SELECT count(*) FROM goals WHERE status = 'active' AND archived_at IS NULL", [], |r| r.get(0))?)
}

fn set(conn: &Connection, id: Id, field: &str, v: impl rusqlite::ToSql) -> Result<()> {
    conn.execute(&format!("UPDATE goals SET {field} = ?2, updated_at = ?3 WHERE id = ?1"), params![id, v, dates::now_ts()])?;
    Ok(())
}

pub fn set_name(conn: &Connection, id: Id, v: &str) -> Result<()> {
    set(conn, id, "name", v.trim())
}
pub fn set_description(conn: &Connection, id: Id, v: &str) -> Result<()> {
    set(conn, id, "description", v)
}
pub fn set_why(conn: &Connection, id: Id, v: &str) -> Result<()> {
    set(conn, id, "why", v)
}
pub fn set_success_criteria(conn: &Connection, id: Id, v: &str) -> Result<()> {
    set(conn, id, "success_criteria", v)
}
pub fn set_context(conn: &Connection, id: Id, v: &str) -> Result<()> {
    set(conn, id, "context", v)
}
pub fn set_kind(conn: &Connection, id: Id, k: GoalKind) -> Result<()> {
    set(conn, id, "kind", k.as_str())
}
pub fn set_category(conn: &Connection, id: Id, c: &str) -> Result<()> {
    set(conn, id, "category", c)
}
pub fn set_horizon(conn: &Connection, id: Id, d: Option<chrono::NaiveDate>) -> Result<()> {
    set(conn, id, "horizon_on", d.map(dates::date_to_iso))
}
pub fn set_review_every(conn: &Connection, id: Id, days: Option<i64>) -> Result<()> {
    set(conn, id, "review_every_days", days)
}
pub fn set_notebook(conn: &Connection, id: Id, nb: Option<Id>) -> Result<()> {
    set(conn, id, "notebook_id", nb)
}
pub fn mark_safety_shown(conn: &Connection, id: Id) -> Result<()> {
    set(conn, id, "safety_shown", 1)
}
pub fn mark_reviewed(conn: &Connection, id: Id) -> Result<()> {
    set(conn, id, "last_reviewed_at", dates::now_ts())
}

/// Cambia el estado. Cerrar pide un motivo de una lista neutra; nunca es un «fallo».
pub fn set_status(conn: &Connection, id: Id, status: GoalStatus, close_reason: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE goals SET status = ?2, close_reason = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, status.as_str(), close_reason, dates::now_ts()],
    )?;
    Ok(())
}

pub const CLOSE_REASONS: &[(&str, &str)] = &[
    ("achieved", "alcanzado"),
    ("replaced", "sustituido por otro objetivo"),
    ("unreachable", "no es alcanzable ahora"),
    ("not_important", "ya no me importa"),
];

pub fn close_reason_label(key: &str) -> &'static str {
    CLOSE_REASONS.iter().find(|(k, _)| *k == key).map(|(_, l)| *l).unwrap_or("cerrado")
}

pub fn archive(conn: &Connection, id: Id) -> Result<()> {
    set(conn, id, "archived_at", dates::now_ts())
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM goals WHERE id = ?1", [id])?;
    Ok(())
}

/// Objetivos activos cuya revisión periódica toca (nunca se marca como «vencida»).
pub fn due_for_review(conn: &Connection, now: i64) -> Result<Vec<Goal>> {
    let mut st = conn.prepare(&format!(
        "{SELECT} WHERE status = 'active' AND archived_at IS NULL AND review_every_days IS NOT NULL
         AND coalesce(last_reviewed_at, created_at) + review_every_days * 86400 <= ?1 ORDER BY coalesce(last_reviewed_at, created_at)"
    ))?;
    let rows = st.query_map([now], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn lifecycle() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let id = create(c, "Leer 20 minutos", GoalKind::Process, "project").unwrap();
        set_why(c, id, "Quiero volver a disfrutar de los libros").unwrap();
        let g = get(c, id).unwrap().unwrap();
        assert_eq!(g.kind, GoalKind::Process);
        assert_eq!(g.status, GoalStatus::Active);
        assert_eq!(g.review_every_days, Some(7));
        assert_eq!(active_count(c).unwrap(), 1);
        set_status(c, id, GoalStatus::Paused, None).unwrap();
        assert_eq!(list(c, false).unwrap().len(), 1);
        set_status(c, id, GoalStatus::Closed, Some("not_important")).unwrap();
        assert!(list(c, false).unwrap().is_empty());
        let g = list(c, true).unwrap().remove(0);
        assert_eq!(close_reason_label(g.close_reason.as_deref().unwrap()), "ya no me importa");
    }

    #[test]
    fn review_due() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let id = create(c, "x", GoalKind::Process, "general").unwrap();
        let now = dates::now_ts();
        assert!(due_for_review(c, now).unwrap().is_empty());
        assert_eq!(due_for_review(c, now + 8 * 86_400).unwrap().len(), 1);
        mark_reviewed(c, id).unwrap();
        assert!(due_for_review(c, now + 6 * 86_400).unwrap().is_empty());
        assert_eq!(due_for_review(c, now + 8 * 86_400).unwrap().len(), 1);
    }

    #[test]
    fn categories_flag_safety() {
        assert!(category("substance").red_flag.is_some());
        assert!(category("food_weight").sensitive);
        assert!(category("project").red_flag.is_none());
        assert_eq!(category("desconocida").key, "general");
    }
}
