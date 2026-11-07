//! Episodios de impulso (interventions.md §c) y configuración por objetivo de
//! las vías disponibles. Nunca «racha», nunca porcentaje de «éxito».

use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

/// Vías de afrontamiento del paso P3. Las claves coinciden con el catálogo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pathway {
    Surf,
    Breathe,
    Distract,
    LongTerm,
    Competing,
}

impl Pathway {
    pub const ALL: [Pathway; 5] = [Pathway::Surf, Pathway::Breathe, Pathway::Distract, Pathway::LongTerm, Pathway::Competing];
    pub fn key(self) -> &'static str {
        match self {
            Pathway::Surf => "surfear_impulso",
            Pathway::Breathe => "respiracion_lenta",
            Pathway::Distract => "distraccion_concreta",
            Pathway::LongTerm => "espera_activa",
            Pathway::Competing => "respuesta_competidora",
        }
    }
    pub fn parse(s: &str) -> Option<Pathway> {
        Pathway::ALL.iter().copied().find(|p| p.key() == s)
    }
}

/// Configuración P0 de un objetivo (o general, `goal_id = NULL`), guardada como
/// filas de `strategies` con `technique` = clave.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ImpulseConfig {
    pub goal_id: Option<Id>,
    pub wait_seconds: i64,
    pub future_image: String,
    pub distractions: Vec<String>,
    pub competing_response: String,
    pub env_changes: Vec<String>,
    pub last_pathway: Option<Pathway>,
    pub serious: Option<bool>,
}

pub const DEFAULT_WAIT: i64 = 600;

pub fn load_config(conn: &Connection, goal_id: Option<Id>) -> Result<ImpulseConfig> {
    let mut cfg = ImpulseConfig { goal_id, wait_seconds: DEFAULT_WAIT, ..Default::default() };
    let mut st = conn.prepare("SELECT technique, instructions, wait_seconds, alternative FROM strategies WHERE goal_id IS ?1 AND archived_at IS NULL")?;
    let rows = st.query_map([goal_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, Option<i64>>(2)?, r.get::<_, String>(3)?)))?;
    for row in rows {
        let (technique, instructions, wait, alternative) = row?;
        match technique.as_str() {
            "espera_activa" => {
                cfg.wait_seconds = wait.unwrap_or(DEFAULT_WAIT);
                cfg.last_pathway = Pathway::parse(&alternative);
            }
            "imagen_futura" => cfg.future_image = instructions,
            "distraccion_concreta" => cfg.distractions = alternative.split('\n').filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string()).collect(),
            "respuesta_competidora" => cfg.competing_response = alternative,
            "entorno_checklist" => cfg.env_changes = alternative.split('\n').filter(|s| !s.trim().is_empty()).map(|s| s.trim().to_string()).collect(),
            "seguridad" => cfg.serious = match instructions.as_str() {
                "yes" => Some(true),
                "no" => Some(false),
                _ => None,
            },
            _ => {}
        }
    }
    Ok(cfg)
}

fn upsert(conn: &Connection, goal_id: Option<Id>, technique: &str, instructions: &str, wait: Option<i64>, alternative: &str) -> Result<()> {
    let existing: Option<Id> = conn
        .query_row("SELECT id FROM strategies WHERE goal_id IS ?1 AND technique = ?2 AND archived_at IS NULL", params![goal_id, technique], |r| r.get(0))
        .optional()?;
    match existing {
        Some(id) => {
            conn.execute(
                "UPDATE strategies SET instructions = ?2, wait_seconds = ?3, alternative = ?4 WHERE id = ?1",
                params![id, instructions, wait, alternative],
            )?;
        }
        None => {
            conn.execute(
                "INSERT INTO strategies(goal_id, technique, name, instructions, wait_seconds, alternative, created_at) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6)",
                params![goal_id, technique, instructions, wait, alternative, dates::now_ts()],
            )?;
        }
    }
    Ok(())
}

pub fn save_config(conn: &Connection, cfg: &ImpulseConfig) -> Result<()> {
    let g = cfg.goal_id;
    upsert(conn, g, "espera_activa", "", Some(cfg.wait_seconds.clamp(300, 1200)), cfg.last_pathway.map(|p| p.key()).unwrap_or(""))?;
    upsert(conn, g, "imagen_futura", &cfg.future_image, None, "")?;
    upsert(conn, g, "distraccion_concreta", "", None, &cfg.distractions.join("\n"))?;
    upsert(conn, g, "respuesta_competidora", "", None, &cfg.competing_response)?;
    upsert(conn, g, "entorno_checklist", "", None, &cfg.env_changes.join("\n"))?;
    let s = match cfg.serious {
        Some(true) => "yes",
        Some(false) => "no",
        None => "",
    };
    upsert(conn, g, "seguridad", s, None, "")?;
    Ok(())
}

#[derive(Debug, Clone, PartialEq)]
pub struct Episode {
    pub id: Id,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub goal_id: Option<Id>,
    pub pathway: Option<Pathway>,
    pub context: String,
    pub trigger_text: String,
    pub intensity_before: Option<i64>,
    pub intensity_after: Option<i64>,
    pub waited_seconds: Option<i64>,
    pub outcome: Option<String>,
    pub reflection: String,
}

pub const OUTCOMES: &[(&str, &str)] = &[("changed", "No lo hice"), ("partly", "En parte"), ("acted", "Lo hice"), ("unknown", "No lo sé"), ("unsaid", "Prefiero no decirlo")];

pub fn outcome_label(key: &str) -> &'static str {
    OUTCOMES.iter().find(|(k, _)| *k == key).map(|(_, l)| *l).unwrap_or("")
}

pub fn start(conn: &Connection, goal_id: Option<Id>) -> Result<Id> {
    conn.execute("INSERT INTO impulse_episodes(started_at, goal_id) VALUES (?1, ?2)", params![dates::now_ts(), goal_id])?;
    Ok(conn.last_insert_rowid())
}

pub fn set_before(conn: &Connection, id: Id, intensity: Option<i64>, trigger: &str) -> Result<()> {
    conn.execute("UPDATE impulse_episodes SET intensity_before = ?2, trigger_text = ?3 WHERE id = ?1", params![id, intensity, trigger])?;
    Ok(())
}

pub fn set_context(conn: &Connection, id: Id, context: &str) -> Result<()> {
    conn.execute("UPDATE impulse_episodes SET context = ?2 WHERE id = ?1", params![id, context])?;
    Ok(())
}

/// Guarda la vía como referencia a la fila de `strategies` de esa técnica (se
/// crea si no existe) para conservar la trazabilidad con el catálogo.
pub fn set_pathway(conn: &Connection, id: Id, goal_id: Option<Id>, p: Pathway) -> Result<()> {
    upsert_pathway_row(conn, goal_id, p)?;
    let sid: Id = conn.query_row("SELECT id FROM strategies WHERE goal_id IS ?1 AND technique = ?2 AND archived_at IS NULL", params![goal_id, p.key()], |r| r.get(0))?;
    conn.execute("UPDATE impulse_episodes SET strategy_id = ?2 WHERE id = ?1", params![id, sid])?;
    // Recordar la última vía elegida.
    let mut cfg = load_config(conn, goal_id)?;
    cfg.last_pathway = Some(p);
    upsert(conn, goal_id, "espera_activa", "", Some(cfg.wait_seconds), p.key())?;
    Ok(())
}

fn upsert_pathway_row(conn: &Connection, goal_id: Option<Id>, p: Pathway) -> Result<()> {
    let exists: Option<Id> = conn
        .query_row("SELECT id FROM strategies WHERE goal_id IS ?1 AND technique = ?2 AND archived_at IS NULL", params![goal_id, p.key()], |r| r.get(0))
        .optional()?;
    if exists.is_none() {
        conn.execute(
            "INSERT INTO strategies(goal_id, technique, name, created_at) VALUES (?1, ?2, ?2, ?3)",
            params![goal_id, p.key(), dates::now_ts()],
        )?;
    }
    Ok(())
}

pub fn set_after(conn: &Connection, id: Id, waited: Option<i64>, intensity_after: Option<i64>) -> Result<()> {
    conn.execute("UPDATE impulse_episodes SET waited_seconds = ?2, intensity_after = ?3 WHERE id = ?1", params![id, waited, intensity_after])?;
    Ok(())
}

pub fn finish(conn: &Connection, id: Id, outcome: Option<&str>, reflection: &str) -> Result<()> {
    conn.execute(
        "UPDATE impulse_episodes SET outcome = coalesce(?2, outcome), reflection = ?3, ended_at = ?4 WHERE id = ?1",
        params![id, outcome, reflection, dates::now_ts()],
    )?;
    Ok(())
}

/// Borra un episodio (registro por error, prueba). Las cifras de patrón se recalculan.
pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM impulse_episodes WHERE id = ?1", params![id])?;
    Ok(())
}

/// Cierra el episodio si el usuario sale sin terminar (Esc): se guarda lo que haya.
pub fn close_if_open(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("UPDATE impulse_episodes SET ended_at = coalesce(ended_at, ?2) WHERE id = ?1", params![id, dates::now_ts()])?;
    Ok(())
}

const SELECT: &str = "SELECT e.id, e.started_at, e.ended_at, e.goal_id, s.technique, e.context, e.trigger_text, e.intensity_before,
    e.intensity_after, e.waited_seconds, e.outcome, e.reflection FROM impulse_episodes e LEFT JOIN strategies s ON s.id = e.strategy_id";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Episode> {
    Ok(Episode {
        id: r.get(0)?,
        started_at: r.get(1)?,
        ended_at: r.get(2)?,
        goal_id: r.get(3)?,
        pathway: r.get::<_, Option<String>>(4)?.and_then(|s| Pathway::parse(&s)),
        context: r.get(5)?,
        trigger_text: r.get(6)?,
        intensity_before: r.get(7)?,
        intensity_after: r.get(8)?,
        waited_seconds: r.get(9)?,
        outcome: r.get(10)?,
        reflection: r.get(11)?,
    })
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Episode>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE e.id = ?1"), [id], map).optional()?)
}

pub fn recent(conn: &Connection, since: i64, goal_id: Option<Id>) -> Result<Vec<Episode>> {
    let sql = match goal_id {
        Some(_) => format!("{SELECT} WHERE e.started_at >= ?1 AND e.goal_id = ?2 ORDER BY e.started_at DESC"),
        None => format!("{SELECT} WHERE e.started_at >= ?1 ORDER BY e.started_at DESC"),
    };
    let mut st = conn.prepare(&sql)?;
    let rows = match goal_id {
        Some(g) => st.query_map(params![since, g], map)?,
        None => st.query_map(params![since], map)?,
    };
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Recuentos descriptivos para la revisión del patrón (P6).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Pattern {
    pub total_7: usize,
    pub total_30: usize,
    pub known_30: usize,
    pub not_acted_30: usize,
    pub by_slot: [usize; 4], // mañana, mediodía, tarde, noche
    pub triggers: Vec<(String, usize)>,
    pub contexts: Vec<(String, usize)>,
    pub pathways: Vec<(Pathway, usize)>,
    pub mean_before: Option<f64>,
    pub mean_after: Option<f64>,
    /// Episodios con resultado `acted` en cada una de las últimas 4 semanas (la más antigua primero).
    pub acted_weekly: [usize; 4],
}

impl Pattern {
    /// Regla aritmética de seguridad: crecimiento en cada una de las 4 semanas.
    pub fn rising_four_weeks(&self) -> bool {
        self.acted_weekly[0] > 0 && self.acted_weekly.windows(2).all(|w| w[1] > w[0])
    }
}

pub fn pattern(conn: &Connection, goal_id: Option<Id>, now: i64) -> Result<Pattern> {
    let eps = recent(conn, now - 30 * 86_400, goal_id)?;
    let mut p = Pattern::default();
    let mut trig = std::collections::BTreeMap::new();
    let mut ctx = std::collections::BTreeMap::new();
    let mut paths = std::collections::BTreeMap::new();
    let (mut sb, mut nb, mut sa, mut na) = (0.0, 0, 0.0, 0);
    for e in &eps {
        p.total_30 += 1;
        if e.started_at >= now - 7 * 86_400 {
            p.total_7 += 1;
        }
        let hour = chrono::Timelike::hour(&dates::ts_to_local(e.started_at));
        let slot = match hour {
            5..=11 => 0,
            12..=15 => 1,
            16..=20 => 2,
            _ => 3,
        };
        p.by_slot[slot] += 1;
        if !e.trigger_text.is_empty() {
            *trig.entry(e.trigger_text.clone()).or_insert(0) += 1;
        }
        for c in e.context.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            *ctx.entry(c.to_string()).or_insert(0) += 1;
        }
        if let Some(pw) = e.pathway {
            *paths.entry(pw.key()).or_insert(0) += 1;
        }
        if let Some(b) = e.intensity_before {
            sb += b as f64;
            nb += 1;
        }
        if let Some(a) = e.intensity_after {
            sa += a as f64;
            na += 1;
        }
        match e.outcome.as_deref() {
            Some("changed") | Some("partly") => {
                p.known_30 += 1;
                p.not_acted_30 += 1;
            }
            Some("acted") => {
                p.known_30 += 1;
                let weeks_ago = ((now - e.started_at) / (7 * 86_400)) as usize;
                if weeks_ago < 4 {
                    p.acted_weekly[3 - weeks_ago] += 1;
                }
            }
            _ => {}
        }
    }
    p.triggers = trig.into_iter().collect();
    p.contexts = ctx.into_iter().collect();
    p.pathways = paths.into_iter().filter_map(|(k, n)| Pathway::parse(k).map(|p| (p, n))).collect();
    p.triggers.sort_by(|a, b| b.1.cmp(&a.1));
    p.contexts.sort_by(|a, b| b.1.cmp(&a.1));
    p.mean_before = if nb > 0 { Some(sb / nb as f64) } else { None };
    p.mean_after = if na > 0 { Some(sa / na as f64) } else { None };
    Ok(p)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::test_support::temp_db;

    #[test]
    fn config_roundtrip() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let cfg = ImpulseConfig {
            goal_id: None,
            wait_seconds: 900,
            future_image: "Dentro de tres meses me noto más tranquilo".into(),
            distractions: vec!["Salir al balcón".into(), "Lavarme la cara".into()],
            competing_response: "Cerrar el puño diez segundos".into(),
            env_changes: vec!["Móvil en otra habitación".into()],
            last_pathway: Some(Pathway::Breathe),
            serious: Some(false),
        };
        save_config(c, &cfg).unwrap();
        assert_eq!(load_config(c, None).unwrap(), cfg);
        let mut cfg2 = cfg.clone();
        cfg2.wait_seconds = 5000; // se recorta a 1200
        save_config(c, &cfg2).unwrap();
        assert_eq!(load_config(c, None).unwrap().wait_seconds, 1200);
    }

    #[test]
    fn episode_lifecycle_and_pattern() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let id = start(c, None).unwrap();
        set_before(c, id, Some(7), "estrés").unwrap();
        set_context(c, id, "cansancio, hambre").unwrap();
        set_pathway(c, id, None, Pathway::Surf).unwrap();
        set_after(c, id, Some(600), Some(6)).unwrap();
        finish(c, id, Some("changed"), "ha bajado un poco").unwrap();
        let e = get(c, id).unwrap().unwrap();
        assert_eq!(e.pathway, Some(Pathway::Surf));
        assert!(e.ended_at.is_some());
        assert_eq!(load_config(c, None).unwrap().last_pathway, Some(Pathway::Surf));
        let id2 = start(c, None).unwrap();
        finish(c, id2, Some("acted"), "").unwrap();
        let p = pattern(c, None, dates::now_ts()).unwrap();
        assert_eq!(p.total_30, 2);
        assert_eq!((p.known_30, p.not_acted_30), (2, 1));
        assert_eq!(p.acted_weekly[3], 1);
        assert_eq!(p.contexts.len(), 2);
        assert!(!p.rising_four_weeks());
        let r = Pattern { acted_weekly: [1, 2, 3, 4], ..Default::default() };
        assert!(r.rising_four_weeks());
    }
}
