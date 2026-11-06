//! Métricas genéricas y mediciones (nota F §12).

use chrono::NaiveDate;
use rusqlite::{params, Connection, OptionalExtension};

use super::Id;
use crate::dates;
use crate::storage::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricKind {
    /// Decimal con unidad (peso, km…).
    Number,
    /// Hecho / no hecho.
    YesNo,
    /// Escala ordinal con mínimo y máximo (ánimo, energía…). Dirección `observe` por defecto.
    Scale,
    /// Minutos.
    Duration,
    /// Entero por registro (páginas, sesiones…).
    Count,
    /// Hora del día (minutos desde medianoche), para regularidad de horarios.
    Time,
    /// Texto breve.
    Text,
}

impl MetricKind {
    pub const ALL: [MetricKind; 7] =
        [MetricKind::Number, MetricKind::YesNo, MetricKind::Scale, MetricKind::Duration, MetricKind::Count, MetricKind::Time, MetricKind::Text];
    pub fn as_str(self) -> &'static str {
        match self {
            MetricKind::Number => "number",
            MetricKind::YesNo => "yes_no",
            MetricKind::Scale => "scale",
            MetricKind::Duration => "duration",
            MetricKind::Count => "count",
            MetricKind::Time => "time",
            MetricKind::Text => "text",
        }
    }
    pub fn parse(s: &str) -> Self {
        match s {
            "yes_no" => MetricKind::YesNo,
            "scale" => MetricKind::Scale,
            "duration" => MetricKind::Duration,
            "count" => MetricKind::Count,
            "time" => MetricKind::Time,
            "text" => MetricKind::Text,
            _ => MetricKind::Number,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            MetricKind::Number => "número con unidad (72,4 kg; 5 km)",
            MetricKind::YesNo => "sí / no",
            MetricKind::Scale => "escala (0–10, 1–5)",
            MetricKind::Duration => "duración en minutos",
            MetricKind::Count => "cantidad entera (páginas, sesiones)",
            MetricKind::Time => "hora del día (23:15)",
            MetricKind::Text => "texto breve",
        }
    }
    pub fn is_numeric(self) -> bool {
        !matches!(self, MetricKind::Text)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Up,
    Down,
    Maintain,
    Range,
    Observe,
}

impl Direction {
    /// Orden de oferta: observar y mantener antes que bajar (nota F §12.2).
    pub const ALL: [Direction; 5] = [Direction::Observe, Direction::Maintain, Direction::Range, Direction::Up, Direction::Down];
    pub fn as_str(self) -> &'static str {
        match self {
            Direction::Up => "up",
            Direction::Down => "down",
            Direction::Maintain => "maintain",
            Direction::Range => "range",
            Direction::Observe => "observe",
        }
    }
    pub fn parse(s: &str) -> Self {
        match s {
            "up" => Direction::Up,
            "down" => Direction::Down,
            "maintain" => Direction::Maintain,
            "range" => Direction::Range,
            _ => Direction::Observe,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Direction::Up => "subir",
            Direction::Down => "bajar",
            Direction::Maintain => "mantener alrededor de un valor",
            Direction::Range => "mantenerse en un intervalo",
            Direction::Observe => "sólo observar",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Frequency {
    Daily,
    Weekly,
    Adhoc,
}

impl Frequency {
    pub fn as_str(self) -> &'static str {
        match self {
            Frequency::Daily => "daily",
            Frequency::Weekly => "weekly",
            Frequency::Adhoc => "adhoc",
        }
    }
    pub fn parse(s: &str) -> Self {
        match s {
            "daily" => Frequency::Daily,
            "weekly" => Frequency::Weekly,
            _ => Frequency::Adhoc,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Frequency::Daily => "diaria",
            Frequency::Weekly => "semanal",
            Frequency::Adhoc => "cuando quiera",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Metric {
    pub id: Id,
    pub goal_id: Option<Id>,
    pub name: String,
    pub kind: MetricKind,
    pub unit: String,
    pub direction: Direction,
    pub target_low: Option<f64>,
    pub target_high: Option<f64>,
    pub scale_min: f64,
    pub scale_max: f64,
    pub frequency: Frequency,
    pub sensitive: bool,
    pub archived: bool,
    pub count: i64,
    pub last_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Measurement {
    pub id: Id,
    pub metric_id: Id,
    pub measured_at: i64,
    pub day: String,
    pub value: Option<f64>,
    pub text_value: Option<String>,
    pub note: String,
}

const SELECT: &str = "SELECT m.id, m.goal_id, m.name, m.kind, m.unit, m.direction, m.target_low, m.target_high, m.scale_min, m.scale_max,
    m.frequency, m.sensitive, m.archived_at,
    (SELECT count(*) FROM measurements x WHERE x.metric_id = m.id),
    (SELECT max(measured_at) FROM measurements x WHERE x.metric_id = m.id)
    FROM metrics m";

fn map(r: &rusqlite::Row) -> rusqlite::Result<Metric> {
    Ok(Metric {
        id: r.get(0)?,
        goal_id: r.get(1)?,
        name: r.get(2)?,
        kind: MetricKind::parse(&r.get::<_, String>(3)?),
        unit: r.get(4)?,
        direction: Direction::parse(&r.get::<_, String>(5)?),
        target_low: r.get(6)?,
        target_high: r.get(7)?,
        scale_min: r.get::<_, Option<f64>>(8)?.unwrap_or(0.0),
        scale_max: r.get::<_, Option<f64>>(9)?.unwrap_or(10.0),
        frequency: Frequency::parse(&r.get::<_, String>(10)?),
        sensitive: r.get::<_, i64>(11)? != 0,
        archived: r.get::<_, Option<i64>>(12)?.is_some(),
        count: r.get(13)?,
        last_at: r.get(14)?,
    })
}

pub struct NewMetric<'a> {
    pub goal_id: Option<Id>,
    pub name: &'a str,
    pub kind: MetricKind,
    pub unit: &'a str,
    pub sensitive: bool,
}

pub fn create(conn: &Connection, m: NewMetric) -> Result<Id> {
    // Frecuencia sugerida por tipo (nota F §12.4): peso/sensibles semanal; resto diaria o libre.
    let freq = match (m.kind, m.sensitive) {
        (_, true) => Frequency::Weekly,
        (MetricKind::YesNo | MetricKind::Count | MetricKind::Scale | MetricKind::Time, _) => Frequency::Daily,
        _ => Frequency::Adhoc,
    };
    let (smin, smax) = if m.kind == MetricKind::Scale { (Some(0.0), Some(10.0)) } else { (None, None) };
    conn.execute(
        "INSERT INTO metrics(goal_id, name, kind, unit, direction, scale_min, scale_max, frequency, sensitive, created_at)
         VALUES (?1, ?2, ?3, ?4, 'observe', ?5, ?6, ?7, ?8, ?9)",
        params![m.goal_id, m.name.trim(), m.kind.as_str(), m.unit.trim(), smin, smax, freq.as_str(), m.sensitive as i64, dates::now_ts()],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: Id) -> Result<Option<Metric>> {
    Ok(conn.query_row(&format!("{SELECT} WHERE m.id = ?1"), [id], map).optional()?)
}

pub fn list_for_goal(conn: &Connection, goal_id: Id, include_archived: bool) -> Result<Vec<Metric>> {
    let sql = format!(
        "{SELECT} WHERE m.goal_id = ?1 {} ORDER BY m.archived_at IS NOT NULL, m.id",
        if include_archived { "" } else { "AND m.archived_at IS NULL" }
    );
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map([goal_id], map)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn count_active(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("SELECT count(*) FROM metrics WHERE archived_at IS NULL", [], |r| r.get(0))?)
}

fn set(conn: &Connection, id: Id, field: &str, v: impl rusqlite::ToSql) -> Result<()> {
    conn.execute(&format!("UPDATE metrics SET {field} = ?2 WHERE id = ?1"), params![id, v])?;
    Ok(())
}

pub fn set_name(conn: &Connection, id: Id, v: &str) -> Result<()> {
    set(conn, id, "name", v.trim())
}
pub fn set_unit(conn: &Connection, id: Id, v: &str) -> Result<()> {
    set(conn, id, "unit", v.trim())
}
pub fn set_direction(conn: &Connection, id: Id, d: Direction) -> Result<()> {
    set(conn, id, "direction", d.as_str())
}
pub fn set_targets(conn: &Connection, id: Id, low: Option<f64>, high: Option<f64>) -> Result<()> {
    conn.execute("UPDATE metrics SET target_low = ?2, target_high = ?3 WHERE id = ?1", params![id, low, high])?;
    Ok(())
}
pub fn set_scale(conn: &Connection, id: Id, min: f64, max: f64) -> Result<()> {
    conn.execute("UPDATE metrics SET scale_min = ?2, scale_max = ?3 WHERE id = ?1", params![id, min, max])?;
    Ok(())
}
pub fn set_frequency(conn: &Connection, id: Id, f: Frequency) -> Result<()> {
    set(conn, id, "frequency", f.as_str())
}
pub fn set_sensitive(conn: &Connection, id: Id, v: bool) -> Result<()> {
    set(conn, id, "sensitive", v as i64)
}
/// Pausar/archivar nunca borra mediciones.
pub fn set_archived(conn: &Connection, id: Id, archived: bool) -> Result<()> {
    let v: Option<i64> = if archived { Some(dates::now_ts()) } else { None };
    set(conn, id, "archived_at", v)
}
pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM metrics WHERE id = ?1", [id])?;
    Ok(())
}

/// Interpreta un valor escrito según el tipo. Devuelve (valor numérico, texto).
pub fn parse_value(kind: MetricKind, input: &str, scale_min: f64, scale_max: f64) -> Option<(Option<f64>, Option<String>)> {
    let t = input.trim();
    if t.is_empty() {
        return None;
    }
    match kind {
        MetricKind::Text => Some((None, Some(t.to_string()))),
        MetricKind::YesNo => match t.to_lowercase().as_str() {
            "s" | "si" | "sí" | "1" | "y" | "hecho" => Some((Some(1.0), None)),
            "n" | "no" | "0" => Some((Some(0.0), None)),
            _ => None,
        },
        MetricKind::Time => {
            let (h, m) = dates::parse_time_input(t)?;
            Some((Some((h * 60 + m) as f64), None))
        }
        MetricKind::Duration => {
            // «45», «1:30», «1h30», «90 min»
            let t = t.to_lowercase().replace(" min", "").replace("min", "");
            if let Some((h, m)) = t.split_once(':').or_else(|| t.split_once('h')) {
                let h: f64 = h.trim().parse().ok()?;
                let m: f64 = if m.trim().is_empty() { 0.0 } else { m.trim().parse().ok()? };
                return Some((Some(h * 60.0 + m), None));
            }
            let v: f64 = t.trim().parse().ok()?;
            Some((Some(v), None))
        }
        MetricKind::Scale => {
            let v: f64 = t.replace(',', ".").parse().ok()?;
            if v < scale_min || v > scale_max {
                return None;
            }
            Some((Some(v), None))
        }
        MetricKind::Count => {
            let v: f64 = t.parse::<i64>().ok()? as f64;
            Some((Some(v), None))
        }
        MetricKind::Number => {
            let cleaned: String = t.chars().take_while(|c| c.is_ascii_digit() || *c == ',' || *c == '.' || *c == '-').collect();
            let v: f64 = cleaned.replace(',', ".").parse().ok()?;
            Some((Some(v), None))
        }
    }
}

/// Formatea un valor según el tipo (sin juicios: sólo el dato).
pub fn format_value(kind: MetricKind, value: Option<f64>, text: Option<&str>, unit: &str) -> String {
    match (kind, value) {
        (MetricKind::Text, _) => text.unwrap_or("").to_string(),
        (MetricKind::YesNo, Some(v)) => if v >= 0.5 { "sí" } else { "no" }.to_string(),
        (MetricKind::Time, Some(v)) => format!("{:02}:{:02}", (v as i64 / 60) % 24, v as i64 % 60),
        (MetricKind::Duration, Some(v)) => {
            let m = v.round() as i64;
            if m >= 60 {
                format!("{}h {:02}min", m / 60, m % 60)
            } else {
                format!("{m} min")
            }
        }
        (MetricKind::Count, Some(v)) => format!("{}{}", v as i64, if unit.is_empty() { String::new() } else { format!(" {unit}") }),
        (_, Some(v)) => {
            let s = if (v - v.round()).abs() < 1e-9 { format!("{}", v as i64) } else { format!("{v:.1}").replace('.', ",") };
            if unit.is_empty() {
                s
            } else {
                format!("{s} {unit}")
            }
        }
        (_, None) => String::new(),
    }
}

pub fn record(conn: &Connection, metric_id: Id, day: NaiveDate, value: Option<f64>, text: Option<&str>, note: &str) -> Result<Id> {
    let now = dates::now_ts();
    conn.execute(
        "INSERT INTO measurements(metric_id, measured_at, day, value, text_value, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![metric_id, now, dates::date_to_iso(day), value, text, note],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_measurement(conn: &Connection, id: Id) -> Result<()> {
    conn.execute("DELETE FROM measurements WHERE id = ?1", [id])?;
    Ok(())
}

pub fn measurements(conn: &Connection, metric_id: Id, limit: usize) -> Result<Vec<Measurement>> {
    let mut st = conn.prepare_cached(
        "SELECT id, metric_id, measured_at, day, value, text_value, note FROM measurements WHERE metric_id = ?1 ORDER BY day DESC, measured_at DESC LIMIT ?2",
    )?;
    let rows = st.query_map(params![metric_id, limit as i64], |r| {
        Ok(Measurement {
            id: r.get(0)?,
            metric_id: r.get(1)?,
            measured_at: r.get(2)?,
            day: r.get(3)?,
            value: r.get(4)?,
            text_value: r.get(5)?,
            note: r.get(6)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Serie (día, valor) ascendente; si hay varias mediciones un mismo día se
/// usa la media (o la suma para `count`/`duration`, que se acumulan).
pub fn daily_series(conn: &Connection, metric: &Metric, days_back: i64) -> Result<Vec<(NaiveDate, f64)>> {
    let from = dates::date_to_iso(dates::today() - chrono::Duration::days(days_back));
    let agg = match metric.kind {
        MetricKind::Count | MetricKind::Duration => "sum(value)",
        _ => "avg(value)",
    };
    let mut st = conn.prepare(&format!(
        "SELECT day, {agg} FROM measurements WHERE metric_id = ?1 AND value IS NOT NULL AND day >= ?2 GROUP BY day ORDER BY day"
    ))?;
    let rows = st.query_map(params![metric.id, from], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?)))?;
    let mut out = vec![];
    for r in rows {
        let (d, v) = r?;
        if let Some(d) = dates::parse_iso_date(&d) {
            out.push((d, v));
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::goals::{self, GoalKind};
    use crate::storage::test_support::temp_db;

    #[test]
    fn parse_and_format() {
        assert_eq!(parse_value(MetricKind::Number, "72,4 kg", 0.0, 10.0), Some((Some(72.4), None)));
        assert_eq!(parse_value(MetricKind::YesNo, "sí", 0.0, 10.0), Some((Some(1.0), None)));
        assert_eq!(parse_value(MetricKind::Scale, "11", 0.0, 10.0), None);
        assert_eq!(parse_value(MetricKind::Scale, "7", 0.0, 10.0), Some((Some(7.0), None)));
        assert_eq!(parse_value(MetricKind::Duration, "1:30", 0.0, 10.0), Some((Some(90.0), None)));
        assert_eq!(parse_value(MetricKind::Duration, "45 min", 0.0, 10.0), Some((Some(45.0), None)));
        assert_eq!(parse_value(MetricKind::Time, "23:15", 0.0, 10.0), Some((Some(1395.0), None)));
        assert_eq!(parse_value(MetricKind::Count, "12", 0.0, 10.0), Some((Some(12.0), None)));
        assert_eq!(parse_value(MetricKind::Text, "cansado", 0.0, 10.0), Some((None, Some("cansado".into()))));
        assert_eq!(format_value(MetricKind::Number, Some(72.4), None, "kg"), "72,4 kg");
        assert_eq!(format_value(MetricKind::Duration, Some(90.0), None, ""), "1h 30min");
        assert_eq!(format_value(MetricKind::Time, Some(1395.0), None, ""), "23:15");
        assert_eq!(format_value(MetricKind::YesNo, Some(0.0), None, ""), "no");
    }

    #[test]
    fn create_record_series() {
        let (_t, db) = temp_db();
        let c = &db.conn;
        let g = goals::create(c, "Dormir mejor", GoalKind::Process, "sleep").unwrap();
        let m = create(c, NewMetric { goal_id: Some(g), name: "Hora de acostarme", kind: MetricKind::Time, unit: "", sensitive: false }).unwrap();
        let w = create(c, NewMetric { goal_id: Some(g), name: "Peso", kind: MetricKind::Number, unit: "kg", sensitive: true }).unwrap();
        assert_eq!(get(c, w).unwrap().unwrap().frequency, Frequency::Weekly, "sensible → semanal por defecto");
        assert_eq!(get(c, w).unwrap().unwrap().direction, Direction::Observe, "sensible → observar");
        let today = dates::today();
        record(c, m, today - chrono::Duration::days(1), Some(1410.0), None, "").unwrap();
        record(c, m, today, Some(1380.0), None, "").unwrap();
        record(c, m, today, Some(1400.0), None, "").unwrap();
        let s = daily_series(c, &get(c, m).unwrap().unwrap(), 30).unwrap();
        assert_eq!(s.len(), 2);
        assert_eq!(s[1].1, 1390.0, "media del mismo día");
        assert_eq!(list_for_goal(c, g, false).unwrap().len(), 2);
        set_archived(c, w, true).unwrap();
        assert_eq!(list_for_goal(c, g, false).unwrap().len(), 1);
        assert_eq!(measurements(c, m, 10).unwrap().len(), 3, "archivar no borra nada");
        assert_eq!(count_active(c).unwrap(), 1);
    }
}
