//! Fechas y horas locales con nombres en español. Sin dependencias de locale.

use chrono::{DateTime, Datelike, Local, NaiveDate, TimeZone, Timelike};

pub const WEEKDAYS: [&str; 7] = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
pub const WEEKDAYS_SHORT: [&str; 7] = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
pub const WEEKDAYS_INITIAL: [&str; 7] = ["L", "M", "X", "J", "V", "S", "D"];
pub const MONTHS: [&str; 12] = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
    "noviembre", "diciembre",
];
pub const MONTHS_SHORT: [&str; 12] =
    ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/// Marca de tiempo Unix en segundos (siempre UTC en almacenamiento).
pub fn now_ts() -> i64 {
    Local::now().timestamp()
}

pub fn today() -> NaiveDate {
    Local::now().date_naive()
}

pub fn now_local() -> DateTime<Local> {
    Local::now()
}

pub fn ts_to_local(ts: i64) -> DateTime<Local> {
    Local.timestamp_opt(ts, 0).single().unwrap_or_else(Local::now)
}

/// Fecha local (AAAA-MM-DD) de una marca de tiempo; es la clave de agrupación del diario.
pub fn ts_to_date(ts: i64) -> NaiveDate {
    ts_to_local(ts).date_naive()
}

pub fn date_to_iso(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

pub fn parse_iso_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d").ok()
}

/// «mié 5 nov 2026»
pub fn fmt_date_short(d: NaiveDate) -> String {
    format!(
        "{} {} {} {}",
        WEEKDAYS_SHORT[d.weekday().num_days_from_monday() as usize],
        d.day(),
        MONTHS_SHORT[d.month0() as usize],
        d.year()
    )
}

/// «miércoles, 5 de noviembre de 2026»
pub fn fmt_date_long(d: NaiveDate) -> String {
    format!(
        "{}, {} de {} de {}",
        WEEKDAYS[d.weekday().num_days_from_monday() as usize],
        d.day(),
        MONTHS[d.month0() as usize],
        d.year()
    )
}

/// «5 nov» (sin año) o «5 nov 2025» si el año difiere del actual.
pub fn fmt_date_compact(d: NaiveDate, today: NaiveDate) -> String {
    if d.year() == today.year() {
        format!("{} {}", d.day(), MONTHS_SHORT[d.month0() as usize])
    } else {
        format!("{} {} {}", d.day(), MONTHS_SHORT[d.month0() as usize], d.year())
    }
}

pub fn fmt_time(ts: i64) -> String {
    let t = ts_to_local(ts);
    format!("{:02}:{:02}", t.hour(), t.minute())
}

/// Descripción relativa, neutra: «hoy», «ayer», «hace 3 días», «hace 2 semanas».
pub fn fmt_relative_days(d: NaiveDate, today: NaiveDate) -> String {
    let diff = (today - d).num_days();
    match diff {
        0 => "hoy".into(),
        1 => "ayer".into(),
        2..=13 => format!("hace {diff} días"),
        14..=59 => format!("hace {} semanas", diff / 7),
        60..=365 => format!("hace {} meses", diff / 30),
        d if d < 0 => {
            let f = -d;
            if f == 1 {
                "mañana".into()
            } else if f <= 13 {
                format!("en {f} días")
            } else {
                format!("en {} semanas", f / 7)
            }
        }
        _ => format!("hace {} años", diff / 365),
    }
}

/// Lunes de la semana a la que pertenece `d`.
pub fn week_start(d: NaiveDate) -> NaiveDate {
    d - chrono::Duration::days(d.weekday().num_days_from_monday() as i64)
}

pub fn days_in_month(year: i32, month: u32) -> u32 {
    let (ny, nm) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    (NaiveDate::from_ymd_opt(ny, nm, 1).unwrap() - NaiveDate::from_ymd_opt(year, month, 1).unwrap()).num_days() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spanish_formats() {
        let d = NaiveDate::from_ymd_opt(2026, 11, 5).unwrap();
        assert_eq!(fmt_date_short(d), "jue 5 nov 2026");
        assert_eq!(fmt_date_long(d), "jueves, 5 de noviembre de 2026");
        assert_eq!(fmt_date_compact(d, d), "5 nov");
    }

    #[test]
    fn relative() {
        let t = NaiveDate::from_ymd_opt(2026, 11, 5).unwrap();
        assert_eq!(fmt_relative_days(t, t), "hoy");
        assert_eq!(fmt_relative_days(t - chrono::Duration::days(1), t), "ayer");
        assert_eq!(fmt_relative_days(t - chrono::Duration::days(9), t), "hace 9 días");
        assert_eq!(fmt_relative_days(t - chrono::Duration::days(21), t), "hace 3 semanas");
        assert_eq!(fmt_relative_days(t + chrono::Duration::days(1), t), "mañana");
    }

    #[test]
    fn week_and_month() {
        let d = NaiveDate::from_ymd_opt(2026, 11, 5).unwrap(); // jueves
        assert_eq!(week_start(d), NaiveDate::from_ymd_opt(2026, 11, 2).unwrap());
        assert_eq!(days_in_month(2026, 2), 28);
        assert_eq!(days_in_month(2028, 2), 29);
        assert_eq!(days_in_month(2026, 12), 31);
    }
}

/// Interpreta una fecha escrita por el usuario. Devuelve `Some(None)` para
/// «ninguna» y `None` si no se entiende.
/// Acepta: hoy, mañana, pasado, lun…dom (próximo), +N (días), AAAA-MM-DD,
/// DD/MM, DD/MM/AAAA, DD (día de este mes o del siguiente), «ninguna», «-».
pub fn parse_day_input(s: &str, today: NaiveDate) -> Option<Option<NaiveDate>> {
    let t = s.trim().to_lowercase();
    if t.is_empty() || t == "ninguna" || t == "ninguno" || t == "-" || t == "no" || t == "sin fecha" {
        return Some(None);
    }
    match t.as_str() {
        "hoy" => return Some(Some(today)),
        "mañana" | "manana" => return Some(Some(today + chrono::Duration::days(1))),
        "pasado" | "pasado mañana" => return Some(Some(today + chrono::Duration::days(2))),
        "semana" | "próxima semana" | "proxima semana" => return Some(Some(week_start(today) + chrono::Duration::days(7))),
        _ => {}
    }
    if let Some(n) = t.strip_prefix('+').and_then(|n| n.parse::<i64>().ok()) {
        return Some(Some(today + chrono::Duration::days(n)));
    }
    let weekday = match t.as_str() {
        "l" | "lu" | "lun" | "lunes" => Some(0),
        "m" | "ma" | "mar" | "martes" => Some(1),
        "x" | "mi" | "mié" | "mie" | "miércoles" | "miercoles" => Some(2),
        "j" | "ju" | "jue" | "jueves" => Some(3),
        "v" | "vi" | "vie" | "viernes" => Some(4),
        "s" | "sa" | "sáb" | "sab" | "sábado" | "sabado" => Some(5),
        "d" | "do" | "dom" | "domingo" => Some(6),
        _ => None,
    };
    if let Some(w) = weekday {
        let cur = today.weekday().num_days_from_monday() as i64;
        let mut diff = w as i64 - cur;
        if diff <= 0 {
            diff += 7;
        }
        return Some(Some(today + chrono::Duration::days(diff)));
    }
    if let Some(d) = parse_iso_date(&t) {
        return Some(Some(d));
    }
    let parts: Vec<&str> = t.split('/').collect();
    match parts.len() {
        1 => {
            let day: u32 = t.parse().ok()?;
            if !(1..=31).contains(&day) {
                return None;
            }
            let (y, m) = (today.year(), today.month());
            let this = NaiveDate::from_ymd_opt(y, m, day.min(days_in_month(y, m)))?;
            if this >= today {
                return Some(Some(this));
            }
            let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
            Some(NaiveDate::from_ymd_opt(ny, nm, day.min(days_in_month(ny, nm))))
        }
        2 => {
            let day: u32 = parts[0].parse().ok()?;
            let month: u32 = parts[1].parse().ok()?;
            let mut y = today.year();
            let mut d = NaiveDate::from_ymd_opt(y, month, day)?;
            if d < today {
                y += 1;
                d = NaiveDate::from_ymd_opt(y, month, day)?;
            }
            Some(Some(d))
        }
        3 => {
            let day: u32 = parts[0].parse().ok()?;
            let month: u32 = parts[1].parse().ok()?;
            let mut year: i32 = parts[2].parse().ok()?;
            if year < 100 {
                year += 2000;
            }
            Some(NaiveDate::from_ymd_opt(year, month, day))
        }
        _ => None,
    }
}

/// Interpreta una hora «HH:MM» o «HH». Devuelve (hora, minuto).
pub fn parse_time_input(s: &str) -> Option<(u32, u32)> {
    let t = s.trim();
    let (h, m) = match t.split_once(':') {
        Some((h, m)) => (h.parse::<u32>().ok()?, m.parse::<u32>().ok()?),
        None => (t.parse::<u32>().ok()?, 0),
    };
    if h < 24 && m < 60 {
        Some((h, m))
    } else {
        None
    }
}

/// Interpreta «mañana 9:00», «+2h», «+30m», «lun 18:30», «18:30», «15/11 10:00».
/// Devuelve una marca de tiempo local en segundos Unix.
pub fn parse_datetime_input(s: &str, now: DateTime<Local>) -> Option<i64> {
    let t = s.trim().to_lowercase();
    if let Some(rest) = t.strip_prefix('+') {
        if let Some(h) = rest.strip_suffix('h').and_then(|v| v.parse::<i64>().ok()) {
            return Some(now.timestamp() + h * 3600);
        }
        if let Some(m) = rest.strip_suffix('m').and_then(|v| v.parse::<i64>().ok()) {
            return Some(now.timestamp() + m * 60);
        }
        if let Some(d) = rest.strip_suffix('d').and_then(|v| v.parse::<i64>().ok()) {
            return Some(now.timestamp() + d * 86_400);
        }
    }
    let today = now.date_naive();
    let (day_part, time_part) = match t.rsplit_once(' ') {
        Some((d, tm)) if parse_time_input(tm).is_some() => (d.to_string(), tm.to_string()),
        _ => {
            if parse_time_input(&t).is_some() {
                (String::new(), t.clone())
            } else {
                (t.clone(), "9:00".to_string())
            }
        }
    };
    let (h, m) = parse_time_input(&time_part)?;
    let day = if day_part.is_empty() {
        let candidate = today.and_hms_opt(h, m, 0)?;
        let ts = Local.from_local_datetime(&candidate).single()?.timestamp();
        if ts <= now.timestamp() {
            today + chrono::Duration::days(1)
        } else {
            today
        }
    } else {
        parse_day_input(&day_part, today)??
    };
    let dt = day.and_hms_opt(h, m, 0)?;
    Some(Local.from_local_datetime(&dt).single()?.timestamp())
}

#[cfg(test)]
mod input_tests {
    use super::*;

    #[test]
    fn day_inputs() {
        let t = NaiveDate::from_ymd_opt(2026, 11, 5).unwrap(); // jueves
        let p = |s: &str| parse_day_input(s, t);
        assert_eq!(p("hoy"), Some(Some(t)));
        assert_eq!(p("mañana"), Some(Some(NaiveDate::from_ymd_opt(2026, 11, 6).unwrap())));
        assert_eq!(p("+3"), Some(Some(NaiveDate::from_ymd_opt(2026, 11, 8).unwrap())));
        assert_eq!(p("lun"), Some(Some(NaiveDate::from_ymd_opt(2026, 11, 9).unwrap())));
        assert_eq!(p("jueves"), Some(Some(NaiveDate::from_ymd_opt(2026, 11, 12).unwrap())));
        assert_eq!(p("20"), Some(Some(NaiveDate::from_ymd_opt(2026, 11, 20).unwrap())));
        assert_eq!(p("2"), Some(Some(NaiveDate::from_ymd_opt(2026, 12, 2).unwrap())));
        assert_eq!(p("1/3"), Some(Some(NaiveDate::from_ymd_opt(2027, 3, 1).unwrap())));
        assert_eq!(p("25/12/26"), Some(Some(NaiveDate::from_ymd_opt(2026, 12, 25).unwrap())));
        assert_eq!(p("2027-01-02"), Some(Some(NaiveDate::from_ymd_opt(2027, 1, 2).unwrap())));
        assert_eq!(p("ninguna"), Some(None));
        assert_eq!(p("xyz"), None);
        assert_eq!(p("32"), None);
    }

    #[test]
    fn time_inputs() {
        assert_eq!(parse_time_input("9"), Some((9, 0)));
        assert_eq!(parse_time_input("18:30"), Some((18, 30)));
        assert_eq!(parse_time_input("25:00"), None);
    }
}
