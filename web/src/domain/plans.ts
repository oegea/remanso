/**
 * Planes «si–entonces» (intenciones de implementación) con revisión de utilidad
 * y recordatorios de refuerzo a 7 y 14 días (interventions.md §b.6).
 */
import type { Database } from '../db/sqlite';
import { nowTs, parseDay, tsToDay } from './dates';

export type Id = number;

export interface Plan {
  id: Id;
  goal_id: Id | null;
  action_id: Id | null;
  situation: string;
  response: string;
  created_at: number;
  last_reviewed_at: number | null;
  archived: boolean;
  helpful_yes: number;
  helpful_partly: number;
  helpful_no: number;
  not_used: number;
}

interface Row {
  id: number;
  goal_id: number | null;
  action_id: number | null;
  situation: string;
  response: string;
  created_at: number;
  last_reviewed_at: number | null;
  archived_at: number | null;
  helpful_yes: number;
  helpful_partly: number;
  helpful_no: number;
  not_used: number;
}

const SELECT = `SELECT p.id, p.goal_id, p.action_id, p.situation, p.response, p.created_at, p.last_reviewed_at, p.archived_at,
    (SELECT count(*) FROM plan_reviews r WHERE r.plan_id = p.id AND r.helpful = 'yes') AS helpful_yes,
    (SELECT count(*) FROM plan_reviews r WHERE r.plan_id = p.id AND r.helpful = 'partly') AS helpful_partly,
    (SELECT count(*) FROM plan_reviews r WHERE r.plan_id = p.id AND r.helpful = 'no') AS helpful_no,
    (SELECT count(*) FROM plan_reviews r WHERE r.plan_id = p.id AND r.helpful = 'not_used') AS not_used
    FROM if_then_plans p`;

function map(r: Row): Plan {
  return {
    id: r.id,
    goal_id: r.goal_id,
    action_id: r.action_id,
    situation: r.situation,
    response: r.response,
    created_at: r.created_at,
    last_reviewed_at: r.last_reviewed_at,
    archived: r.archived_at !== null,
    helpful_yes: r.helpful_yes,
    helpful_partly: r.helpful_partly,
    helpful_no: r.helpful_no,
    not_used: r.not_used,
  };
}

/** Frases vagas que desactivan el efecto del plan (lista cerrada, spec §b.6). */
const VAGUE = ['cuando pueda', 'algún día', 'algun dia', 'cuando tenga tiempo', 'si me apetece', 'cuando me acuerde', 'ya veré', 'ya vere'];

export function isVague(situation: string): boolean {
  const s = situation.trim().toLowerCase();
  return s === '' || VAGUE.some((v) => s.includes(v));
}

/** Crea el plan y, si se pide, los recordatorios de refuerzo a 7 y 14 días. */
export function create(db: Database, goalId: Id | null, actionId: Id | null, situation: string, response: string, boosters: boolean): Id {
  const now = nowTs();
  const id = db.insert(
    'INSERT INTO if_then_plans(goal_id, action_id, situation, response, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
    [goalId, actionId, situation.trim(), response.trim(), now],
  );
  if (boosters) {
    for (const days of [7, 14]) {
      const at = boosterTime(now + days * 86_400);
      // Mismo INSERT que reminders.create (max_shows = 2), con referencia al plan.
      db.insert(
        'INSERT INTO reminders(title, due_at, repeat, ref_kind, ref_id, max_shows, created_at) VALUES (?1, ?2, NULL, ?3, ?4, 2, ?5)',
        [`Plan: si ${situation.trim()} → ${response.trim()}`, at, 'plan', id, now],
      );
    }
  }
  return id;
}

/** 09:00 local del día indicado. */
function boosterTime(ts: number): number {
  const d = parseDay(tsToDay(ts));
  if (!d) return ts;
  d.setHours(9, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export function get(db: Database, id: Id): Plan | undefined {
  const r = db.get<Row>(`${SELECT} WHERE p.id = ?1`, [id]);
  return r ? map(r) : undefined;
}

export function listForGoal(db: Database, goalId: Id, includeArchived: boolean): Plan[] {
  const sql = `${SELECT} WHERE p.goal_id = ?1 ${includeArchived ? '' : 'AND p.archived_at IS NULL'} ORDER BY p.archived_at IS NOT NULL, p.id`;
  return db.all<Row>(sql, [goalId]).map(map);
}

export function listActive(db: Database): Plan[] {
  return db.all<Row>(`${SELECT} WHERE p.archived_at IS NULL ORDER BY p.goal_id, p.id`).map(map);
}

export function update(db: Database, id: Id, situation: string, response: string): void {
  db.run('UPDATE if_then_plans SET situation = ?2, response = ?3 WHERE id = ?1', [id, situation.trim(), response.trim()]);
}

export function setArchived(db: Database, id: Id, archived: boolean): void {
  const v = archived ? nowTs() : null;
  db.run('UPDATE if_then_plans SET archived_at = ?2 WHERE id = ?1', [id, v]);
  if (archived) {
    // Los recordatorios de refuerzo pendientes dejan de tener sentido.
    db.run("UPDATE reminders SET done_at = ?2 WHERE ref_kind = 'plan' AND ref_id = ?1 AND done_at IS NULL", [id, nowTs()]);
  }
}

export function delete_(db: Database, id: Id): void {
  db.run("DELETE FROM reminders WHERE ref_kind = 'plan' AND ref_id = ?1", [id]);
  db.run('DELETE FROM if_then_plans WHERE id = ?1', [id]);
}
export { delete_ as delete };

export type Helpful = 'yes' | 'partly' | 'no' | 'not_used';
export const HELPFUL: readonly (readonly [Helpful, string])[] = [
  ['yes', 'Sí, me sirvió'],
  ['partly', 'En parte'],
  ['no', 'No'],
  ['not_used', 'No se dio la situación'],
];

/**
 * Registra «¿Te sirvió este plan?». Devuelve `true` si conviene ofrecer archivarlo
 * (dos revisiones seguidas «no se dio la situación»).
 */
export function review(db: Database, id: Id, helpful: Helpful | string, note: string): boolean {
  const now = nowTs();
  db.run('INSERT INTO plan_reviews(plan_id, at, helpful, note) VALUES (?1, ?2, ?3, ?4)', [id, now, helpful, note]);
  db.run('UPDATE if_then_plans SET last_reviewed_at = ?2 WHERE id = ?1', [id, now]);
  const last = db.all<{ helpful: string }>('SELECT helpful FROM plan_reviews WHERE plan_id = ?1 ORDER BY at DESC, id DESC LIMIT 2', [id]);
  return last.length === 2 && last.every((r) => r.helpful === 'not_used');
}
