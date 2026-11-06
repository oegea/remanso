/**
 * Hitos: opcionales, definidos sobre conducta acumulada o valores de métrica,
 * reprogramables sin perder historial. Alcanzar un hito produce un mensaje
 * descriptivo; no alcanzarlo no produce ninguna evaluación.
 * Portado de src/domain/milestones.rs.
 */
import type { Database } from '../db/sqlite';
import { nowTs } from './dates';
import * as actions from './actions';
import * as metrics from './metrics';
import { currentLevel } from './analysis/trend';

export type Id = number;

/**
 * metric_value   una métrica alcanza un valor (según la dirección de la métrica)
 * action_count   una acción acumula N registros hechos
 * sustain_weeks  una acción alcanza su frecuencia durante N semanas (consecutivas)
 * date           llegar a una fecha
 * manual         fase o criterio cualitativo: se marca a mano
 */
export type MilestoneKind = 'metric_value' | 'action_count' | 'sustain_weeks' | 'date' | 'manual';

export const MILESTONE_KINDS: readonly MilestoneKind[] = ['manual', 'action_count', 'sustain_weeks', 'metric_value', 'date'];

export function parseMilestoneKind(s: string): MilestoneKind {
  switch (s) {
    case 'metric_value':
    case 'action_count':
    case 'date':
      return s;
    case 'sustain_weeks':
    case 'sustain_days':
      return 'sustain_weeks';
    default:
      return 'manual';
  }
}

export function milestoneKindLabel(k: MilestoneKind): string {
  switch (k) {
    case 'metric_value':
      return 'una métrica llega a un valor';
    case 'action_count':
      return 'una acción acumula N veces';
    case 'sustain_weeks':
      return 'mantener una acción N semanas';
    case 'date':
      return 'llegar a una fecha';
    case 'manual':
      return 'fase o criterio que marco yo';
  }
}

export type MilestoneStatus = 'pending' | 'reached' | 'dropped';

export interface Milestone {
  id: Id;
  goal_id: Id;
  title: string;
  kind: MilestoneKind;
  metric_id: Id | null;
  action_id: Id | null;
  target_value: number | null;
  target_day: string | null;
  position: number;
  status: MilestoneStatus;
  reached_at: number | null;
  notes: string;
}

interface MilestoneRow {
  id: number;
  goal_id: number;
  title: string;
  kind: string;
  metric_id: number | null;
  action_id: number | null;
  target_value: number | null;
  target_day: string | null;
  position: number;
  status: string;
  reached_at: number | null;
  notes: string;
}

const SELECT = 'SELECT id, goal_id, title, kind, metric_id, action_id, target_value, target_day, position, status, reached_at, notes FROM milestones';

function map(r: MilestoneRow): Milestone {
  return {
    ...r,
    kind: parseMilestoneKind(r.kind),
    status: r.status === 'reached' ? 'reached' : r.status === 'dropped' ? 'dropped' : 'pending',
  };
}

export interface NewMilestone {
  goal_id: Id;
  title: string;
  kind: MilestoneKind;
  metric_id?: Id | null;
  action_id?: Id | null;
  target_value?: number | null;
  target_day?: string | null;
}

export function create(db: Database, m: NewMilestone): Id {
  const pos = db.scalar<number>('SELECT coalesce(max(position), 0) + 1 FROM milestones WHERE goal_id = ?1', [m.goal_id]) ?? 1;
  return db.insert(
    `INSERT INTO milestones(goal_id, title, kind, metric_id, action_id, target_value, target_day, position, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [m.goal_id, m.title.trim(), m.kind, m.metric_id ?? null, m.action_id ?? null, m.target_value ?? null, m.target_day ?? null, pos, nowTs()],
  );
}

export function get(db: Database, id: Id): Milestone | undefined {
  const r = db.get<MilestoneRow>(`${SELECT} WHERE id = ?1`, [id]);
  return r ? map(r) : undefined;
}

export function listForGoal(db: Database, goalId: Id): Milestone[] {
  return db.all<MilestoneRow>(`${SELECT} WHERE goal_id = ?1 ORDER BY position, id`, [goalId]).map(map);
}

function history(db: Database, id: Id, field: string, oldValue: string | null, newValue: string | null, note: string): void {
  db.run('INSERT INTO milestone_history(milestone_id, changed_at, field, old_value, new_value, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)', [
    id,
    nowTs(),
    field,
    oldValue,
    newValue,
    note,
  ]);
}

/** Reprogramar conserva el historial de fechas y valores anteriores. */
export function reschedule(db: Database, id: Id, targetDay: string | null, note: string): void {
  const m = get(db, id);
  if (!m) return;
  history(db, id, 'target_day', m.target_day, targetDay, note);
  db.run('UPDATE milestones SET target_day = ?2 WHERE id = ?1', [id, targetDay]);
}

export function setTargetValue(db: Database, id: Id, v: number | null, note: string): void {
  const m = get(db, id);
  if (!m) return;
  history(db, id, 'target_value', m.target_value === null ? null : String(m.target_value), v === null ? null : String(v), note);
  db.run('UPDATE milestones SET target_value = ?2 WHERE id = ?1', [id, v]);
}

export function setTitle(db: Database, id: Id, title: string): void {
  db.run('UPDATE milestones SET title = ?2 WHERE id = ?1', [id, title.trim()]);
}

export function markReached(db: Database, id: Id): void {
  db.run("UPDATE milestones SET status = 'reached', reached_at = ?2 WHERE id = ?1 AND status != 'reached'", [id, nowTs()]);
}

export function markPending(db: Database, id: Id): void {
  db.run("UPDATE milestones SET status = 'pending', reached_at = NULL WHERE id = ?1", [id]);
}

export function markDropped(db: Database, id: Id): void {
  db.run("UPDATE milestones SET status = 'dropped' WHERE id = ?1", [id]);
}

export function deleteMilestone(db: Database, id: Id): void {
  db.run('DELETE FROM milestones WHERE id = ?1', [id]);
}
export { deleteMilestone as delete };

export interface HistoryEntry {
  changed_at: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  note: string;
}

export function historyOf(db: Database, id: Id): HistoryEntry[] {
  return db.all<HistoryEntry>('SELECT changed_at, field, old_value, new_value, note FROM milestone_history WHERE milestone_id = ?1 ORDER BY changed_at', [id]);
}

/** Progreso descriptivo de un hito: [actual, objetivo] cuando es computable. */
export function progress(db: Database, m: Milestone, today: string): [number, number] | undefined {
  switch (m.kind) {
    case 'action_count': {
      if (m.action_id === null || m.target_value === null) return undefined;
      return [actions.totalDone(db, m.action_id), m.target_value];
    }
    case 'sustain_weeks': {
      if (m.action_id === null || m.target_value === null) return undefined;
      const act = actions.get(db, m.action_id);
      if (!act) return undefined;
      return [actions.summary(db, act, today).weeks_meeting_target, m.target_value];
    }
    case 'metric_value': {
      if (m.metric_id === null || m.target_value === null) return undefined;
      const met = metrics.get(db, m.metric_id);
      if (!met) return undefined;
      const series = metrics.dailySeries(db, met, 3650);
      const last = series[series.length - 1];
      return last ? [last.value, m.target_value] : undefined;
    }
    case 'date':
    case 'manual':
      return undefined;
  }
}

/** Comprueba hitos automáticos y marca los alcanzados. Devuelve los recién alcanzados. */
export function evaluate(db: Database, goalId: Id, today: string): Milestone[] {
  const newly: Milestone[] = [];
  for (const m of listForGoal(db, goalId)) {
    if (m.status !== 'pending') continue;
    let reached = false;
    switch (m.kind) {
      case 'date':
        reached = m.target_day !== null && m.target_day <= today;
        break;
      case 'action_count':
      case 'sustain_weeks': {
        const p = progress(db, m, today);
        reached = p !== undefined && p[0] >= p[1];
        break;
      }
      case 'metric_value': {
        if (m.metric_id === null || m.target_value === null) break;
        const met = metrics.get(db, m.metric_id);
        if (!met) break;
        const series = metrics.dailySeries(db, met, 3650);
        // Para métricas ruidosas se usa la tendencia (media de 7 días), no el último punto.
        const current = currentLevel(series, met.kind);
        if (current === undefined) break;
        reached = met.direction === 'down' ? current <= m.target_value : current >= m.target_value;
        break;
      }
      case 'manual':
        break;
    }
    if (reached) {
      markReached(db, m.id);
      newly.push(get(db, m.id)!);
    }
  }
  return newly;
}
