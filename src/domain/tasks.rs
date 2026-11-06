//! Tareas y proyectos. Una tarea aplazada nunca se marca «fallida»: sólo
//! «pendiente» con su fecha original y un contador neutro de aplazamientos.

use chrono::NaiveDate;
use rusqlite::{params, Connection, OptionalExtension};

use super::recurrence::Rule;
use super::Id;
use crate::dates;
use crate::storage::Result;

pub const POSTPONE_REVIEW_THRESHOLD: i64 = 3;

#[derive(Debug, Clone, PartialEq)]
pub struct Task {
    pub id: Id,
    pub project_id: Option<Id>,
    pub parent_id: Option<Id>,
    pub goal_id: Option<Id>,
    pub title: String,
    pub notes: String,
    pub status: Status,
    pub priority: i64,
    pub due_day: Option<String>,
    pub scheduled_day: Option<String>,
    pub recurrence: Option<Rule>,
    pub postpone_count: i64,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub subtasks_total: i64,
    pub subtasks_done: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Open,
    Done,
    Dropped,
}

impl Status {
    fn as_str(self) -> &'static str {
        match self {
            Status::Open => "open",
            Status::Done => "done",
            Status::Dropped => "dropped",
        }
    }
    fn parse(s: &str) -> Status {
        match s {
            "done" => Status::Done,
            "dropped" => Status::Dropped,
            _ => Status::Open,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Project {
    pub id: Id,
    pub name: String,
    pub description: String,
    pub goal_id: Option<Id>,
    pub archived: bool,
    pub open_tasks: i64,
    pub done_tasks: i64,
}

const SELECT: &str = "SELECT t.id, t.project_id, t.parent_id, t.goal_id, t.title, t.notes, t.status, t.priority, t.due_day,
    t.scheduled_day, t.recurrence, t.postpone_count, t.created_at, t.completed_at,
    (SELECT count(*) FROM tasks c WHERE c.parent_id = t.id AND c.status != 'dropped'),
    (SELECT count(*) FROM tasks c WHERE c.parent_id = t.id AND c.status = 'done')
    FROM tasks t";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: r.get(0)?,
        project_id: r.get(1)?,
        parent_id: r.get(2)?,
        goal_id: r.get(3)?,
        title: r.get(4)?,
        notes: r.get(5)?,
        status: Status::parse(&r.get::<_, String>(6)?),
        priority: r.get(7)?,
        due_day: r.get(8)?,
        scheduled_day: r.get(9)?,
        recurrence: r.get::<_, Option<String>>(10)?.and_then(|s| Rule::parse(&s)),
        postpone_count: r.get(11)?,
        created_at: r.get(12)?,
        completed_at: r.get(13)?,
        subtasks_total: r.get(14)?,
        subtasks_done: r.get(15)?,
    })
}

#[derive(Debug, Default, Clone)]
pub struct NewTask<'a> {
    pub title: &'a str,
    pub scheduled_day: Option<NaiveDate>,
    pub due_day: Option<NaiveDate>,
    pub project_id: Option<Id>,
    pub parent_id: Option<Id>,
    pub goal_id: Option<Id>,
}

pub fn create(conn: &Connection, t: NewTask) -> Result<Id> {
    let now = dates::now_ts();
    conn.execute(
        "INSERT INTO tasks(project_id, parent_id, goal_id, title, scheduled_day, due_day, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![
            t.project_id,
            t.parent_id,
            t.goal_id,
            t.title.trim(),
            t.scheduled_day.map(dates::date_to_iso),
            t.due_day.map(dates::date_to_iso),
            now
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Task>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE t.id = ?1"), [id], map).optional()?)
}

pub fn set_title(conn: &Connection, id: Id, title: &str) -> Result<()> {
    touch(conn, id, "title", title.trim())
}

pub fn set_notes(conn: &Connection, id: Id, notes: &str) -> Result<()> {
    touch(conn, id, "notes", notes)
}

fn touch(conn: &Connection, id: Id, field: &str, value: impl rusqlite::ToSql) -> Result<()> {
    conn.execute(
        &format!("UPDATE tasks SET {field} = ?2, updated_at = ?3 WHERE id = ?1"),
        params![id, value, dates::now_ts()],
    )?;
    Ok(())
}

pub fn set_priority(conn: &Connection, id: Id, priority: i64) -> Result<()> {
    touch(conn, id, "priority", priority.clamp(-1, 1))
}

pub fn set_scheduled(conn: &Connection, id: Id, day: Option<NaiveDate>) -> Result<()> {
    touch(conn, id, "scheduled_day", day.map(dates::date_to_iso))
}

pub fn set_due(conn: &Connection, id: Id, day: Option<NaiveDate>) -> Result<()> {
    touch(conn, id, "due_day", day.map(dates::date_to_iso))
}

pub fn set_recurrence(conn: &Connection, id: Id, rule: Option<&Rule>) -> Result<()> {
    touch(conn, id, "recurrence", rule.map(|r| r.to_storage()))
}

pub fn set_project(conn: &Connection, id: Id, project_id: Option<Id>) -> Result<()> {
    touch(conn, id, "project_id", project_id)
}

pub fn set_goal(conn: &Connection, id: Id, goal_id: Option<Id>) -> Result<()> {
    touch(conn, id, "goal_id", goal_id)
}

/// Aplazar: cambia el día previsto y cuenta el aplazamiento. Devuelve el nuevo
/// contador para que la interfaz ofrezca la revisión al llegar al umbral.
pub fn postpone(conn: &Connection, id: Id, to: NaiveDate) -> Result<i64> {
    conn.execute(
        "UPDATE tasks SET scheduled_day = ?2, postpone_count = postpone_count + 1, last_postponed_at = ?3, updated_at = ?3 WHERE id = ?1",
        params![id, dates::date_to_iso(to), dates::now_ts()],
    )?;
    Ok(conn.query_row("SELECT postpone_count FROM tasks WHERE id = ?1", [id], |r| r.get(0))?)
}

/// Completa la tarea. Si es recurrente, crea la siguiente aparición y devuelve su id.
pub fn complete(conn: &Connection, id: Id) -> Result<Option<Id>> {
    let Some(t) = get(conn, id)? else { return Ok(None) };
    let now = dates::now_ts();
    conn.execute("UPDATE tasks SET status = 'done', completed_at = ?2, updated_at = ?2 WHERE id = ?1", params![id, now])?;
    if let Some(rule) = &t.recurrence {
        let base = t
            .scheduled_day
            .as_deref()
            .or(t.due_day.as_deref())
            .and_then(dates::parse_iso_date)
            .unwrap_or_else(dates::today);
        // Si la base quedó en el pasado, la siguiente se calcula desde hoy para no
        // generar una cola de apariciones «vencidas».
        let base = base.max(dates::today());
        let next = rule.next_after(base);
        conn.execute(
            "INSERT INTO tasks(project_id, parent_id, goal_id, title, notes, priority, scheduled_day, due_day, recurrence, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
            params![
                t.project_id,
                t.parent_id,
                t.goal_id,
                t.title,
                t.notes,
                t.priority,
                dates::date_to_iso(next),
                t.due_day.as_deref().map(|_| dates::date_to_iso(next)),
                rule.to_storage(),
                now
            ],
        )?;
        return Ok(Some(conn.last_insert_rowid()));
    }
    Ok(None)
}

pub fn reopen(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("UPDATE tasks SET status = 'open', completed_at = NULL, updated_at = ?2 WHERE id = ?1", params![id, dates::now_ts()])?;
    Ok(())
}

/// Cerrar sin hacer («ya no importa»): decisión del usuario, no un fallo.
pub fn drop_task(conn: &Connection, id: Id, closing_note: &str) -> Result<()> {
    let now = dates::now_ts();
    if closing_note.trim().is_empty() {
        conn.execute("UPDATE tasks SET status = 'dropped', completed_at = ?2, updated_at = ?2 WHERE id = ?1", params![id, now])?;
    } else {
        conn.execute(
            "UPDATE tasks SET status = 'dropped', completed_at = ?2, updated_at = ?2,
             notes = CASE WHEN notes = '' THEN ?3 ELSE notes || char(10) || char(10) || ?3 END WHERE id = ?1",
            params![id, now, format!("Cerrada: {}", closing_note.trim())],
        )?;
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])?;
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum View {
    /// Previstas o vencidas hasta hoy (incluye las de días pasados como «pendientes»).
    Today,
    /// Próximos 7 días (sin las de hoy).
    Upcoming,
    /// Sin fecha.
    Someday,
    /// Completadas o cerradas recientemente.
    Done,
}

pub fn list(conn: &Connection, view: View, today: NaiveDate, project: Option<Id>) -> Result<Vec<Task>> {
    let t = dates::date_to_iso(today);
    let week = dates::date_to_iso(today + chrono::Duration::days(7));
    let proj = match project {
        Some(p) => format!("AND t.project_id = {p}"),
        None => String::new(),
    };
    let sql = match view {
        View::Today => format!(
            "{SELECT} WHERE t.status = 'open' AND t.parent_id IS NULL {proj}
             AND ((t.scheduled_day IS NOT NULL AND t.scheduled_day <= ?1) OR (t.due_day IS NOT NULL AND t.due_day <= ?1))
             ORDER BY t.priority DESC, coalesce(t.due_day, t.scheduled_day), t.created_at"
        ),
        View::Upcoming => format!(
            "{SELECT} WHERE t.status = 'open' AND t.parent_id IS NULL {proj}
             AND coalesce(min(t.scheduled_day, t.due_day), t.scheduled_day, t.due_day) > ?1
             AND coalesce(min(t.scheduled_day, t.due_day), t.scheduled_day, t.due_day) <= ?2
             ORDER BY coalesce(min(t.scheduled_day, t.due_day), t.scheduled_day, t.due_day), t.priority DESC, t.created_at"
        ),
        View::Someday => format!(
            "{SELECT} WHERE t.status = 'open' AND t.parent_id IS NULL {proj}
             AND t.scheduled_day IS NULL AND t.due_day IS NULL
             ORDER BY t.priority DESC, t.created_at"
        ),
        View::Done => format!(
            "{SELECT} WHERE t.status != 'open' AND t.parent_id IS NULL {proj}
             ORDER BY t.completed_at DESC LIMIT 200"
        ),
    };
    let mut st = conn.prepare(&sql)?;
    let rows = match view {
        View::Today => st.query_map(params![t], map)?,
        View::Upcoming => st.query_map(params![t, week], map)?,
        _ => st.query_map([], map)?,
    };
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Todas las tareas abiertas de un proyecto (sin fecha también), para su ficha.
pub fn list_for_project(conn: &Connection, project_id: Id) -> Result<Vec<Task>> {
    let mut st = conn.prepare(&format!(
        "{SELECT} WHERE t.project_id = ?1 AND t.parent_id IS NULL
         ORDER BY t.status = 'open' DESC, t.priority DESC, coalesce(t.scheduled_day, t.due_day, '9999'), t.created_at"
    ))?;
    let rows = st.query_map([project_id], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn list_for_goal(conn: &Connection, goal_id: Id) -> Result<Vec<Task>> {
    let mut st = conn.prepare(&format!(
        "{SELECT} WHERE t.goal_id = ?1 AND t.parent_id IS NULL AND t.status = 'open'
         ORDER BY t.priority DESC, coalesce(t.scheduled_day, t.due_day, '9999'), t.created_at"
    ))?;
    let rows = st.query_map([goal_id], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn subtasks(conn: &Connection, parent_id: Id) -> Result<Vec<Task>> {
    let mut st = conn.prepare(&format!("{SELECT} WHERE t.parent_id = ?1 ORDER BY t.status = 'open' DESC, t.created_at"))?;
    let rows = st.query_map([parent_id], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Tareas de un día concreto (previstas o con fecha límite), para el calendario.
pub fn on_day(conn: &Connection, day: NaiveDate) -> Result<Vec<Task>> {
    let d = dates::date_to_iso(day);
    let mut st = conn.prepare(&format!(
        "{SELECT} WHERE t.parent_id IS NULL AND (t.scheduled_day = ?1 OR t.due_day = ?1) ORDER BY t.status = 'open' DESC, t.priority DESC"
    ))?;
    let rows = st.query_map([d], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Días con tareas abiertas en un rango (para marcar el calendario).
pub fn days_with_tasks(conn: &Connection, from: NaiveDate, to: NaiveDate) -> Result<Vec<(String, i64)>> {
    let mut st = conn.prepare(
        "SELECT d, count(*) FROM (
            SELECT coalesce(scheduled_day, due_day) AS d FROM tasks WHERE status = 'open' AND parent_id IS NULL
         ) WHERE d BETWEEN ?1 AND ?2 GROUP BY d",
    )?;
    let rows = st.query_map([dates::date_to_iso(from), dates::date_to_iso(to)], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn count_pending(conn: &Connection, today: NaiveDate) -> Result<i64> {
    Ok(conn.query_row(
        "SELECT count(*) FROM tasks WHERE status = 'open' AND parent_id IS NULL
         AND ((scheduled_day IS NOT NULL AND scheduled_day <= ?1) OR (due_day IS NOT NULL AND due_day <= ?1))",
        [dates::date_to_iso(today)],
        |r| r.get(0),
    )?)
}

/// Tareas abiertas aplazadas al menos `threshold` veces.
pub fn postponed_often(conn: &Connection, threshold: i64) -> Result<Vec<Task>> {
    let mut st = conn.prepare(&format!("{SELECT} WHERE t.status = 'open' AND t.postpone_count >= ?1 ORDER BY t.postpone_count DESC"))?;
    let rows = st.query_map([threshold], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

// ---- proyectos ---------------------------------------------------------------

pub fn create_project(conn: &Connection, name: &str, goal_id: Option<Id>) -> Result<Id> {
    conn.execute(
        "INSERT INTO projects(name, goal_id, created_at) VALUES (?1, ?2, ?3)",
        params![name.trim(), goal_id, dates::now_ts()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn rename_project(conn: &Connection, id: Id, name: &str) -> Result<()> {
    conn.execute("UPDATE projects SET name = ?2 WHERE id = ?1", params![id, name.trim()])?;
    Ok(())
}

pub fn set_project_archived(conn: &Connection, id: Id, archived: bool) -> Result<()> {
    let v: Option<i64> = if archived { Some(dates::now_ts()) } else { None };
    conn.execute("UPDATE projects SET archived_at = ?2 WHERE id = ?1", params![id, v])?;
    Ok(())
}

pub fn delete_project(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM projects WHERE id = ?1", [id])?;
    Ok(())
}

pub fn list_projects(conn: &Connection, include_archived: bool) -> Result<Vec<Project>> {
    let sql = format!(
        "SELECT p.id, p.name, p.description, p.goal_id, p.archived_at,
            (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'open'),
            (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done')
         FROM projects p {} ORDER BY p.archived_at IS NOT NULL, p.name",
        if include_archived { "" } else { "WHERE p.archived_at IS NULL" }
    );
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map([], |r| {
        Ok(Project {
            id: r.get(0)?,
            name: r.get(1)?,
            description: r.get(2)?,
            goal_id: r.get(3)?,
            archived: r.get::<_, Option<i64>>(4)?.is_some(),
            open_tasks: r.get(5)?,
            done_tasks: r.get(6)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn project_name(conn: &Connection, id: Id) -> Result<Option<String>> {
    Ok(conn.query_row("SELECT name FROM projects WHERE id = ?1", [id], |r| r.get(0)).optional()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn views_and_postpone() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let today = d("2026-11-05");
        let a = create(c, NewTask { title: "Llamar al médico", scheduled_day: Some(d("2026-11-03")), ..Default::default() }).unwrap();
        let b = create(c, NewTask { title: "Comprar pan", scheduled_day: Some(today), ..Default::default() }).unwrap();
        let _c = create(c, NewTask { title: "Leer informe", scheduled_day: Some(d("2026-11-09")), ..Default::default() }).unwrap();
        let s = create(c, NewTask { title: "Aprender a dibujar", ..Default::default() }).unwrap();
        set_priority(c, b, 1).unwrap();

        let t = list(c, View::Today, today, None).unwrap();
        assert_eq!(t.iter().map(|x| x.id).collect::<Vec<_>>(), vec![b, a], "prioridad primero; la vencida sigue siendo pendiente");
        assert_eq!(list(c, View::Upcoming, today, None).unwrap().len(), 1);
        assert_eq!(list(c, View::Someday, today, None).unwrap()[0].id, s);
        assert_eq!(count_pending(c, today).unwrap(), 2);

        for _ in 0..3 {
            postpone(c, a, d("2026-11-10")).unwrap();
        }
        let a2 = get(c, a).unwrap().unwrap();
        assert_eq!(a2.postpone_count, 3);
        assert_eq!(a2.scheduled_day.as_deref(), Some("2026-11-10"));
        assert_eq!(postponed_often(c, POSTPONE_REVIEW_THRESHOLD).unwrap().len(), 1);
        assert_eq!(list(c, View::Today, today, None).unwrap().len(), 1);
    }

    #[test]
    fn recurring_completion_spawns_next() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let today = dates::today();
        let id = create(c, NewTask { title: "Regar", scheduled_day: Some(today), ..Default::default() }).unwrap();
        set_recurrence(c, id, Some(&Rule::Every(3, super::super::recurrence::Unit::Days))).unwrap();
        let next = complete(c, id).unwrap().expect("debe crear la siguiente");
        let n = get(c, next).unwrap().unwrap();
        assert_eq!(n.scheduled_day.as_deref(), Some(dates::date_to_iso(today + chrono::Duration::days(3)).as_str()));
        assert_eq!(n.recurrence, Some(Rule::Every(3, super::super::recurrence::Unit::Days)));
        assert_eq!(get(c, id).unwrap().unwrap().status, Status::Done);
        assert_eq!(list(c, View::Done, today, None).unwrap().len(), 1);
        reopen(c, id).unwrap();
        assert_eq!(get(c, id).unwrap().unwrap().status, Status::Open);
    }

    #[test]
    fn subtasks_and_projects() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let p = create_project(c, "Libro", None).unwrap();
        let t = create(c, NewTask { title: "Capítulo 1", project_id: Some(p), ..Default::default() }).unwrap();
        let s1 = create(c, NewTask { title: "Esquema", parent_id: Some(t), project_id: Some(p), ..Default::default() }).unwrap();
        let _s2 = create(c, NewTask { title: "Borrador", parent_id: Some(t), project_id: Some(p), ..Default::default() }).unwrap();
        complete(c, s1).unwrap();
        let task = get(c, t).unwrap().unwrap();
        assert_eq!((task.subtasks_total, task.subtasks_done), (2, 1));
        assert_eq!(subtasks(c, t).unwrap().len(), 2);
        let projects = list_projects(c, false).unwrap();
        assert_eq!(projects[0].open_tasks, 2); // tarea + subtarea abierta
        assert_eq!(list_for_project(c, p).unwrap().len(), 1, "sólo tareas de primer nivel");
        drop_task(c, t, "ya no me interesa").unwrap();
        let task = get(c, t).unwrap().unwrap();
        assert_eq!(task.status, Status::Dropped);
        assert!(task.notes.contains("Cerrada: ya no me interesa"));
        delete_project(c, p).unwrap();
        assert!(get(c, t).unwrap().unwrap().project_id.is_none(), "la tarea sobrevive al proyecto");
    }

    #[test]
    fn calendar_queries() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        create(c, NewTask { title: "a", scheduled_day: Some(d("2026-11-10")), ..Default::default() }).unwrap();
        create(c, NewTask { title: "b", due_day: Some(d("2026-11-10")), ..Default::default() }).unwrap();
        create(c, NewTask { title: "c", scheduled_day: Some(d("2026-11-12")), ..Default::default() }).unwrap();
        assert_eq!(on_day(c, d("2026-11-10")).unwrap().len(), 2);
        let days = days_with_tasks(c, d("2026-11-01"), d("2026-11-30")).unwrap();
        assert_eq!(days, vec![("2026-11-10".to_string(), 2), ("2026-11-12".to_string(), 1)]);
    }
}
