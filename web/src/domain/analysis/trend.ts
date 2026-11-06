/**
 * Tendencias (nota F §12.3): puntos crudos en segundo plano, suavizado en
 * primer plano, N mínimo antes de hablar de tendencia, sin imputación, sin
 * deltas día a día. Portado de src/analysis/trend.rs.
 */
import { addDays, diffDays } from '../dates';
import type { DayValue, MetricKind } from '../metrics';

export type Series = readonly DayValue[];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;

/** Media móvil exponencial (α = 0,1 por defecto para series diarias ruidosas). */
export function ewma(values: readonly number[], alpha = 0.1): number[] {
  const out: number[] = [];
  let acc: number | null = null;
  for (const v of values) {
    acc = acc === null ? v : acc + alpha * (v - acc);
    out.push(acc);
  }
  return out;
}

/**
 * Media de los puntos cuya fecha cae en los `window` días anteriores a cada punto
 * (inclusive). Las ausencias no se imputan: la ventana usa sólo lo que hay.
 */
export function movingAverage(series: Series, window: number): DayValue[] {
  return series.map((p) => {
    const from = addDays(p.day, -(window - 1));
    const vals = series.filter((x) => x.day >= from && x.day <= p.day).map((x) => x.value);
    return { day: p.day, value: mean(vals) };
  });
}

/**
 * Nivel actual para comparar con objetivos: media de los últimos 7 días para
 * métricas ruidosas (números), último valor para el resto.
 */
export function currentLevel(series: Series, kind: MetricKind): number | undefined {
  const last = series[series.length - 1];
  if (!last) return undefined;
  if (kind === 'number' || kind === 'scale') {
    const from = addDays(last.day, -6);
    return mean(series.filter((p) => p.day >= from).map((p) => p.value));
  }
  return last.value;
}

export type TrendReadiness = { ok: true } | { ok: false; message: string };

/**
 * N mínimo antes de dibujar una tendencia (nota F §12.3). Devuelve `{ok:false, message}`
 * con el mensaje neutro a mostrar cuando aún no hay datos suficientes.
 */
export function enoughForTrend(series: Series, kind: MetricKind, weekly: boolean): TrendReadiness {
  const n = series.length;
  let need: number;
  let spanDays: number;
  if (kind === 'number') [need, spanDays] = weekly ? [4, 0] : [7, 7];
  else if (kind === 'scale' || kind === 'time') [need, spanDays] = [5, 0];
  else [need, spanDays] = [4, 0];
  const first = series[0];
  const last = series[n - 1];
  const spanOk = spanDays === 0 || (first !== undefined && last !== undefined && diffDays(last.day, first.day) + 1 >= spanDays);
  if (n >= need && spanOk) return { ok: true };
  return {
    ok: false,
    message: `Todavía no hay datos suficientes para ver una tendencia (${Math.min(n, need)} de ${need} registros). Las variaciones de un día a otro son normales.`,
  };
}

/** Pendiente por regresión lineal simple (unidades por día) sobre la serie. */
export function slopePerDay(series: Series): number | undefined {
  if (series.length < 2) return undefined;
  const x0 = series[0].day;
  const xs = series.map((p) => diffDays(p.day, x0));
  const ys = series.map((p) => p.value);
  const mx = mean(xs);
  const my = mean(ys);
  const sxx = sum(xs.map((x) => (x - mx) ** 2));
  if (sxx === 0) return undefined;
  const sxy = sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  return sxy / sxx;
}

/** Comparación descriptiva: media (o suma) de los últimos 7 días frente a los 7 anteriores. */
export function weekOverWeek(series: Series, today: string, useSum: boolean): [number | undefined, number | undefined] {
  const agg = (from: string, to: string): number | undefined => {
    const vals = series.filter((p) => p.day > from && p.day <= to).map((p) => p.value);
    if (vals.length === 0) return undefined;
    return useSum ? sum(vals) : mean(vals);
  };
  return [agg(addDays(today, -7), today), agg(addDays(today, -14), addDays(today, -7))];
}

/** Texto neutro del cambio: «subió 0,4 kg respecto a la media de la semana anterior». */
export function describeChange(current: number | undefined, previous: number | undefined, unit: string, decimals: number): string | undefined {
  if (current === undefined || previous === undefined) return undefined;
  const diff = current - previous;
  const fmt = (v: number) => Math.abs(v).toFixed(decimals).replace('.', ',');
  const u = unit === '' ? '' : ` ${unit}`;
  if (Math.abs(diff) < 10 ** -decimals / 2) return 'sin cambios respecto a la semana anterior';
  if (diff > 0) return `subió ${fmt(diff)}${u} respecto a la media de la semana anterior`;
  return `bajó ${fmt(diff)}${u} respecto a la media de la semana anterior`;
}

/**
 * Regularidad horaria (métricas `time`): desviación típica en minutos de las
 * horas registradas, tratando la medianoche de forma circular.
 */
export function timeRegularityMinutes(values: readonly number[]): number | undefined {
  if (values.length < 3) return undefined;
  // Convertir a ángulo para evitar el salto de 23:59 → 00:00.
  const TAU = 2 * Math.PI;
  const n = values.length;
  let sx = 0;
  let sy = 0;
  for (const v of values) {
    const a = (v / 1440) * TAU;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  const m = Math.atan2(sy / n, sx / n);
  let variance = 0;
  for (const v of values) {
    const a = (v / 1440) * TAU;
    let d = a - m;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    variance += d * d;
  }
  return Math.round((Math.sqrt(variance / n) / TAU) * 1440);
}
