//! Visualizaciones de terminal: sparklines, barras y calendarios de actividad,
//! siempre con alternativa textual (nota C §3 y F §12.3).

use std::collections::HashSet;

use chrono::{Datelike, NaiveDate};

use crate::ui::Glyphs;

/// Sparkline de `values` en `width` celdas (toma los últimos `width` valores).
pub fn sparkline(values: &[f64], width: usize, g: &Glyphs) -> String {
    if values.is_empty() || width == 0 {
        return String::new();
    }
    let vals: Vec<f64> = values.iter().rev().take(width).rev().copied().collect();
    let min = vals.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = vals.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let levels = g.spark.len() as f64;
    vals.iter()
        .map(|v| {
            let t = if (max - min).abs() < 1e-12 { 0.5 } else { (v - min) / (max - min) };
            let i = ((t * (levels - 1.0)).round() as usize).min(g.spark.len() - 1);
            g.spark[i]
        })
        .collect()
}

/// Barra de progreso de `width` celdas con texto del «lado pequeño»
/// (Koo & Fishbach): «llevas N» por debajo del 50 %, «faltan N» por encima.
pub fn progress_bar(current: f64, target: f64, width: usize, unit: &str, g: &Glyphs) -> (String, String) {
    let ratio = if target <= 0.0 { 0.0 } else { (current / target).clamp(0.0, 1.0) };
    let filled = (ratio * width as f64).round() as usize;
    let bar = format!("{}{}", g.bar_full.repeat(filled), g.bar_empty.repeat(width.saturating_sub(filled)));
    let fmt = |v: f64| if (v - v.round()).abs() < 1e-9 { format!("{}", v as i64) } else { format!("{v:.1}").replace('.', ",") };
    let u = if unit.is_empty() { String::new() } else { format!(" {unit}") };
    let text = if ratio >= 1.0 {
        format!("{}{u} de {}{u}", fmt(current), fmt(target))
    } else if ratio < 0.5 {
        format!("llevas {}{u} de {}{u}", fmt(current), fmt(target))
    } else {
        format!("faltan {}{u} de {}{u}", fmt(target - current), fmt(target))
    };
    (bar, text)
}

/// Calendario de actividad de las últimas `weeks` semanas: una fila por semana
/// (lunes a domingo), `●` hecho, `·` sin registro, `○` marcado como no hecho,
/// espacio para días futuros. Devuelve filas de texto con su etiqueta.
pub fn activity_rows(done: &HashSet<NaiveDate>, not_done: &HashSet<NaiveDate>, today: NaiveDate, weeks: usize, g: &Glyphs) -> Vec<(String, String)> {
    let start = crate::dates::week_start(today) - chrono::Duration::days(7 * (weeks as i64 - 1));
    let mut rows = vec![];
    for w in 0..weeks {
        let ws = start + chrono::Duration::days(7 * w as i64);
        let mut row = String::new();
        for i in 0..7 {
            let d = ws + chrono::Duration::days(i);
            let c = if d > today {
                " "
            } else if done.contains(&d) {
                g.done
            } else if not_done.contains(&d) {
                g.todo
            } else {
                g.bullet
            };
            row.push_str(c);
            row.push(' ');
        }
        let label = format!("{} {}", ws.day(), crate::dates::MONTHS_SHORT[ws.month0() as usize]);
        rows.push((label, row.trim_end().to_string()));
    }
    rows
}

/// Gráfico de líneas sencillo: `height` filas, un carácter por punto.
pub fn line_chart(values: &[f64], width: usize, height: usize, g: &Glyphs) -> Vec<String> {
    if values.is_empty() || width == 0 || height == 0 {
        return vec![];
    }
    let vals: Vec<f64> = values.iter().rev().take(width).rev().copied().collect();
    let min = vals.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = vals.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let mut grid = vec![vec![' '; vals.len()]; height];
    for (x, v) in vals.iter().enumerate() {
        let t = if (max - min).abs() < 1e-12 { 0.5 } else { (v - min) / (max - min) };
        let row = height - 1 - ((t * (height - 1) as f64).round() as usize).min(height - 1);
        grid[row][x] = if g.ascii { '*' } else { '●' };
    }
    grid.into_iter().map(|r| r.into_iter().collect()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spark_and_bar() {
        let g = Glyphs::unicode();
        assert_eq!(sparkline(&[1.0, 2.0, 3.0], 3, &g), "▁▅█");
        assert_eq!(sparkline(&[5.0, 5.0], 2, &g), "▅▅");
        let (bar, text) = progress_bar(3.0, 10.0, 10, "", &g);
        assert_eq!(bar.chars().filter(|c| *c == '█').count(), 3);
        assert_eq!(text, "llevas 3 de 10");
        let (_, text) = progress_bar(8.0, 10.0, 10, "km", &g);
        assert_eq!(text, "faltan 2 km de 10 km");
        let (_, text) = progress_bar(12.0, 10.0, 10, "", &g);
        assert_eq!(text, "12 de 10");
    }

    #[test]
    fn activity_calendar_marks_gaps_neutrally() {
        let g = Glyphs::unicode();
        let today = NaiveDate::from_ymd_opt(2026, 11, 5).unwrap(); // jueves
        let mut done = HashSet::new();
        done.insert(today);
        done.insert(today - chrono::Duration::days(2));
        let mut nd = HashSet::new();
        nd.insert(today - chrono::Duration::days(1));
        let rows = activity_rows(&done, &nd, today, 1, &g);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, "2 nov");
        assert_eq!(rows[0].1, "· ● ○ ●");
    }

    #[test]
    fn chart_shape() {
        let g = Glyphs::ascii();
        let rows = line_chart(&[1.0, 2.0, 3.0], 3, 3, &g);
        assert_eq!(rows, vec!["  *", " * ", "*  "]);
    }
}
