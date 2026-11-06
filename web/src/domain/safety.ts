/**
 * Señales de derivación (safety.md §3) y modo «uso con acompañamiento profesional»
 * (§3.4). El indicador vive en la base cifrada, no en las preferencias del navegador:
 * decir que se está en tratamiento es información sensible.
 */
import type { Database } from '../db/sqlite';
import type { RedFlag } from './goals';
import { T } from '../text/texts';

const KEY = 'supervised_use';

export function isSupervised(db: Database): boolean {
  return db.scalar<string>('SELECT value FROM settings WHERE key = ?1', [KEY]) === '1';
}

export function setSupervised(db: Database, on: boolean): void {
  db.run('INSERT INTO settings(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [KEY, on ? '1' : '0']);
}

/** ¿Se mostró ya el aviso de esta clave? Si no, lo marca y devuelve `true`. */
export function firstTime(db: Database, key: string): boolean {
  if (db.scalar<string>('SELECT value FROM settings WHERE key = ?1', [key])) return false;
  db.run('INSERT INTO settings(key, value) VALUES (?1, ?2)', [key, '1']);
  return true;
}

/**
 * Párrafos del aviso de derivación para una señal. Con acompañamiento profesional se
 * acorta a una nota breve, pero la referencia al 112 se conserva siempre y las
 * señales de alimentación y sustancias mantienen su matiz de autocuidado o médico.
 */
export function derivation(db: Database, flag: RedFlag | null | undefined, opts: { harm?: boolean } = {}): string[] {
  const supervised = isSupervised(db);
  if (supervised) {
    const out: string[] = [T.DERIVATION_SUPERVISED];
    if (flag === 'eating') out.push(T.DERIVATION_EATING_SUPERVISED);
    if (flag === 'substance') out.push(T.DERIVATION_SUBSTANCE_SUPERVISED);
    return out;
  }
  const out: string[] = [T.DERIVATION_BASE];
  if (flag === 'substance') out.push(T.DERIVATION_SUBSTANCE);
  else if (flag === 'eating') out.push(T.DERIVATION_EATING);
  else if (flag === 'self_harm' || flag === 'suicidal' || opts.harm) out.push(T.DERIVATION_SUICIDAL);
  return out;
}

/** Aviso único de métrica sensible (§5.6), en su versión completa o acompañada. */
export function sensitiveMetricText(db: Database): string {
  return isSupervised(db) ? T.METRIC_SENSITIVE_SUPERVISED : T.METRIC_SENSITIVE_TEXT;
}
