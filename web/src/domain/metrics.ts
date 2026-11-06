/**
 * Métricas genéricas y mediciones (nota F §12). Portado de src/domain/metrics.rs.
 */
import type { Database } from '../db/sqlite';
import { addDays, nowTs, parseDay, parseTimeInput, today } from './dates';

export type Id = number;

/**
 * number   decimal con unidad (peso, km…)
 * yes_no   hecho / no hecho
 * scale    escala ordinal con mínimo y máximo (ánimo, energía…); dirección `observe` por defecto
 * duration minutos
 * count    entero por registro (páginas, sesiones…)
 * time     hora del día (minutos desde medianoche), para regularidad de horarios
 * text     texto breve
 */
export type MetricKind = 'number' | 'yes_no' | 'scale' | 'duration' | 'count' | 'time' | 'text';

export const METRIC_KINDS: readonly MetricKind[] = ['number', 'yes_no', 'scale', 'duration', 'count', 'time', 'text'];

export function parseMetricKind(s: string): MetricKind {
  switch (s) {
    case 'yes_no':
    case 'scale':
    case 'duration':
    case 'count':
    case 'time':
    case 'text':
      return s;
    default:
      return 'number';
  }
}

export function metricKindLabel(k: MetricKind): string {
  switch (k) {
    case 'number':
      return 'número con unidad (72,4 kg; 5 km)';
    case 'yes_no':
      return 'sí / no';
    case 'scale':
      return 'escala (0–10, 1–5)';
    case 'duration':
      return 'duración en minutos';
    case 'count':
      return 'cantidad entera (páginas, sesiones)';
    case 'time':
      return 'hora del día (23:15)';
    case 'text':
      return 'texto breve';
  }
}

export const isNumeric = (k: MetricKind): boolean => k !== 'text';

export type Direction = 'up' | 'down' | 'maintain' | 'range' | 'observe';

/** Orden de oferta: observar y mantener antes que bajar (nota F §12.2). */
export const DIRECTIONS: readonly Direction[] = ['observe', 'maintain', 'range', 'up', 'down'];

export function parseDirection(s: string): Direction {
  switch (s) {
    case 'up':
    case 'down':
    case 'maintain':
    case 'range':
      return s;
    default:
      return 'observe';
  }
}

export function directionLabel(d: Direction): string {
  switch (d) {
    case 'up':
      return 'subir';
    case 'down':
      return 'bajar';
    case 'maintain':
      return 'mantener alrededor de un valor';
    case 'range':
      return 'mantenerse en un intervalo';
    case 'observe':
      return 'sólo observar';
  }
}

export type Frequency = 'daily' | 'weekly' | 'adhoc';

export const FREQUENCIES: readonly Frequency[] = ['daily', 'weekly', 'adhoc'];

export function parseFrequency(s: string): Frequency {
  switch (s) {
    case 'daily':
    case 'weekly':
      return s;
    default:
      return 'adhoc';
  }
}

export function frequencyLabel(f: Frequency): string {
  switch (f) {
    case 'daily':
      return 'diaria';
    case 'weekly':
      return 'semanal';
    case 'adhoc':
      return 'cuando quiera';
  }
}

export interface Metric {
  id: Id;
  goal_id: Id | null;
  name: string;
  kind: MetricKind;
  unit: string;
  direction: Direction;
  target_low: number | null;
  target_high: number | null;
  scale_min: number;
  scale_max: number;
  frequency: Frequency;
  sensitive: boolean;
  archived: boolean;
  count: number;
  last_at: number | null;
}

export interface Measurement {
  id: Id;
  metric_id: Id;
  measured_at: number;
  day: string;
  value: number | null;
  text_value: string | null;
  note: string;
}

/** Punto de una serie diaria: `day` 'AAAA-MM-DD', `value` numérico. */
export interface DayValue {
  day: string;
  value: number;
}

interface MetricRow {
  id: number;
  goal_id: number | null;
  name: string;
  kind: string;
  unit: string;
  direction: string;
  target_low: number | null;
  target_high: number | null;
  scale_min: number | null;
  scale_max: number | null;
  frequency: string;
  sensitive: number;
  archived_at: number | null;
  count: number;
  last_at: number | null;
}

const SELECT = `SELECT m.id, m.goal_id, m.name, m.kind, m.unit, m.direction, m.target_low, m.target_high, m.scale_min, m.scale_max,
    m.frequency, m.sensitive, m.archived_at,
    (SELECT count(*) FROM measurements x WHERE x.metric_id = m.id) AS count,
    (SELECT max(measured_at) FROM measurements x WHERE x.metric_id = m.id) AS last_at
    FROM metrics m`;

function map(r: MetricRow): Metric {
  return {
    id: r.id,
    goal_id: r.goal_id,
    name: r.name,
    kind: parseMetricKind(r.kind),
    unit: r.unit,
    direction: parseDirection(r.direction),
    target_low: r.target_low,
    target_high: r.target_high,
    scale_min: r.scale_min ?? 0,
    scale_max: r.scale_max ?? 10,
    frequency: parseFrequency(r.frequency),
    sensitive: r.sensitive !== 0,
    archived: r.archived_at !== null,
    count: r.count,
    last_at: r.last_at,
  };
}

export interface NewMetric {
  goal_id: Id | null;
  name: string;
  kind: MetricKind;
  unit: string;
  sensitive: boolean;
}

export function create(db: Database, m: NewMetric): Id {
  // Frecuencia sugerida por tipo (nota F §12.4): peso/sensibles semanal; resto diaria o libre.
  let freq: Frequency;
  if (m.sensitive) freq = 'weekly';
  else if (m.kind === 'yes_no' || m.kind === 'count' || m.kind === 'scale' || m.kind === 'time') freq = 'daily';
  else freq = 'adhoc';
  const [smin, smax] = m.kind === 'scale' ? [0, 10] : [null, null];
  return db.insert(
    `INSERT INTO metrics(goal_id, name, kind, unit, direction, scale_min, scale_max, frequency, sensitive, created_at)
         VALUES (?1, ?2, ?3, ?4, 'observe', ?5, ?6, ?7, ?8, ?9)`,
    [m.goal_id, m.name.trim(), m.kind, m.unit.trim(), smin, smax, freq, m.sensitive ? 1 : 0, nowTs()],
  );
}

export function get(db: Database, id: Id): Metric | undefined {
  const r = db.get<MetricRow>(`${SELECT} WHERE m.id = ?1`, [id]);
  return r ? map(r) : undefined;
}

export function listForGoal(db: Database, goalId: Id, includeArchived: boolean): Metric[] {
  const sql = `${SELECT} WHERE m.goal_id = ?1 ${includeArchived ? '' : 'AND m.archived_at IS NULL'} ORDER BY m.archived_at IS NOT NULL, m.id`;
  return db.all<MetricRow>(sql, [goalId]).map(map);
}

export function countActive(db: Database): number {
  return db.scalar<number>('SELECT count(*) FROM metrics WHERE archived_at IS NULL') ?? 0;
}

function set(db: Database, id: Id, field: string, v: string | number | null): void {
  db.run(`UPDATE metrics SET ${field} = ?2 WHERE id = ?1`, [id, v]);
}

export const setName = (db: Database, id: Id, v: string) => set(db, id, 'name', v.trim());
export const setUnit = (db: Database, id: Id, v: string) => set(db, id, 'unit', v.trim());
export const setDirection = (db: Database, id: Id, d: Direction) => set(db, id, 'direction', d);
export function setTargets(db: Database, id: Id, low: number | null, high: number | null): void {
  db.run('UPDATE metrics SET target_low = ?2, target_high = ?3 WHERE id = ?1', [id, low, high]);
}
export function setScale(db: Database, id: Id, min: number, max: number): void {
  db.run('UPDATE metrics SET scale_min = ?2, scale_max = ?3 WHERE id = ?1', [id, min, max]);
}
export const setFrequency = (db: Database, id: Id, f: Frequency) => set(db, id, 'frequency', f);
export const setSensitive = (db: Database, id: Id, v: boolean) => set(db, id, 'sensitive', v ? 1 : 0);
/** Pausar/archivar nunca borra mediciones. */
export const setArchived = (db: Database, id: Id, archived: boolean) => set(db, id, 'archived_at', archived ? nowTs() : null);
export function deleteMetric(db: Database, id: Id): void {
  db.run('DELETE FROM metrics WHERE id = ?1', [id]);
}
export { deleteMetric as delete };

/** Número decimal estricto (como `str::parse::<f64>`): sin espacios ni basura alrededor. */
function parseFloatStrict(s: string): number | undefined {
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return undefined;
  const v = Number(s);
  return Number.isFinite(v) ? v : undefined;
}

function parseIntStrict(s: string): number | undefined {
  if (!/^[+-]?\d+$/.test(s)) return undefined;
  return Number(s);
}

export interface ParsedValue {
  value: number | null;
  text: string | null;
}

/** Interpreta un valor escrito según el tipo. Devuelve {valor numérico, texto} o undefined. */
export function parseValue(kind: MetricKind, input: string, scaleMin: number, scaleMax: number): ParsedValue | undefined {
  const t = input.trim();
  if (t === '') return undefined;
  const num = (value: number): ParsedValue => ({ value, text: null });
  switch (kind) {
    case 'text':
      return { value: null, text: t };
    case 'yes_no':
      switch (t.toLowerCase()) {
        case 's':
        case 'si':
        case 'sí':
        case '1':
        case 'y':
        case 'hecho':
          return num(1);
        case 'n':
        case 'no':
        case '0':
          return num(0);
        default:
          return undefined;
      }
    case 'time': {
      const hm = parseTimeInput(t);
      if (!hm) return undefined;
      return num(hm[0] * 60 + hm[1]);
    }
    case 'duration': {
      // «45», «1:30», «1h30», «90 min»
      const s = t.toLowerCase().replace(' min', '').replace('min', '');
      const sep = s.includes(':') ? ':' : s.includes('h') ? 'h' : null;
      if (sep) {
        const i = s.indexOf(sep);
        const hs = s.slice(0, i).trim();
        const ms = s.slice(i + 1).trim();
        const h = parseFloatStrict(hs);
        if (h === undefined) return undefined;
        const m = ms === '' ? 0 : parseFloatStrict(ms);
        if (m === undefined) return undefined;
        return num(h * 60 + m);
      }
      const v = parseFloatStrict(s.trim());
      return v === undefined ? undefined : num(v);
    }
    case 'scale': {
      const v = parseFloatStrict(t.replace(',', '.'));
      if (v === undefined || v < scaleMin || v > scaleMax) return undefined;
      return num(v);
    }
    case 'count': {
      const v = parseIntStrict(t);
      return v === undefined ? undefined : num(v);
    }
    case 'number': {
      let cleaned = '';
      for (const c of t) {
        if ((c >= '0' && c <= '9') || c === ',' || c === '.' || c === '-') cleaned += c;
        else break;
      }
      const v = parseFloatStrict(cleaned.replace(',', '.'));
      return v === undefined ? undefined : num(v);
    }
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Formatea un valor según el tipo (sin juicios: sólo el dato). */
export function formatValue(kind: MetricKind, value: number | null, text: string | null, unit: string): string {
  if (kind === 'text') return text ?? '';
  if (value === null) return '';
  const v = value;
  switch (kind) {
    case 'yes_no':
      return v >= 0.5 ? 'sí' : 'no';
    case 'time': {
      const t = Math.trunc(v);
      return `${pad2(Math.trunc(t / 60) % 24)}:${pad2(t % 60)}`;
    }
    case 'duration': {
      const m = Math.round(v);
      return m >= 60 ? `${Math.trunc(m / 60)}h ${pad2(m % 60)}min` : `${m} min`;
    }
    case 'count':
      return `${Math.trunc(v)}${unit === '' ? '' : ` ${unit}`}`;
    default: {
      const s = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.trunc(v)) : v.toFixed(1).replace('.', ',');
      return unit === '' ? s : `${s} ${unit}`;
    }
  }
}

export function record(db: Database, metricId: Id, day: string, value: number | null, text: string | null, note: string): Id {
  return db.insert('INSERT INTO measurements(metric_id, measured_at, day, value, text_value, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)', [
    metricId,
    nowTs(),
    day,
    value,
    text,
    note,
  ]);
}

export function deleteMeasurement(db: Database, id: Id): void {
  db.run('DELETE FROM measurements WHERE id = ?1', [id]);
}

export function measurements(db: Database, metricId: Id, limit: number): Measurement[] {
  return db.all<Measurement>(
    'SELECT id, metric_id, measured_at, day, value, text_value, note FROM measurements WHERE metric_id = ?1 ORDER BY day DESC, measured_at DESC LIMIT ?2',
    [metricId, limit],
  );
}

/**
 * Serie (día, valor) ascendente; si hay varias mediciones un mismo día se
 * usa la media (o la suma para `count`/`duration`, que se acumulan).
 */
export function dailySeries(db: Database, metric: Metric, daysBack: number): DayValue[] {
  const from = addDays(today(), -daysBack);
  const agg = metric.kind === 'count' || metric.kind === 'duration' ? 'sum(value)' : 'avg(value)';
  return db
    .all<{ day: string; value: number }>(
      `SELECT day, ${agg} AS value FROM measurements WHERE metric_id = ?1 AND value IS NOT NULL AND day >= ?2 GROUP BY day ORDER BY day`,
      [metric.id, from],
    )
    .filter((r) => parseDay(r.day) !== null)
    .map((r) => ({ day: r.day, value: r.value }));
}
