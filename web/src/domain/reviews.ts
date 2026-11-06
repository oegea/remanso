/**
 * Sesiones de revisión (apertura, cierre, semanal, objetivo). Una sesión
 * guiada al día como máximo; la semanal se sugiere, no se exige.
 */
import type { Database } from '../db/sqlite';
import { nowTs, tsToDay, weekStart, weekdayIndex } from './dates';
import * as prompts from './prompts';

export type Id = number;
export type ReviewKind = 'open' | 'close' | 'weekly' | 'goal';

export function start(db: Database, kind: ReviewKind | string, goalId: Id | null): Id {
  const now = nowTs();
  return db.insert('INSERT INTO reviews(kind, goal_id, day, started_at) VALUES (?1, ?2, ?3, ?4)', [kind, goalId, tsToDay(now), now]);
}

export function complete(db: Database, id: Id, notes: string): void {
  db.run('UPDATE reviews SET completed_at = ?2, notes = ?3 WHERE id = ?1', [id, nowTs(), notes]);
}

/** ¿Hubo ya una sesión guiada (apertura/cierre/semanal) hoy? Devuelve su tipo. */
export function guidedToday(db: Database, today: string): string | null {
  return (
    db.scalar<string>(
      "SELECT kind FROM reviews WHERE day = ?1 AND kind IN ('open','close','weekly') AND completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 1",
      [today],
    ) ?? null
  );
}

export function lastOfKind(db: Database, kind: string): string | null {
  return db.scalar<string | null>('SELECT max(day) FROM reviews WHERE kind = ?1 AND completed_at IS NOT NULL', [kind]) ?? null;
}

/**
 * La revisión semanal «toca» si está activada, hoy es el día elegido (o
 * posterior en la misma semana) y no se ha hecho esta semana. `weekday`: 0 = lunes … 6 = domingo.
 */
export function weeklyAvailable(db: Database, today: string, weekday: number): boolean {
  if (!prompts.setEnabled(db, 'weekly')) return false;
  const ws = weekStart(today);
  const doneThisWeek =
    (db.scalar<number>("SELECT count(*) FROM reviews WHERE kind = 'weekly' AND completed_at IS NOT NULL AND day >= ?1", [ws]) ?? 0) > 0;
  return !doneThisWeek && weekdayIndex(today) >= weekday;
}

/**
 * Cuántas revisiones semanales seguidas se abrieron y cerraron sin respuestas
 * (para ofrecer desactivarla, spec §b.8).
 */
export function emptyWeeklyStreak(db: Database): number {
  const counts = db.all<{ n: number }>(
    `SELECT (SELECT count(*) FROM prompt_answers a WHERE a.review_id = r.id) AS n FROM reviews r
     WHERE r.kind = 'weekly' AND r.completed_at IS NOT NULL ORDER BY r.started_at DESC, r.id DESC LIMIT 3`,
  );
  let streak = 0;
  for (const c of counts) {
    if (c.n !== 0) break;
    streak += 1;
  }
  return streak;
}

export function count(db: Database, kind: string): number {
  return db.scalar<number>('SELECT count(*) FROM reviews WHERE kind = ?1 AND completed_at IS NOT NULL', [kind]) ?? 0;
}

export interface PastAnswer { question: string; text: string; value: number | null; }
export interface PastReview { id: Id; kind: string; day: string; completed_at: number; goal_name: string | null; answers: PastAnswer[]; }

/**
 * Sesiones terminadas que dejaron alguna respuesta, de la más reciente a la más antigua,
 * para que quien las escribió pueda releerlas (las de objetivo no guardan respuestas:
 * su decisión queda en el propio objetivo).
 */
export function history(db: Database, limit = 60): PastReview[] {
  const rows = db.all<{ id: number; kind: string; day: string; completed_at: number; goal_name: string | null }>(
    `SELECT r.id, r.kind, r.day, r.completed_at, g.name AS goal_name FROM reviews r LEFT JOIN goals g ON g.id = r.goal_id
     WHERE r.completed_at IS NOT NULL AND EXISTS (SELECT 1 FROM prompt_answers a WHERE a.review_id = r.id)
     ORDER BY r.completed_at DESC, r.id DESC LIMIT ?1`,
    [limit],
  );
  return rows.map((r) => ({
    ...r,
    answers: db.all<PastAnswer>(
      'SELECT p.text AS question, a.text AS text, a.value AS value FROM prompt_answers a JOIN prompts p ON p.id = a.prompt_id WHERE a.review_id = ?1 ORDER BY a.id',
      [r.id],
    ),
  }));
}

/** ¿Se completó hoy una sesión de este tipo? */
export function doneToday(db: Database, kind: string, today: string): boolean {
  return lastOfKind(db, kind) === today;
}

/** Respuestas de la última sesión completada hoy de un tipo (para mostrarlas en Hoy). */
export function todayAnswers(db: Database, kind: string, today: string): PastAnswer[] {
  const id = db.scalar<number>('SELECT id FROM reviews WHERE kind = ?1 AND day = ?2 AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1', [kind, today]);
  if (id == null) return [];
  return db.all<PastAnswer>(
    'SELECT p.text AS question, a.text AS text, a.value AS value FROM prompt_answers a JOIN prompts p ON p.id = a.prompt_id WHERE a.review_id = ?1 ORDER BY a.id',
    [id],
  );
}

/** «Ahora no» en Hoy: se recuerda sólo para ese día. */
export function dismissed(db: Database, kind: string, today: string): boolean {
  return db.scalar<string>('SELECT value FROM settings WHERE key = ?1', [`review_dismissed_${kind}`]) === today;
}
export function dismiss(db: Database, kind: string, today: string): void {
  db.run('INSERT INTO settings(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [`review_dismissed_${kind}`, today]);
}
