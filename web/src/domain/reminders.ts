/**
 * Recordatorios locales. Se comprueban al abrir la aplicación y al interactuar
 * con ella; no hay proceso residente. Un recordatorio nunca se considera
 * «incumplido» porque la aplicación estuviera cerrada: aparece como pendiente.
 */
import type { Database } from '../db/sqlite';
import { nowTs, parseDay, today, tsToDay } from './dates';
import { type Rule, nextAfter, parse as parseRule, toStorage } from './recurrence';

export type Id = number;

/**
 * Tras este número de apariciones del mismo aviso, la interfaz ofrece revisar
 * en lugar de volver a avisar (habituación y «alarm fatigue»).
 */
export const MAX_SHOWS_DEFAULT = 2;

export interface Reminder {
  id: Id;
  title: string;
  due_at: number;
  repeat: Rule | null;
  ref_kind: string | null;
  ref_id: Id | null;
  snoozed_until: number | null;
  shown_count: number;
  max_shows: number;
  done_at: number | null;
}

/** Momento efectivo en que debe aparecer. */
export function effectiveAt(r: Reminder): number {
  return r.snoozed_until ?? r.due_at;
}
export function needsReview(r: Reminder): boolean {
  return r.shown_count >= r.max_shows;
}

const SELECT = 'SELECT id, title, due_at, repeat, ref_kind, ref_id, snoozed_until, shown_count, max_shows, done_at FROM reminders';

type Row = Omit<Reminder, 'repeat'> & { repeat: string | null };

function map(r: Row): Reminder {
  return { ...r, repeat: r.repeat !== null ? parseRule(r.repeat) : null };
}

export function create(
  db: Database,
  title: string,
  dueAt: number,
  repeat: Rule | null = null,
  refKind: string | null = null,
  refId: Id | null = null,
): Id {
  return db.insert(
    'INSERT INTO reminders(title, due_at, repeat, ref_kind, ref_id, max_shows, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    [title.trim(), dueAt, repeat ? toStorage(repeat) : null, refKind, refId, MAX_SHOWS_DEFAULT, nowTs()],
  );
}

export function get(db: Database, id: Id): Reminder | null {
  const r = db.get<Row>(`${SELECT} WHERE id = ?1`, [id]);
  return r ? map(r) : null;
}

/** Recordatorios cuyo momento efectivo ya pasó y no están cerrados. */
export function due(db: Database, now: number): Reminder[] {
  return db
    .all<Row>(
      `${SELECT} WHERE done_at IS NULL AND archived_at IS NULL AND coalesce(snoozed_until, due_at) <= ?1 ORDER BY coalesce(snoozed_until, due_at)`,
      [now],
    )
    .map(map);
}

/** Próximos (no vencidos), para la lista de recordatorios. */
export function upcoming(db: Database, now: number, limit: number): Reminder[] {
  return db
    .all<Row>(
      `${SELECT} WHERE done_at IS NULL AND archived_at IS NULL AND coalesce(snoozed_until, due_at) > ?1 ORDER BY coalesce(snoozed_until, due_at) LIMIT ?2`,
      [now, limit],
    )
    .map(map);
}

/** Instante del próximo recordatorio pendiente (para despertar el bucle justo entonces). */
export function nextDueAt(db: Database, now: number): number | null {
  return (
    db.scalar<number | null>(
      'SELECT min(coalesce(snoozed_until, due_at)) FROM reminders WHERE done_at IS NULL AND archived_at IS NULL AND coalesce(snoozed_until, due_at) > ?1',
      [now],
    ) ?? null
  );
}

/** Registra que el aviso se ha mostrado al usuario. */
export function markShown(db: Database, id: Id): void {
  db.run('UPDATE reminders SET shown_count = shown_count + 1 WHERE id = ?1', [id]);
}

export function snooze(db: Database, id: Id, until: number): void {
  db.run('UPDATE reminders SET snoozed_until = ?2 WHERE id = ?1', [id, until]);
}

/**
 * Cierra el aviso. Si se repite, programa la siguiente aparición (desde hoy,
 * nunca acumulando apariciones pasadas) y reinicia el contador de muestras.
 */
export function dismiss(db: Database, id: Id): void {
  const r = get(db, id);
  if (!r) return;
  const now = nowTs();
  if (r.repeat) {
    const dueLocal = new Date(r.due_at * 1000);
    const dueDay = tsToDay(r.due_at);
    const td = today();
    const baseDay = dueDay > td ? dueDay : td;
    const nextDay = nextAfter(r.repeat, baseDay);
    const next = parseDay(nextDay);
    let nextTs = now + 86_400;
    if (next) {
      next.setHours(dueLocal.getHours(), dueLocal.getMinutes(), 0, 0);
      nextTs = Math.floor(next.getTime() / 1000);
    }
    db.run('UPDATE reminders SET due_at = ?2, snoozed_until = NULL, shown_count = 0 WHERE id = ?1', [id, nextTs]);
  } else {
    db.run('UPDATE reminders SET done_at = ?2 WHERE id = ?1', [id, now]);
  }
}

export function setRepeat(db: Database, id: Id, rule: Rule | null): void {
  db.run('UPDATE reminders SET repeat = ?2 WHERE id = ?1', [id, rule ? toStorage(rule) : null]);
}

export function reschedule(db: Database, id: Id, dueAt: number): void {
  db.run('UPDATE reminders SET due_at = ?2, snoozed_until = NULL, shown_count = 0 WHERE id = ?1', [id, dueAt]);
}

export function archive(db: Database, id: Id): void {
  db.run('UPDATE reminders SET archived_at = ?2 WHERE id = ?1', [id, nowTs()]);
}

export function deleteReminder(db: Database, id: Id): void {
  db.run('DELETE FROM reminders WHERE id = ?1', [id]);
}
export { deleteReminder as delete };

export function forRef(db: Database, kind: string, refId: Id): Reminder[] {
  return db
    .all<Row>(`${SELECT} WHERE ref_kind = ?1 AND ref_id = ?2 AND done_at IS NULL AND archived_at IS NULL ORDER BY due_at`, [kind, refId])
    .map(map);
}
