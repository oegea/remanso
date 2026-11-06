/**
 * Visualizaciones: sparklines, barras y calendarios de actividad, siempre con
 * alternativa textual (nota C §3 y F §12.3). Portado de src/analysis/spark.rs:
 * aquí devolvemos niveles normalizados y estados; la interfaz dibuja (SVG) o
 * usa los glifos de texto.
 */
import { addDays, MONTHS_SHORT, parseDay, weekStart } from '../dates';

/** Normaliza `values` a 0..1 tomando los últimos `width` valores. */
function normalise(values: readonly number[], width: number): number[] {
  if (values.length === 0 || width <= 0) return [];
  const vals = values.slice(Math.max(0, values.length - width));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return vals.map((v) => (Math.abs(max - min) < 1e-12 ? 0.5 : (v - min) / (max - min)));
}

/** Sparkline de `values` en `width` celdas: niveles 0..1 de los últimos `width` valores. */
export function sparkline(values: readonly number[], width: number): number[] {
  return normalise(values, width);
}

export const SPARK_GLYPHS: readonly string[] = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
export const SPARK_GLYPHS_ASCII: readonly string[] = ['.', ':', '-', '=', '+', '*', '%', '#'];

/** Alternativa textual de la sparkline. */
export function sparklineText(values: readonly number[], width: number, glyphs: readonly string[] = SPARK_GLYPHS): string {
  const levels = glyphs.length;
  return sparkline(values, width)
    .map((t) => glyphs[Math.min(Math.round(t * (levels - 1)), levels - 1)])
    .join('');
}

const fmtNum = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.trunc(v)) : v.toFixed(1).replace('.', ','));

export interface ProgressBar {
  /** Fracción 0..1 (recortada). */
  ratio: number;
  /** Celdas llenas de `width`. */
  filled: number;
  /** Texto del «lado pequeño». */
  text: string;
}

/**
 * Barra de progreso de `width` celdas con texto del «lado pequeño»
 * (Koo & Fishbach): «llevas N» por debajo del 50 %, «faltan N» por encima.
 */
export function progressBar(current: number, target: number, width: number, unit: string): ProgressBar {
  const ratio = target <= 0 ? 0 : Math.min(1, Math.max(0, current / target));
  const filled = Math.round(ratio * width);
  const u = unit === '' ? '' : ` ${unit}`;
  let text: string;
  if (ratio >= 1) text = `${fmtNum(current)}${u} de ${fmtNum(target)}${u}`;
  else if (ratio < 0.5) text = `llevas ${fmtNum(current)}${u} de ${fmtNum(target)}${u}`;
  else text = `faltan ${fmtNum(target - current)}${u} de ${fmtNum(target)}${u}`;
  return { ratio, filled, text };
}

/** Estado de un día en el calendario: hecho, marcado no hecho, sin registro (hueco ≠ fallo), futuro. */
export type DayState = 'done' | 'not' | 'blank' | 'future';

export interface ActivityRow {
  /** «2 nov»: lunes de la semana. */
  label: string;
  /** Lunes de la semana ('AAAA-MM-DD'). */
  weekStart: string;
  /** Lunes a domingo. */
  days: DayState[];
}

/**
 * Calendario de actividad de las últimas `weeks` semanas: una fila por semana
 * (lunes a domingo); `done` hecho, `blank` sin registro, `not` marcado como no
 * hecho, `future` para días futuros.
 */
export function activityRows(done: ReadonlySet<string>, notDone: ReadonlySet<string>, today: string, weeks: number): ActivityRow[] {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const rows: ActivityRow[] = [];
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(start, 7 * w);
    const days: DayState[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      days.push(d > today ? 'future' : done.has(d) ? 'done' : notDone.has(d) ? 'not' : 'blank');
    }
    const wd = parseDay(ws)!;
    rows.push({ label: `${wd.getDate()} ${MONTHS_SHORT[wd.getMonth()]}`, weekStart: ws, days });
  }
  return rows;
}

export const ACTIVITY_GLYPHS: Readonly<Record<DayState, string>> = { done: '●', not: '○', blank: '·', future: ' ' };

/** Alternativa textual de una fila del calendario: «· ● ○ ●». */
export function activityRowText(days: readonly DayState[], glyphs: Readonly<Record<DayState, string>> = ACTIVITY_GLYPHS): string {
  return days.map((s) => glyphs[s]).join(' ').trimEnd();
}

export interface ChartPoint {
  /** Posición horizontal 0..1 (0,5 si hay un solo punto). */
  x: number;
  /** Nivel 0..1 (0 = mínimo, 1 = máximo; 0,5 si la serie es constante). */
  y: number;
}

/** Gráfico de líneas sencillo: puntos normalizados de los últimos `width` valores. */
export function lineChart(values: readonly number[], width: number): ChartPoint[] {
  const ys = normalise(values, width);
  const n = ys.length;
  return ys.map((y, i) => ({ x: n === 1 ? 0.5 : i / (n - 1), y }));
}

/** Fila (0 = arriba) de un punto en una rejilla de `height` filas, como en el terminal. */
export function chartRow(y: number, height: number): number {
  return height - 1 - Math.min(Math.round(y * (height - 1)), height - 1);
}
