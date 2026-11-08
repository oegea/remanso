/**
 * Invitación a apoyar Remanso («invítame a un café»). Discreta por diseño: una tarjeta en
 * Hoy a partir de dos días desde el primer uso, que se aplaza una semana con «Más adelante»
 * y desaparece para siempre con «No volver a mostrar». Nada se desbloquea al contribuir.
 * El enlace siempre está en Ajustes. Sin el enlace configurado no se muestra nada.
 */
import type { Database } from '../db/sqlite';

/** Página de apoyo (Ko-fi). Vacío mientras no exista: entonces no se enseña nada. */
export const SUPPORT_URL = '';

export const FIRST_AFTER_S = 2 * 86_400;
export const LATER_S = 7 * 86_400;

function get(db: Database, key: string): string | null {
  return db.scalar<string>('SELECT value FROM settings WHERE key = ?1', [key]) ?? null;
}
function set(db: Database, key: string, value: string): void {
  db.run('INSERT INTO settings(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

/** Momento del primer uso; se anota la primera vez que se pregunta. */
export function firstUse(db: Database, now: number): number {
  const v = get(db, 'support_first_use');
  if (v) return Number(v);
  set(db, 'support_first_use', String(now));
  return now;
}

export function enabled(): boolean {
  return SUPPORT_URL !== '';
}

/** Si toca enseñar la tarjeta ahora (`on` permite probar la lógica sin enlace). */
export function shouldShow(db: Database, now: number, on = enabled()): boolean {
  if (!on) return false;
  if (get(db, 'support_dismissed') === '1') return false;
  const first = firstUse(db, now);
  const next = Number(get(db, 'support_next_at') ?? 0);
  return now - first >= FIRST_AFTER_S && now >= next;
}

/** «Más adelante»: una semana de tranquilidad. */
export function later(db: Database, now: number): void {
  set(db, 'support_next_at', String(now + LATER_S));
}

/** «No volver a mostrar»: definitivo (queda en los datos cifrados, así sobrevive a las copias). */
export function never(db: Database): void {
  set(db, 'support_dismissed', '1');
}
