/**
 * Acciones recurrentes de un objetivo («hábitos»). Se registran por día; un
 * hueco es un hueco, nunca un «no hecho» implícito. La métrica principal es la
 * frecuencia en ventana (7 / 30 días), no la racha de días consecutivos.
 * Portado de src/domain/actions.rs.
 */
import type { Database } from '../db/sqlite';
import { addDays, nowTs, weekStart, weekdayIndex } from './dates';
import { describe as ruleDescribe, parseHuman as ruleParseHuman, weekdays as ruleWeekdays } from './recurrence';

export type Id = number;

export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: boolean[] } // 7 posiciones, lunes primero
  /** N veces por semana, cualquier día. */
  | { kind: 'per_week'; n: number };

const LETTERS = 'LMXJVSD';

function parse(s: string): Schedule {
  if (s.startsWith('per_week:')) {
    const n = s.slice('per_week:'.length);
    if (/^\d+$/.test(n)) return { kind: 'per_week', n: Number(n) };
  }
  if (s.startsWith('weekdays:')) {
    const days = [false, false, false, false, false, false, false];
    for (const c of s.slice('weekdays:'.length)) {
      const i = LETTERS.indexOf(c.toUpperCase());
      if (i >= 0) days[i] = true;
    }
    return { kind: 'weekdays', days };
  }
  return { kind: 'daily' };
}

function toStorage(s: Schedule): string {
  switch (s.kind) {
    case 'daily':
      return 'daily';
    case 'weekdays':
      return `weekdays:${s.days.map((on, i) => (on ? LETTERS[i] : '')).join('')}`;
    case 'per_week':
      return `per_week:${s.n}`;
  }
}

/** «cada día», «laborables», «L X V», «3 veces por semana», «3/semana». */
function parseHuman(s: string): Schedule | null {
  const t = s.trim().toLowerCase();
  if (t === '') return null;
  const m = /^(\d+)\D/.exec(t);
  if (m && (t.includes('semana') || t.includes('/s'))) {
    const n = Number(m[1]);
    return n >= 1 && n <= 7 ? { kind: 'per_week', n } : null;
  }
  const r = ruleParseHuman(t);
  if (!r) return null;
  switch (r.kind) {
    case 'daily':
      return { kind: 'daily' };
    case 'weekdays':
      return { kind: 'weekdays', days: r.days };
    case 'every':
      return r.n === 1 && r.unit === 'weeks' ? { kind: 'per_week', n: 1 } : null;
    default:
      return null;
  }
}

function describe(s: Schedule): string {
  switch (s.kind) {
    case 'daily':
      return 'cada día';
    case 'weekdays':
      return ruleDescribe(ruleWeekdays(s.days));
    case 'per_week':
      return s.n === 1 ? '1 vez por semana' : `${s.n} veces por semana`;
  }
}

/** Veces previstas por semana. */
function perWeek(s: Schedule): number {
  switch (s.kind) {
    case 'daily':
      return 7;
    case 'weekdays':
      return s.days.filter(Boolean).length;
    case 'per_week':
      return s.n;
  }
}

function plannedOn(s: Schedule, day: string): boolean {
  return s.kind === 'weekdays' ? s.days[weekdayIndex(day)] : true;
}

export const Schedule = {
  parse,
  toStorage,
  parseHuman,
  describe,
  perWeek,
  plannedOn,
  daily: { kind: 'daily' } as Schedule,
  weekdays: (days: boolean[]): Schedule => ({ kind: 'weekdays', days }),
  perWeekOf: (n: number): Schedule => ({ kind: 'per_week', n }),
};

export interface Action {
  id: Id;
  goal_id: Id | null;
  name: string;
  cue: string;
  avoid: boolean;
  schedule: Schedule;
  paused: boolean;
  archived: boolean;
  created_at: number;
}

interface ActionRow {
  id: number;
  goal_id: number | null;
  name: string;
  cue: string;
  kind: string;
  schedule: string;
  paused_at: number | null;
  archived_at: number | null;
  created_at: number;
}

const SELECT = 'SELECT id, goal_id, name, cue, kind, schedule, paused_at, archived_at, created_at FROM actions';

function map(r: ActionRow): Action {
  return {
    id: r.id,
    goal_id: r.goal_id,
    name: r.name,
    cue: r.cue,
    avoid: r.kind === 'avoid',
    schedule: parse(r.schedule),
    paused: r.paused_at !== null,
    archived: r.archived_at !== null,
    created_at: r.created_at,
  };
}

export function create(db: Database, goalId: Id | null, name: string, schedule: Schedule, avoid: boolean): Id {
  return db.insert('INSERT INTO actions(goal_id, name, kind, schedule, created_at) VALUES (?1, ?2, ?3, ?4, ?5)', [
    goalId,
    name.trim(),
    avoid ? 'avoid' : 'do',
    toStorage(schedule),
    nowTs(),
  ]);
}

export function get(db: Database, id: Id): Action | undefined {
  const r = db.get<ActionRow>(`${SELECT} WHERE id = ?1`, [id]);
  return r ? map(r) : undefined;
}

export function listForGoal(db: Database, goalId: Id, includeArchived: boolean): Action[] {
  const sql = `${SELECT} WHERE goal_id = ?1 ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY archived_at IS NOT NULL, paused_at IS NOT NULL, id`;
  return db.all<ActionRow>(sql, [goalId]).map(map);
}

/** Acciones activas de todos los objetivos activos, para «Hoy» en Inicio. */
export function listActive(db: Database): Action[] {
  return db
    .all<ActionRow>(
      `${SELECT} WHERE archived_at IS NULL AND paused_at IS NULL AND (goal_id IS NULL OR goal_id IN (SELECT id FROM goals WHERE status = 'active' AND archived_at IS NULL)) ORDER BY id`,
    )
    .map(map);
}

export function setName(db: Database, id: Id, v: string): void {
  db.run('UPDATE actions SET name = ?2 WHERE id = ?1', [id, v.trim()]);
}
export function setCue(db: Database, id: Id, v: string): void {
  db.run('UPDATE actions SET cue = ?2 WHERE id = ?1', [id, v.trim()]);
}
export function setSchedule(db: Database, id: Id, s: Schedule): void {
  db.run('UPDATE actions SET schedule = ?2 WHERE id = ?1', [id, toStorage(s)]);
}
export function setPaused(db: Database, id: Id, paused: boolean): void {
  db.run('UPDATE actions SET paused_at = ?2 WHERE id = ?1', [id, paused ? nowTs() : null]);
}
export function setArchived(db: Database, id: Id, archived: boolean): void {
  db.run('UPDATE actions SET archived_at = ?2 WHERE id = ?1', [id, archived ? nowTs() : null]);
}
export function deleteAction(db: Database, id: Id): void {
  db.run('DELETE FROM actions WHERE id = ?1', [id]);
}
export { deleteAction as delete };

/**
 * Registra el día: `true` hecha, `false` registrada como no hecha (sólo si el
 * usuario lo indica), `null` borra el registro (vuelve a ser hueco).
 */
export function log(db: Database, actionId: Id, day: string, done: boolean | null, note: string): void {
  if (done === null) {
    db.run('DELETE FROM action_log WHERE action_id = ?1 AND day = ?2', [actionId, day]);
  } else {
    db.run(
      `INSERT INTO action_log(action_id, day, done, note, logged_at) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(action_id, day) DO UPDATE SET done = excluded.done, note = excluded.note, logged_at = excluded.logged_at`,
      [actionId, day, done ? 1 : 0, note, nowTs()],
    );
  }
}

/** Estado del día: `true` hecha, `false` marcada no hecha, `undefined` sin registro. */
export function statusOn(db: Database, actionId: Id, day: string): boolean | undefined {
  const v = db.scalar<number>('SELECT done FROM action_log WHERE action_id = ?1 AND day = ?2', [actionId, day]);
  return v === undefined ? undefined : v !== 0;
}

/** Días hechos en el rango [from, to], ascendente. */
export function doneDays(db: Database, actionId: Id, from: string, to: string): string[] {
  return db
    .all<{ day: string }>('SELECT day FROM action_log WHERE action_id = ?1 AND done = 1 AND day BETWEEN ?2 AND ?3 ORDER BY day', [actionId, from, to])
    .map((r) => r.day);
}

export function totalDone(db: Database, actionId: Id): number {
  return db.scalar<number>('SELECT count(*) FROM action_log WHERE action_id = ?1 AND done = 1', [actionId]) ?? 0;
}

export function firstDone(db: Database, actionId: Id): string | undefined {
  return db.scalar<string | null>('SELECT min(day) FROM action_log WHERE action_id = ?1 AND done = 1', [actionId]) ?? undefined;
}

/**
 * Resumen descriptivo: hechos en los últimos 7 y 30 días, previstos por semana,
 * semanas consecutivas (hasta la actual) en que se alcanzó la frecuencia, y total.
 */
export interface Summary {
  last7: number;
  last30: number;
  per_week: number;
  this_week: number;
  last_week: number;
  weeks_meeting_target: number;
  total: number;
}

export function summary(db: Database, action: Action, today: string): Summary {
  const from = addDays(today, -120);
  const days = doneDays(db, action.id, from, today);
  const d7 = addDays(today, -7);
  const d30 = addDays(today, -30);
  const last7 = days.filter((d) => d > d7).length;
  const last30 = days.filter((d) => d > d30).length;
  const ws = weekStart(today);
  const prevWs = addDays(ws, -7);
  const thisWeek = days.filter((d) => d >= ws).length;
  const lastWeek = days.filter((d) => d >= prevWs && d < ws).length;
  const target = perWeek(action.schedule);
  // Semanas completas anteriores consecutivas con frecuencia alcanzada (la actual cuenta si ya la alcanzó).
  let weeks = 0;
  let w = ws;
  if (thisWeek >= target) weeks++;
  const floor = addDays(from, 7);
  for (;;) {
    const start = addDays(w, -7);
    if (start < floor) break;
    const n = days.filter((d) => d >= start && d < w).length;
    if (n >= target) {
      weeks++;
      w = start;
    } else {
      break;
    }
  }
  return {
    last7,
    last30,
    per_week: target,
    this_week: thisWeek,
    last_week: lastWeek,
    weeks_meeting_target: weeks,
    total: totalDone(db, action.id),
  };
}
