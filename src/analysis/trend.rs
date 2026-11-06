//! Tendencias (nota F §12.3): puntos crudos en segundo plano, suavizado en
//! primer plano, N mínimo antes de hablar de tendencia, sin imputación, sin
//! deltas día a día.

use chrono::NaiveDate;

use crate::domain::metrics::MetricKind;

/// Media móvil exponencial (α = 0,1 por defecto para series diarias ruidosas).
pub fn ewma(values: &[f64], alpha: f64) -> Vec<f64> {
    let mut out = Vec::with_capacity(values.len());
    let mut acc: Option<f64> = None;
    for &v in values {
        let next = match acc {
            None => v,
            Some(a) => a + alpha * (v - a),
        };
        acc = Some(next);
        out.push(next);
    }
    out
}

/// Media de los puntos cuya fecha cae en los `window` días anteriores a cada punto
/// (inclusive). Las ausencias no se imputan: la ventana usa sólo lo que hay.
pub fn moving_average(series: &[(NaiveDate, f64)], window: i64) -> Vec<(NaiveDate, f64)> {
    series
        .iter()
        .map(|(d, _)| {
            let from = *d - chrono::Duration::days(window - 1);
            let vals: Vec<f64> = series.iter().filter(|(x, _)| *x >= from && *x <= *d).map(|(_, v)| *v).collect();
            (*d, vals.iter().sum::<f64>() / vals.len() as f64)
        })
        .collect()
}

/// Nivel actual para comparar con objetivos: media de los últimos 7 días para
/// métricas ruidosas (números), último valor para el resto.
pub fn current_level(series: &[(NaiveDate, f64)], kind: MetricKind) -> Option<f64> {
    let last = series.last()?;
    match kind {
        MetricKind::Number | MetricKind::Scale => {
            let from = last.0 - chrono::Duration::days(6);
            let vals: Vec<f64> = series.iter().filter(|(d, _)| *d >= from).map(|(_, v)| *v).collect();
            Some(vals.iter().sum::<f64>() / vals.len() as f64)
        }
        _ => Some(last.1),
    }
}

/// N mínimo antes de dibujar una tendencia (nota F §12.3). Devuelve `Err(texto)`
/// con el mensaje neutro a mostrar cuando aún no hay datos suficientes.
pub fn enough_for_trend(series: &[(NaiveDate, f64)], kind: MetricKind, weekly: bool) -> Result<(), String> {
    let n = series.len();
    let (need, span_days) = match (kind, weekly) {
        (MetricKind::Number, false) => (7, 7),
        (MetricKind::Number, true) => (4, 0),
        (MetricKind::Scale, _) => (5, 0),
        (MetricKind::Time, _) => (5, 0),
        _ => (4, 0),
    };
    let span_ok = span_days == 0
        || series.first().zip(series.last()).map(|(a, b)| (b.0 - a.0).num_days() + 1 >= span_days).unwrap_or(false);
    if n >= need && span_ok {
        Ok(())
    } else {
        Err(format!(
            "Todavía no hay datos suficientes para ver una tendencia ({} de {} registros). Las variaciones de un día a otro son normales.",
            n.min(need),
            need
        ))
    }
}

/// Pendiente por regresión lineal simple (unidades por día) sobre la serie.
pub fn slope_per_day(series: &[(NaiveDate, f64)]) -> Option<f64> {
    if series.len() < 2 {
        return None;
    }
    let x0 = series[0].0;
    let xs: Vec<f64> = series.iter().map(|(d, _)| (*d - x0).num_days() as f64).collect();
    let ys: Vec<f64> = series.iter().map(|(_, v)| *v).collect();
    let n = xs.len() as f64;
    let mx = xs.iter().sum::<f64>() / n;
    let my = ys.iter().sum::<f64>() / n;
    let sxx: f64 = xs.iter().map(|x| (x - mx).powi(2)).sum();
    if sxx == 0.0 {
        return None;
    }
    let sxy: f64 = xs.iter().zip(&ys).map(|(x, y)| (x - mx) * (y - my)).sum();
    Some(sxy / sxx)
}

/// Comparación descriptiva: media de los últimos 7 días frente a los 7 anteriores.
pub fn week_over_week(series: &[(NaiveDate, f64)], today: NaiveDate, sum: bool) -> (Option<f64>, Option<f64>) {
    let agg = |from: NaiveDate, to: NaiveDate| -> Option<f64> {
        let vals: Vec<f64> = series.iter().filter(|(d, _)| *d > from && *d <= to).map(|(_, v)| *v).collect();
        if vals.is_empty() {
            None
        } else if sum {
            Some(vals.iter().sum())
        } else {
            Some(vals.iter().sum::<f64>() / vals.len() as f64)
        }
    };
    (agg(today - chrono::Duration::days(7), today), agg(today - chrono::Duration::days(14), today - chrono::Duration::days(7)))
}

/// Texto neutro del cambio: «subió 0,4 kg respecto a la semana anterior».
pub fn describe_change(this: Option<f64>, last: Option<f64>, unit: &str, decimals: usize) -> Option<String> {
    let (a, b) = (this?, last?);
    let diff = a - b;
    let fmt = |v: f64| format!("{:.*}", decimals, v.abs()).replace('.', ",");
    let u = if unit.is_empty() { String::new() } else { format!(" {unit}") };
    Some(if diff.abs() < 10f64.powi(-(decimals as i32)) / 2.0 {
        "sin cambios respecto a la semana anterior".into()
    } else if diff > 0.0 {
        format!("subió {}{u} respecto a la media de la semana anterior", fmt(diff))
    } else {
        format!("bajó {}{u} respecto a la media de la semana anterior", fmt(diff))
    })
}

/// Regularidad horaria (métricas `time`): desviación típica en minutos de las
/// horas registradas, tratando la medianoche de forma circular.
pub fn time_regularity_minutes(values: &[f64]) -> Option<f64> {
    if values.len() < 3 {
        return None;
    }
    // Convertir a ángulo para evitar el salto de 23:59 → 00:00.
    let n = values.len() as f64;
    let (mut sx, mut sy) = (0.0, 0.0);
    for v in values {
        let a = v / 1440.0 * std::f64::consts::TAU;
        sx += a.cos();
        sy += a.sin();
    }
    let mean = (sy / n).atan2(sx / n);
    let mut var = 0.0;
    for v in values {
        let a = v / 1440.0 * std::f64::consts::TAU;
        let mut d = a - mean;
        while d > std::f64::consts::PI {
            d -= std::f64::consts::TAU;
        }
        while d < -std::f64::consts::PI {
            d += std::f64::consts::TAU;
        }
        var += d * d;
    }
    Some(((var / n).sqrt() / std::f64::consts::TAU * 1440.0).round())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(i: i64) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 1, 1).unwrap() + chrono::Duration::days(i)
    }

    #[test]
    fn ewma_and_moving_average() {
        let e = ewma(&[10.0, 20.0], 0.5);
        assert_eq!(e, vec![10.0, 15.0]);
        let s: Vec<(NaiveDate, f64)> = (0..10).map(|i| (d(i), i as f64)).collect();
        let ma = moving_average(&s, 7);
        assert_eq!(ma[9].1, 6.0);
        assert_eq!(ma[0].1, 0.0);
    }

    #[test]
    fn minimum_n_rules() {
        let s: Vec<(NaiveDate, f64)> = (0..3).map(|i| (d(i), 70.0)).collect();
        let msg = enough_for_trend(&s, MetricKind::Number, false).unwrap_err();
        assert!(msg.contains("3 de 7"));
        let s7: Vec<(NaiveDate, f64)> = (0..7).map(|i| (d(i), 70.0)).collect();
        assert!(enough_for_trend(&s7, MetricKind::Number, false).is_ok());
        // Siete registros en tres días no cubren siete días naturales.
        let dense: Vec<(NaiveDate, f64)> = (0..7).map(|i| (d(i / 3), 70.0)).collect();
        assert!(enough_for_trend(&dense, MetricKind::Number, false).is_err());
    }

    #[test]
    fn slope_and_change() {
        let s: Vec<(NaiveDate, f64)> = (0..14).map(|i| (d(i), 80.0 - 0.1 * i as f64)).collect();
        let sl = slope_per_day(&s).unwrap();
        assert!((sl + 0.1).abs() < 1e-9);
        let (this, last) = week_over_week(&s, d(13), false);
        let txt = describe_change(this, last, "kg", 1).unwrap();
        assert_eq!(txt, "bajó 0,7 kg respecto a la media de la semana anterior");
        assert_eq!(describe_change(Some(1.0), Some(1.0), "", 1).unwrap(), "sin cambios respecto a la semana anterior");
    }

    #[test]
    fn circular_time_regularity() {
        // 23:50, 00:10, 00:00 → muy regular pese al cruce de medianoche.
        let r = time_regularity_minutes(&[1430.0, 10.0, 0.0]).unwrap();
        assert!(r < 15.0, "{r}");
        let r2 = time_regularity_minutes(&[1200.0, 1380.0, 60.0]).unwrap();
        assert!(r2 > 60.0);
    }
}
