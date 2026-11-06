//! Preguntas de reflexión recurrentes (interventions.md §d). Nada se instala por
//! defecto: cada conjunto se activa desde Ajustes y se puede editar o archivar.
//! Regla: una sesión guiada al día como máximo y ≤ 3 preguntas por pantalla.

use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PromptKind {
    Free,
    Scale,
    Choice,
}

impl PromptKind {
    fn as_str(self) -> &'static str {
        match self {
            PromptKind::Free => "free",
            PromptKind::Scale => "scale",
            PromptKind::Choice => "choice",
        }
    }
    fn parse(s: &str) -> Self {
        match s {
            "scale" => PromptKind::Scale,
            "choice" => PromptKind::Choice,
            _ => PromptKind::Free,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Prompt {
    pub id: Id,
    pub text: String,
    pub kind: PromptKind,
    /// Para `choice`: opciones separadas por «|». Para `scale`: «min|max».
    pub options: Option<String>,
    pub schedule: String,
    pub goal_id: Option<Id>,
    pub source_ref: String,
    pub position: i64,
    pub archived: bool,
}

impl Prompt {
    pub fn choices(&self) -> Vec<String> {
        self.options.as_deref().unwrap_or("").split('|').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
    }
}

const SELECT: &str = "SELECT id, text, kind, options, schedule, goal_id, source_ref, position, archived_at FROM prompts";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Prompt> {
    Ok(Prompt {
        id: r.get(0)?,
        text: r.get(1)?,
        kind: PromptKind::parse(&r.get::<_, String>(2)?),
        options: r.get(3)?,
        schedule: r.get(4)?,
        goal_id: r.get(5)?,
        source_ref: r.get(6)?,
        position: r.get(7)?,
        archived: r.get::<_, Option<i64>>(8)?.is_some(),
    })
}

pub struct Template {
    pub text: &'static str,
    pub kind: PromptKind,
    pub options: Option<&'static str>,
    pub source_ref: &'static str,
}

/// Conjuntos por defecto (texto literal de interventions.md §d).
pub fn templates(schedule: &str) -> &'static [Template] {
    match schedule {
        "open" => &[
            Template { text: "¿Qué es lo único que, si lo haces hoy, hará que el día valga la pena?", kind: PromptKind::Free, options: None, source_ref: "apertura_del_dia" },
            Template { text: "¿Qué puede complicarse hoy y qué harás si pasa?", kind: PromptKind::Free, options: None, source_ref: "plan_si_entonces" },
        ],
        "close" => &[
            Template { text: "¿Qué pasó hoy que quieras recordar?", kind: PromptKind::Free, options: None, source_ref: "cierre_del_dia" },
            Template { text: "Una cosa que fue bien hoy, y qué hizo que fuera bien.", kind: PromptKind::Free, options: None, source_ref: "tres_cosas_buenas" },
            Template { text: "¿Qué queda pendiente para mañana? Escríbelo con detalle (separa con «;» para crear tareas).", kind: PromptKind::Free, options: None, source_ref: "cierre_del_dia" },
        ],
        "weekly" => &[
            Template { text: "Leyendo la semana, ¿qué se repite?", kind: PromptKind::Free, options: None, source_ref: "revision_semanal" },
            Template { text: "¿Qué funcionó esta semana?", kind: PromptKind::Free, options: None, source_ref: "revision_semanal" },
            Template { text: "¿Qué lo impidió, cuando no salió?", kind: PromptKind::Free, options: None, source_ref: "plan_afrontamiento" },
            Template { text: "¿Qué cambio concreto pruebas la semana que viene?", kind: PromptKind::Free, options: None, source_ref: "revision_semanal" },
            Template { text: "Los cambios en tu entorno, ¿siguen en pie?", kind: PromptKind::Choice, options: Some("Sí|Algunos|No|No tengo"), source_ref: "entorno_checklist" },
            Template { text: "¿Siguen mereciendo la pena tus objetivos activos?", kind: PromptKind::Choice, options: Some("Sí|Lo dudo|Alguno ya no"), source_ref: "revision_objetivo" },
        ],
        "goal_review" => &[
            Template { text: "Escribiste que te importaba porque: «{why}». ¿Sigue siendo así?", kind: PromptKind::Choice, options: Some("Sigue importando|Menos que antes|Ya no"), source_ref: "revision_objetivo" },
            Template { text: "Registros en las últimas cuatro semanas: {n}. ¿Quieres seguir registrándolo así?", kind: PromptKind::Choice, options: Some("Sí|Menos|Más|De otra forma"), source_ref: "registro_conducta" },
            Template { text: "¿Tienes ahora el tiempo y la energía que esto pide?", kind: PromptKind::Choice, options: Some("Sí|A ratos|No"), source_ref: "revision_objetivo" },
            Template { text: "¿Ha cambiado algo en tu rutina o tu entorno que afecte a esto?", kind: PromptKind::Free, options: None, source_ref: "senal_contexto" },
            Template { text: "Decisión", kind: PromptKind::Choice, options: Some("Mantener|Ajustar frecuencia|Pausar|Cerrar"), source_ref: "revision_objetivo" },
        ],
        "srbai" => &[
            Template { text: "«{accion}» es algo que hago automáticamente.", kind: PromptKind::Scale, options: Some("1|5"), source_ref: "automaticidad_srbai" },
            Template { text: "«{accion}» es algo que hago sin tener que recordarlo.", kind: PromptKind::Scale, options: Some("1|5"), source_ref: "automaticidad_srbai" },
            Template { text: "«{accion}» es algo que hago sin pensar.", kind: PromptKind::Scale, options: Some("1|5"), source_ref: "automaticidad_srbai" },
            Template { text: "«{accion}» es algo que empiezo a hacer antes de darme cuenta.", kind: PromptKind::Scale, options: Some("1|5"), source_ref: "automaticidad_srbai" },
        ],
        _ => &[],
    }
}

pub const SCHEDULES: &[(&str, &str)] = &[("open", "Apertura del día"), ("close", "Cierre del día"), ("weekly", "Revisión semanal")];

/// Instala el conjunto por defecto de un `schedule` si no hay ninguna pregunta
/// (activa o archivada) de ese tipo. Devuelve cuántas creó.
pub fn install_set(conn: &Connection, schedule: &str) -> Result<usize> {
    let existing: i64 = conn.query_row("SELECT count(*) FROM prompts WHERE schedule = ?1 AND goal_id IS NULL", [schedule], |r| r.get(0))?;
    if existing > 0 {
        conn.execute("UPDATE prompts SET archived_at = NULL WHERE schedule = ?1 AND goal_id IS NULL", [schedule])?;
        return Ok(0);
    }
    let mut n = 0;
    for (i, t) in templates(schedule).iter().enumerate() {
        conn.execute(
            "INSERT INTO prompts(text, kind, options, schedule, source_ref, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![t.text, t.kind.as_str(), t.options, schedule, t.source_ref, i as i64, dates::now_ts()],
        )?;
        n += 1;
    }
    Ok(n)
}

/// Desactiva el conjunto (archiva; las respuestas se conservan).
pub fn disable_set(conn: &Connection, schedule: &str) -> Result<()> {
    conn.execute("UPDATE prompts SET archived_at = ?2 WHERE schedule = ?1 AND goal_id IS NULL AND archived_at IS NULL", params![schedule, dates::now_ts()])?;
    Ok(())
}

pub fn set_enabled(conn: &Connection, schedule: &str) -> Result<bool> {
    Ok(conn.query_row("SELECT count(*) FROM prompts WHERE schedule = ?1 AND archived_at IS NULL", [schedule], |r| r.get::<_, i64>(0))? > 0)
}

pub fn list(conn: &Connection, schedule: &str) -> Result<Vec<Prompt>> {
    let mut st = conn.prepare(&format!("{SELECT} WHERE schedule = ?1 AND archived_at IS NULL ORDER BY position, id"))?;
    let rows = st.query_map([schedule], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn create(conn: &Connection, text: &str, kind: PromptKind, options: Option<&str>, schedule: &str, goal_id: Option<Id>) -> Result<Id> {
    let pos: i64 = conn.query_row("SELECT coalesce(max(position), 0) + 1 FROM prompts WHERE schedule = ?1", [schedule], |r| r.get(0))?;
    conn.execute(
        "INSERT INTO prompts(text, kind, options, schedule, goal_id, source_ref, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'usuario', ?6, ?7)",
        params![text.trim(), kind.as_str(), options, schedule, goal_id, pos, dates::now_ts()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn set_text(conn: &Connection, id: Id, text: &str) -> Result<()> {
    conn.execute("UPDATE prompts SET text = ?2 WHERE id = ?1", params![id, text.trim()])?;
    Ok(())
}

pub fn archive(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("UPDATE prompts SET archived_at = ?2 WHERE id = ?1", params![id, dates::now_ts()])?;
    Ok(())
}

pub fn answer(conn: &Connection, prompt_id: Id, text: &str, value: Option<f64>, review_id: Option<Id>) -> Result<Id> {
    let now = dates::now_ts();
    conn.execute(
        "INSERT INTO prompt_answers(prompt_id, answered_at, day, text, value, review_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![prompt_id, now, dates::date_to_iso(dates::ts_to_date(now)), text, value, review_id],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Respuestas anteriores de una pregunta (para releer en la revisión semanal).
pub fn answers(conn: &Connection, prompt_id: Id, limit: usize) -> Result<Vec<(String, String, Option<f64>)>> {
    let mut st = conn.prepare("SELECT day, text, value FROM prompt_answers WHERE prompt_id = ?1 ORDER BY answered_at DESC LIMIT ?2")?;
    let rows = st.query_map(params![prompt_id, limit as i64], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Media SRBAI (1–5) de la última sesión de una acción y de la anterior.
pub fn srbai_history(conn: &Connection, action_id: Id) -> Result<Vec<(String, f64)>> {
    let mut st = conn.prepare(
        "SELECT a.day, avg(a.value) FROM prompt_answers a JOIN prompts p ON p.id = a.prompt_id
         WHERE p.schedule = ?1 AND a.value IS NOT NULL GROUP BY a.day ORDER BY a.day DESC LIMIT 6",
    )?;
    let rows = st.query_map([format!("srbai:{action_id}")], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Instala (si no existen) las 4 preguntas SRBAI de una acción, con su nombre.
pub fn ensure_srbai(conn: &Connection, action_id: Id, action_name: &str) -> Result<Vec<Prompt>> {
    let sched = format!("srbai:{action_id}");
    let existing = list(conn, &sched)?;
    if !existing.is_empty() {
        return Ok(existing);
    }
    for (i, t) in templates("srbai").iter().enumerate() {
        conn.execute(
            "INSERT INTO prompts(text, kind, options, schedule, source_ref, position, created_at) VALUES (?1, 'scale', '1|5', ?2, ?3, ?4, ?5)",
            params![t.text.replace("{accion}", action_name), sched, t.source_ref, i as i64, dates::now_ts()],
        )?;
    }
    list(conn, &sched)
}

pub fn last_srbai_day(conn: &Connection, action_id: Id) -> Result<Option<String>> {
    Ok(conn
        .query_row(
            "SELECT max(a.day) FROM prompt_answers a JOIN prompts p ON p.id = a.prompt_id WHERE p.schedule = ?1",
            [format!("srbai:{action_id}")],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?
        .flatten())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn install_toggle_answer() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        assert!(!set_enabled(c, "close").unwrap(), "nada instalado por defecto");
        assert_eq!(install_set(c, "close").unwrap(), 3);
        assert!(set_enabled(c, "close").unwrap());
        let ps = list(c, "close").unwrap();
        assert_eq!(ps.len(), 3);
        let a = answer(c, ps[0].id, "Un paseo al atardecer", None, None).unwrap();
        assert!(a > 0);
        assert_eq!(answers(c, ps[0].id, 5).unwrap()[0].1, "Un paseo al atardecer");
        disable_set(c, "close").unwrap();
        assert!(!set_enabled(c, "close").unwrap());
        assert_eq!(install_set(c, "close").unwrap(), 0, "reactivar no duplica");
        assert_eq!(list(c, "close").unwrap().len(), 3);
        assert!(list(c, "weekly").unwrap().is_empty());
    }

    #[test]
    fn weekly_choices_and_srbai() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        install_set(c, "weekly").unwrap();
        let w = list(c, "weekly").unwrap();
        assert_eq!(w.len(), 6);
        assert_eq!(w[4].choices(), vec!["Sí", "Algunos", "No", "No tengo"]);
        let ps = ensure_srbai(c, 7, "Leer en el sofá").unwrap();
        assert_eq!(ps.len(), 4);
        assert!(ps[0].text.starts_with("«Leer en el sofá»"));
        for p in &ps {
            answer(c, p.id, "", Some(3.0), None).unwrap();
        }
        let h = srbai_history(c, 7).unwrap();
        assert_eq!(h.len(), 1);
        assert_eq!(h[0].1, 3.0);
        assert!(last_srbai_day(c, 7).unwrap().is_some());
        assert!(last_srbai_day(c, 8).unwrap().is_none());
    }
}
