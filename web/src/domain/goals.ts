/**
 * Objetivos: motor genérico, sin pantallas específicas por tipo de cambio.
 * Portado de src/domain/goals.rs.
 */
import type { Database } from '../db/sqlite';
import { nowTs, today } from './dates';

export type Id = number;

export type GoalStatus = 'active' | 'paused' | 'achieved' | 'closed';

export function parseGoalStatus(s: string): GoalStatus {
  switch (s) {
    case 'paused':
    case 'achieved':
    case 'closed':
      return s;
    default:
      return 'active';
  }
}

export function goalStatusLabel(s: GoalStatus): string {
  switch (s) {
    case 'active':
      return 'activo';
    case 'paused':
      return 'pausado';
    case 'achieved':
      return 'alcanzado';
    case 'closed':
      return 'cerrado';
  }
}

/** Tipo de meta (nota C: proceso por defecto; Freund & Hennecke; Harkin). */
export type GoalKind = 'process' | 'outcome' | 'learning';

export const GOAL_KINDS: readonly GoalKind[] = ['process', 'outcome', 'learning'];

export function parseGoalKind(s: string): GoalKind {
  switch (s) {
    case 'outcome':
    case 'learning':
      return s;
    default:
      return 'process';
  }
}

export function goalKindLabel(k: GoalKind): string {
  switch (k) {
    case 'process':
      return 'proceso (hacer algo con regularidad)';
    case 'outcome':
      return 'resultado (llegar a un valor o estado)';
    case 'learning':
      return 'aprendizaje (adquirir una habilidad)';
  }
}

export type RedFlag = 'substance' | 'eating' | 'self_harm' | 'gambling' | 'suicidal';

/**
 * Categorías cerradas. Las marcadas con `red_flag` activan, una sola vez, el
 * mensaje de derivación no bloqueante (docs/research/safety.md §3.2–3.3).
 */
export interface Category {
  key: string;
  label: string;
  sensitive: boolean;
  red_flag: RedFlag | null;
}

export const CATEGORIES: readonly Category[] = [
  { key: 'general', label: 'General', sensitive: false, red_flag: null },
  { key: 'project', label: 'Proyecto personal (escribir, crear, estudiar)', sensitive: false, red_flag: null },
  { key: 'activity', label: 'Actividad física', sensitive: false, red_flag: null },
  { key: 'sleep', label: 'Sueño y descanso', sensitive: false, red_flag: null },
  { key: 'learning', label: 'Aprender una habilidad', sensitive: false, red_flag: null },
  { key: 'time', label: 'Gestión del tiempo y hábitos de trabajo', sensitive: false, red_flag: null },
  { key: 'reduce', label: 'Reducir una conducta (móvil, compras, picoteo…)', sensitive: false, red_flag: null },
  { key: 'food_weight', label: 'Controlar lo que como o mi peso', sensitive: true, red_flag: 'eating' },
  { key: 'substance', label: 'Dejar de beber alcohol o de consumir una sustancia', sensitive: true, red_flag: 'substance' },
  { key: 'gambling', label: 'Dejar de apostar', sensitive: true, red_flag: 'gambling' },
  { key: 'self_harm', label: 'Dejar de hacerme daño', sensitive: true, red_flag: 'self_harm' },
];

export function category(key: string): Category {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

export interface Goal {
  id: Id;
  name: string;
  description: string;
  why: string;
  success_criteria: string;
  status: GoalStatus;
  kind: GoalKind;
  category: string;
  context: string;
  started_on: string;
  horizon_on: string | null;
  review_every_days: number | null;
  last_reviewed_at: number | null;
  notebook_id: Id | null;
  close_reason: string | null;
  safety_shown: boolean;
  created_at: number;
  updated_at: number;
}

interface GoalRow {
  id: number;
  name: string;
  description: string;
  why: string;
  success_criteria: string;
  status: string;
  kind: string;
  category: string;
  context: string;
  started_on: string;
  horizon_on: string | null;
  review_every_days: number | null;
  last_reviewed_at: number | null;
  notebook_id: number | null;
  close_reason: string | null;
  safety_shown: number;
  created_at: number;
  updated_at: number;
}

const SELECT = `SELECT id, name, description, why, success_criteria, status, kind, category, context, started_on, horizon_on,
    review_every_days, last_reviewed_at, notebook_id, close_reason, safety_shown, created_at, updated_at FROM goals`;

function map(r: GoalRow): Goal {
  return {
    ...r,
    status: parseGoalStatus(r.status),
    kind: parseGoalKind(r.kind),
    safety_shown: r.safety_shown !== 0,
  };
}

export function create(db: Database, name: string, kind: GoalKind, cat: string): Id {
  const now = nowTs();
  return db.insert(
    'INSERT INTO goals(name, kind, category, started_on, review_every_days, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 7, ?5, ?5)',
    [name.trim(), kind, cat, today(), now],
  );
}

export function get(db: Database, id: Id): Goal | undefined {
  const r = db.get<GoalRow>(`${SELECT} WHERE id = ?1`, [id]);
  return r ? map(r) : undefined;
}

export function list(db: Database, includeClosed: boolean): Goal[] {
  const sql = `${SELECT} WHERE archived_at IS NULL ${includeClosed ? '' : "AND status IN ('active','paused')"} ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, updated_at DESC`;
  return db.all<GoalRow>(sql).map(map);
}

export function activeCount(db: Database): number {
  return db.scalar<number>("SELECT count(*) FROM goals WHERE status = 'active' AND archived_at IS NULL") ?? 0;
}

function set(db: Database, id: Id, field: string, v: string | number | null): void {
  db.run(`UPDATE goals SET ${field} = ?2, updated_at = ?3 WHERE id = ?1`, [id, v, nowTs()]);
}

export const setName = (db: Database, id: Id, v: string) => set(db, id, 'name', v.trim());
export const setDescription = (db: Database, id: Id, v: string) => set(db, id, 'description', v);
export const setWhy = (db: Database, id: Id, v: string) => set(db, id, 'why', v);
export const setSuccessCriteria = (db: Database, id: Id, v: string) => set(db, id, 'success_criteria', v);
export const setContext = (db: Database, id: Id, v: string) => set(db, id, 'context', v);
export const setKind = (db: Database, id: Id, k: GoalKind) => set(db, id, 'kind', k);
export const setCategory = (db: Database, id: Id, c: string) => set(db, id, 'category', c);
/** `day` en 'AAAA-MM-DD' o null para quitar el horizonte. */
export const setHorizon = (db: Database, id: Id, day: string | null) => set(db, id, 'horizon_on', day);
export const setReviewEvery = (db: Database, id: Id, days: number | null) => set(db, id, 'review_every_days', days);
export const setNotebook = (db: Database, id: Id, nb: Id | null) => set(db, id, 'notebook_id', nb);
export const markSafetyShown = (db: Database, id: Id) => set(db, id, 'safety_shown', 1);
export const markReviewed = (db: Database, id: Id) => set(db, id, 'last_reviewed_at', nowTs());

/** Cambia el estado. Cerrar pide un motivo de una lista neutra; nunca es un «fallo». */
export function setStatus(db: Database, id: Id, status: GoalStatus, closeReason: string | null = null): void {
  db.run('UPDATE goals SET status = ?2, close_reason = ?3, updated_at = ?4 WHERE id = ?1', [id, status, closeReason, nowTs()]);
}

export const CLOSE_REASONS: readonly (readonly [string, string])[] = [
  ['achieved', 'alcanzado'],
  ['replaced', 'sustituido por otro objetivo'],
  ['unreachable', 'no es alcanzable ahora'],
  ['not_important', 'ya no me importa'],
];

export function closeReasonLabel(key: string): string {
  return CLOSE_REASONS.find(([k]) => k === key)?.[1] ?? 'cerrado';
}

export function archive(db: Database, id: Id): void {
  set(db, id, 'archived_at', nowTs());
}

export function deleteGoal(db: Database, id: Id): void {
  db.run('DELETE FROM goals WHERE id = ?1', [id]);
}
export { deleteGoal as delete };

/** Objetivos activos cuya revisión periódica toca (nunca se marca como «vencida»). */
export function dueForReview(db: Database, now: number): Goal[] {
  return db
    .all<GoalRow>(
      `${SELECT} WHERE status = 'active' AND archived_at IS NULL AND review_every_days IS NOT NULL
         AND coalesce(last_reviewed_at, created_at) + review_every_days * 86400 <= ?1 ORDER BY coalesce(last_reviewed_at, created_at)`,
      [now],
    )
    .map(map);
}
