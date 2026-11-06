/** Diario personal: entradas fechadas, varias por día, texto libre. */
import type { Database } from '../db/sqlite';
import { nowTs, tsToDay } from './dates';

export type Id = number;

export interface Entry {
  id: Id;
  created_at: number;
  updated_at: number;
  day: string;
  title: string | null;
  body: string;
  goal_id: Id | null;
}

/** Resumen para listados (sin cuerpo completo). */
export interface EntrySummary {
  id: Id;
  created_at: number;
  day: string;
  title: string | null;
  preview: string;
  words: number;
}

const SELECT = 'SELECT id, created_at, updated_at, day, title, body, goal_id FROM diary_entries';

/** Crea una entrada vacía fechada ahora y devuelve su id. */
export function create(db: Database): Id {
  const now = nowTs();
  return db.insert("INSERT INTO diary_entries(created_at, updated_at, day, body) VALUES (?1, ?1, ?2, '')", [now, tsToDay(now)]);
}

export function get(db: Database, id: Id): Entry | null {
  return db.get<Entry>(`${SELECT} WHERE id = ?1 AND deleted_at IS NULL`, [id]) ?? null;
}

export function saveBody(db: Database, id: Id, title: string | null, body: string): void {
  const t = title && title.trim() !== '' ? title : null;
  db.run('UPDATE diary_entries SET title = ?2, body = ?3, updated_at = ?4 WHERE id = ?1', [id, t, body, nowTs()]);
}

export function setGoal(db: Database, id: Id, goalId: Id | null): void {
  db.run('UPDATE diary_entries SET goal_id = ?2 WHERE id = ?1', [id, goalId]);
}

/**
 * Borrado real. Las entradas vacías se eliminan al salir del editor sin aviso;
 * las demás sólo tras confirmación explícita.
 */
export function deleteEntry(db: Database, id: Id): void {
  db.run('DELETE FROM diary_entries WHERE id = ?1', [id]);
}
export { deleteEntry as delete };

export function isEmpty(db: Database, id: Id): boolean {
  const r = db.get<{ title: string | null; body: string }>('SELECT title, body FROM diary_entries WHERE id = ?1', [id]);
  if (!r) throw new Error(`entrada ${id} inexistente`);
  return (r.title === null || r.title.trim() === '') && r.body.trim() === '';
}

interface SummaryRow {
  id: Id;
  created_at: number;
  day: string;
  title: string | null;
  head: string;
  body?: string;
}

/** Listado cronológico inverso, paginado. */
export function list(db: Database, offset: number, limit: number): EntrySummary[] {
  const rows = db.all<SummaryRow>(
    `SELECT id, created_at, day, title, substr(body, 1, 200) AS head, body FROM diary_entries
     WHERE deleted_at IS NULL ORDER BY day DESC, created_at DESC LIMIT ?1 OFFSET ?2`,
    [limit, offset],
  );
  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    day: r.day,
    title: r.title,
    preview: previewOf(r.head),
    words: wordCount(r.body ?? ''),
  }));
}

export function count(db: Database): number {
  return db.scalar<number>('SELECT count(*) FROM diary_entries WHERE deleted_at IS NULL') ?? 0;
}

export function lastEntryDay(db: Database): string | null {
  return db.scalar<string | null>('SELECT max(day) FROM diary_entries WHERE deleted_at IS NULL') ?? null;
}

/** Días con alguna entrada dentro de un rango (para el calendario). */
export function daysWithEntries(db: Database, from: string, to: string): string[] {
  return db
    .all<{ day: string }>(
      'SELECT DISTINCT day FROM diary_entries WHERE deleted_at IS NULL AND day BETWEEN ?1 AND ?2 ORDER BY day',
      [from, to],
    )
    .map((r) => r.day);
}

export function forGoal(db: Database, goalId: Id, limit: number): EntrySummary[] {
  const rows = db.all<SummaryRow>(
    `SELECT id, created_at, day, title, substr(body, 1, 200) AS head FROM diary_entries
     WHERE deleted_at IS NULL AND goal_id = ?1 ORDER BY day DESC, created_at DESC LIMIT ?2`,
    [goalId, limit],
  );
  return rows.map((r) => ({ id: r.id, created_at: r.created_at, day: r.day, title: r.title, preview: previewOf(r.head), words: 0 }));
}

/** Palabras con al menos un carácter alfanumérico (los marcadores «#», «-» no cuentan). */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Primera línea no vacía, sin marcas Markdown, recortada. */
export function previewOf(body: string): string {
  const first = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '') ?? '';
  const line = first.replace(/^[#>\-* ]+/, '');
  const chars = Array.from(line);
  let s = chars.slice(0, 120).join('');
  if (chars.length > 120) s += '…';
  return s;
}
