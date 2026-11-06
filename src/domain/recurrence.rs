//! Reglas de repetición compactas, legibles y sin dependencias.
//!
//! Formato almacenado:
//!   `daily`            cada día
//!   `weekdays:LMXJVSD` los días de la semana indicados (L lunes … D domingo)
//!   `every:N:d|w|m`    cada N días / semanas / meses
//!   `monthly:D`        el día D de cada mes (se recorta al último día si no existe)

use chrono::{Datelike, Duration, NaiveDate};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Rule {
    Daily,
    Weekdays([bool; 7]),
    Every(u32, Unit),
    Monthly(u32),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Unit {
    Days,
    Weeks,
    Months,
}

const LETTERS: [char; 7] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

impl Rule {
    pub fn parse(s: &str) -> Option<Rule> {
        let s = s.trim();
        if s.is_empty() {
            return None;
        }
        if s == "daily" {
            return Some(Rule::Daily);
        }
        if let Some(rest) = s.strip_prefix("weekdays:") {
            let mut days = [false; 7];
            for c in rest.chars() {
                let i = LETTERS.iter().position(|&l| l == c.to_ascii_uppercase())?;
                days[i] = true;
            }
            return if days.iter().any(|&d| d) { Some(Rule::Weekdays(days)) } else { None };
        }
        if let Some(rest) = s.strip_prefix("every:") {
            let mut it = rest.split(':');
            let n: u32 = it.next()?.parse().ok()?;
            let unit = match it.next()? {
                "d" => Unit::Days,
                "w" => Unit::Weeks,
                "m" => Unit::Months,
                _ => return None,
            };
            return if n >= 1 { Some(Rule::Every(n, unit)) } else { None };
        }
        if let Some(rest) = s.strip_prefix("monthly:") {
            let d: u32 = rest.parse().ok()?;
            return if (1..=31).contains(&d) { Some(Rule::Monthly(d)) } else { None };
        }
        None
    }

    pub fn to_storage(&self) -> String {
        match self {
            Rule::Daily => "daily".into(),
            Rule::Weekdays(d) => {
                let s: String = d.iter().zip(LETTERS).filter(|(on, _)| **on).map(|(_, l)| l).collect();
                format!("weekdays:{s}")
            }
            Rule::Every(n, u) => format!("every:{n}:{}", match u {
                Unit::Days => "d",
                Unit::Weeks => "w",
                Unit::Months => "m",
            }),
            Rule::Monthly(d) => format!("monthly:{d}"),
        }
    }

    /// Interpreta lo que escribe el usuario: «diario», «cada día», «L X V»,
    /// «laborables», «semanal», «cada 2 semanas», «cada 10 días», «mensual», «día 15».
    pub fn parse_human(s: &str) -> Option<Rule> {
        let t = s.trim().to_lowercase();
        if t.is_empty() || t == "no" || t == "nunca" || t == "-" {
            return None;
        }
        if let Some(r) = Rule::parse(&t) {
            return Some(r);
        }
        match t.as_str() {
            "diario" | "diaria" | "cada día" | "cada dia" | "todos los días" | "todos los dias" => return Some(Rule::Daily),
            "laborables" | "entre semana" => return Some(Rule::Weekdays([true, true, true, true, true, false, false])),
            "fin de semana" | "fines de semana" => return Some(Rule::Weekdays([false, false, false, false, false, true, true])),
            "semanal" | "cada semana" => return Some(Rule::Every(1, Unit::Weeks)),
            "quincenal" | "cada dos semanas" | "cada 2 semanas" => return Some(Rule::Every(2, Unit::Weeks)),
            "mensual" | "cada mes" => return Some(Rule::Every(1, Unit::Months)),
            _ => {}
        }
        if let Some(rest) = t.strip_prefix("cada ") {
            let mut it = rest.split_whitespace();
            let n: u32 = it.next()?.parse().ok()?;
            let unit = match it.next()? {
                "día" | "dias" | "días" | "dia" => Unit::Days,
                "semana" | "semanas" => Unit::Weeks,
                "mes" | "meses" => Unit::Months,
                _ => return None,
            };
            return Some(Rule::Every(n, unit));
        }
        if let Some(rest) = t.strip_prefix("día ").or_else(|| t.strip_prefix("dia ")) {
            let d: u32 = rest.trim().parse().ok()?;
            return if (1..=31).contains(&d) { Some(Rule::Monthly(d)) } else { None };
        }
        // Letras de días: «l x v», «lmx», «lunes miércoles»
        let mut days = [false; 7];
        let mut any = false;
        for tok in t.split(|c: char| c.is_whitespace() || c == ',') {
            let idx = match tok {
                "l" | "lu" | "lun" | "lunes" => Some(0),
                "m" | "ma" | "mar" | "martes" => Some(1),
                "x" | "mi" | "mié" | "mie" | "miércoles" | "miercoles" => Some(2),
                "j" | "ju" | "jue" | "jueves" => Some(3),
                "v" | "vi" | "vie" | "viernes" => Some(4),
                "s" | "sa" | "sáb" | "sab" | "sábado" | "sabado" => Some(5),
                "d" | "do" | "dom" | "domingo" => Some(6),
                "" => None,
                other if other.chars().all(|c| "lmxjvsd".contains(c)) && other.len() <= 7 => {
                    for c in other.chars() {
                        let i = LETTERS.iter().position(|&l| l.to_ascii_lowercase() == c).unwrap();
                        days[i] = true;
                        any = true;
                    }
                    None
                }
                _ => return None,
            };
            if let Some(i) = idx {
                days[i] = true;
                any = true;
            }
        }
        if any {
            Some(Rule::Weekdays(days))
        } else {
            None
        }
    }

    /// Descripción breve en español.
    pub fn describe(&self) -> String {
        match self {
            Rule::Daily => "cada día".into(),
            Rule::Weekdays(d) => {
                if *d == [true, true, true, true, true, false, false] {
                    return "laborables".into();
                }
                d.iter().zip(crate::dates::WEEKDAYS_SHORT).filter(|(on, _)| **on).map(|(_, n)| n).collect::<Vec<_>>().join(" ")
            }
            Rule::Every(1, Unit::Days) => "cada día".into(),
            Rule::Every(1, Unit::Weeks) => "cada semana".into(),
            Rule::Every(1, Unit::Months) => "cada mes".into(),
            Rule::Every(n, Unit::Days) => format!("cada {n} días"),
            Rule::Every(n, Unit::Weeks) => format!("cada {n} semanas"),
            Rule::Every(n, Unit::Months) => format!("cada {n} meses"),
            Rule::Monthly(d) => format!("el día {d} de cada mes"),
        }
    }

    /// Primera fecha estrictamente posterior a `after` que cumple la regla.
    pub fn next_after(&self, after: NaiveDate) -> NaiveDate {
        match self {
            Rule::Daily => after + Duration::days(1),
            Rule::Weekdays(days) => {
                let mut d = after + Duration::days(1);
                for _ in 0..7 {
                    if days[d.weekday().num_days_from_monday() as usize] {
                        return d;
                    }
                    d += Duration::days(1);
                }
                d
            }
            Rule::Every(n, Unit::Days) => after + Duration::days(*n as i64),
            Rule::Every(n, Unit::Weeks) => after + Duration::days(7 * *n as i64),
            Rule::Every(n, Unit::Months) => add_months(after, *n),
            Rule::Monthly(day) => {
                let (mut y, mut m) = (after.year(), after.month());
                let this_month = clamp_day(y, m, *day);
                if this_month > after {
                    return this_month;
                }
                if m == 12 {
                    y += 1;
                    m = 1;
                } else {
                    m += 1;
                }
                clamp_day(y, m, *day)
            }
        }
    }
}

fn clamp_day(y: i32, m: u32, d: u32) -> NaiveDate {
    let last = crate::dates::days_in_month(y, m);
    NaiveDate::from_ymd_opt(y, m, d.min(last)).unwrap()
}

pub fn add_months(d: NaiveDate, n: u32) -> NaiveDate {
    let total = d.month0() + n;
    let y = d.year() + (total / 12) as i32;
    let m = total % 12 + 1;
    clamp_day(y, m, d.day())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn storage_roundtrip() {
        for s in ["daily", "weekdays:LXV", "every:2:w", "monthly:31"] {
            assert_eq!(Rule::parse(s).unwrap().to_storage(), s);
        }
        assert!(Rule::parse("weekdays:").is_none());
        assert!(Rule::parse("every:0:d").is_none());
        assert!(Rule::parse("monthly:32").is_none());
    }

    #[test]
    fn human_parsing() {
        assert_eq!(Rule::parse_human("cada día"), Some(Rule::Daily));
        assert_eq!(Rule::parse_human("laborables"), Some(Rule::Weekdays([true, true, true, true, true, false, false])));
        assert_eq!(Rule::parse_human("L X V"), Some(Rule::Weekdays([true, false, true, false, true, false, false])));
        assert_eq!(Rule::parse_human("lmx"), Some(Rule::Weekdays([true, true, true, false, false, false, false])));
        assert_eq!(Rule::parse_human("cada 3 semanas"), Some(Rule::Every(3, Unit::Weeks)));
        assert_eq!(Rule::parse_human("día 15"), Some(Rule::Monthly(15)));
        assert_eq!(Rule::parse_human("nunca"), None);
        assert_eq!(Rule::parse_human("blabla"), None);
    }

    #[test]
    fn next_dates() {
        let thu = d("2026-11-05");
        assert_eq!(Rule::Daily.next_after(thu), d("2026-11-06"));
        assert_eq!(Rule::parse_human("L V").unwrap().next_after(thu), d("2026-11-06"));
        assert_eq!(Rule::parse_human("L").unwrap().next_after(thu), d("2026-11-09"));
        assert_eq!(Rule::Every(2, Unit::Weeks).next_after(thu), d("2026-11-19"));
        assert_eq!(Rule::Every(1, Unit::Months).next_after(d("2026-01-31")), d("2026-02-28"));
        assert_eq!(Rule::Monthly(31).next_after(d("2026-02-10")), d("2026-02-28"));
        assert_eq!(Rule::Monthly(5).next_after(thu), d("2026-12-05"));
        assert_eq!(Rule::Monthly(5).next_after(d("2026-11-04")), d("2026-11-05"));
    }

    #[test]
    fn describe_spanish() {
        assert_eq!(Rule::parse_human("laborables").unwrap().describe(), "laborables");
        assert_eq!(Rule::parse_human("L X").unwrap().describe(), "lun mié");
        assert_eq!(Rule::Every(2, Unit::Months).describe(), "cada 2 meses");
    }
}
