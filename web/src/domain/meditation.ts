/**
 * Meditación de calma y atención: sesiones guiadas, variadas, y su diario. Nada aquí
 * tiene que ver con los impulsos: se medita por meditar.
 *
 * Estructura de toda sesión: reflexión amable → gong → tres respiraciones profundas →
 * una parte de cuerpo (asentarse, recorrido o sonidos) → atención a la respiración (en
 * la nariz, en el vientre o contando) → gong → tres respiraciones → abrir los ojos. Las
 * variantes y las proporciones cambian con la semilla, para que ninguna sesión sea igual.
 */
import type { Database } from '../db/sqlite';
import { rng } from '../audio/synth';
import { isVoiceName, type VoiceId, type VoiceName } from '../audio/voice';

export type PhaseKind = 'intention' | 'deep_breaths' | 'settle' | 'scan' | 'sounds' | 'breath' | 'closing_breaths' | 'open_eyes';

export interface Step { at: number; text: string; voice?: VoiceId }

export interface Phase {
  kind: PhaseKind;
  title: string;
  seconds: number;
  /** Instrucción visible, breve. */
  cue: string;
  /** Frase pregrabada que la voz guía dice al empezar la fase (texto completo en voice-lines.json). */
  voice?: VoiceId;
  /** Pasos intermedios (recorrido del cuerpo, recordatorios), en segundos desde el inicio de la fase. */
  steps: Step[];
  /** Si la fase pide los ojos cerrados. */
  eyesClosed: boolean;
}

export const DURATIONS = [5, 10, 15, 20] as const;

const INTENTIONS: [VoiceId, string][] = [
  ['intention_1', 'Piensa en alguien a quien le deseas que le vaya bien hoy. Quédate un momento con ese deseo.'],
  ['intention_2', 'Recuerda algo pequeño y bueno de estos días: una conversación, un rato de sol, un plato que te gustó.'],
  ['intention_3', 'Deséate a ti mismo tranquilidad para este rato, sin exigirte nada.'],
  ['intention_4', 'Piensa en algo que agradeces hoy, por pequeño que sea, y déjalo estar un momento.'],
  ['intention_5', 'Desea que las personas con las que te cruzarás hoy estén bien. Sin más.'],
  ['intention_6', 'Date permiso para no hacer nada útil durante estos minutos.'],
];

const REMINDERS: [VoiceId, string][] = [
  ['reminder_1', 'Si notas que la mente se ha ido, no pasa nada. Vuelve a la respiración, con suavidad.'],
  ['reminder_2', 'Los pensamientos vienen y van. No hace falta apartarlos ni seguirlos; míralos pasar.'],
  ['reminder_3', 'No intentes dejar la mente en blanco. Sólo observa, y vuelve al aire.'],
  ['reminder_4', 'Si aparece una sensación, un ruido o una idea, déjala estar y vuelve.'],
  ['reminder_5', 'Cada vez que vuelves es la práctica. Volver no es fallar.'],
  ['reminder_6', 'Relaja la cara, los hombros, las manos. Y sigue con la respiración.'],
];

const SCAN_REGIONS: [string, string][] = [
  ['Los pies', 'Lleva la atención a los pies: su peso, el contacto con el suelo o el calzado.'],
  ['Las piernas', 'Sube a las piernas. Nota dónde apoyan y dónde no.'],
  ['La cadera y la espalda', 'La cadera sobre el asiento, la espalda. Nota el apoyo sin corregir nada.'],
  ['Las manos', 'Las manos, donde descansen. Su temperatura, su peso.'],
  ['Los hombros y el cuello', 'Los hombros y el cuello. Si hay tensión, sólo obsérvala.'],
  ['La cara', 'La cara: la frente, los ojos, la mandíbula. Deja que se aflojen si quieren.'],
];

function pick<T>(r: () => number, list: readonly T[]): T { return list[Math.floor(r() * list.length)]; }
function shuffle<T>(r: () => number, list: readonly T[]): T[] { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Plan de una sesión de `minutes` minutos. La misma semilla da el mismo plan (pruebas). */
export function makePlan(minutes: number, seed = Date.now()): Phase[] {
  const r = rng(seed);
  const total = minutes * 60;
  const intention = minutes <= 5 ? 30 : 45;
  const deep = 30, closing = 30, open = 12;
  const main = total - intention - deep - closing - open;
  const bodyKind = pick(r, ['settle', 'scan', 'sounds'] as const);
  const bodyShare = bodyKind === 'scan' ? 0.4 + r() * 0.1 : 0.25 + r() * 0.15;
  const body = Math.round(main * bodyShare);
  const breath = main - body;
  const breathKind = pick(r, ['nose', 'belly', 'count'] as const);

  const phases: Phase[] = [];
  const intent = pick(r, INTENTIONS);
  phases.push({ kind: 'intention', title: 'Para empezar', seconds: intention, cue: intent[1], voice: intent[0], steps: [], eyesClosed: false });
  phases.push({ kind: 'deep_breaths', title: 'Tres respiraciones profundas', seconds: deep, cue: 'Sigue el círculo: coge aire despacio cuando crece y suéltalo cuando se encoge. Tres veces.', voice: 'deep_breaths', steps: [], eyesClosed: false });
  if (bodyKind === 'settle') {
    phases.push({ kind: 'settle', title: 'Asentarse', seconds: body, cue: 'Cierra los ojos. Respira con normalidad y nota el cuerpo sentado: el peso en el asiento, los pies en el suelo, las manos donde estén.', voice: 'settle', steps: [
      { at: Math.round(body * 0.35), text: 'Los pies en el suelo.', voice: 'settle_feet' },
      { at: Math.round(body * 0.65), text: 'Las manos, donde descansen.', voice: 'settle_hands' },
    ], eyesClosed: true });
  } else if (bodyKind === 'scan') {
    const n = SCAN_REGIONS.length;
    phases.push({ kind: 'scan', title: 'Un recorrido por el cuerpo', seconds: body, cue: 'Cierra los ojos y respira con normalidad. Vamos a recorrer el cuerpo despacio, de los pies a la cara, sólo notando lo que hay.', voice: 'scan', steps: SCAN_REGIONS.map(([, text], i) => ({ at: Math.round((body / n) * i) + (i === 0 ? 10 : 0), text, voice: `scan_${i + 1}` as VoiceId })), eyesClosed: true });
  } else {
    phases.push({ kind: 'sounds', title: 'Los sonidos', seconds: body, cue: 'Cierra los ojos. Deja que lleguen los sonidos de alrededor, cercanos y lejanos, sin ir a buscarlos ni ponerles nombre.', voice: 'sounds', steps: [
      { at: Math.round(body * 0.5), text: 'Los sonidos aparecen y desaparecen solos.', voice: 'sounds_step' },
    ], eyesClosed: true });
  }
  const breathCue: [string, string, VoiceId] = breathKind === 'nose'
    ? ['La respiración', 'Lleva ahora la atención al aire que entra y sale por la nariz. Fresco al entrar, templado al salir. Ese es tu punto de apoyo.', 'breath_nose']
    : breathKind === 'belly'
      ? ['La respiración', 'Lleva ahora la atención al vientre, que sube al coger aire y baja al soltarlo. Sin cambiar el ritmo. Ese es tu punto de apoyo.', 'breath_belly']
      : ['La respiración', 'Lleva ahora la atención a la respiración y cuenta cada espiración: uno, dos… hasta diez, y vuelve a empezar. Si te pierdes, empieza en uno, sin más.', 'breath_count'];
  const reminders = shuffle(r, REMINDERS).slice(0, Math.max(1, Math.min(4, Math.floor(breath / 75))));
  const every = breath / (reminders.length + 1);
  phases.push({ kind: 'breath', title: breathCue[0], seconds: breath, cue: breathCue[1], voice: breathCue[2], steps: reminders.map(([id, text], i) => ({ at: Math.round(every * (i + 1)), text, voice: id })), eyesClosed: true });
  phases.push({ kind: 'closing_breaths', title: 'Para terminar', seconds: closing, cue: 'Tres respiraciones profundas más, siguiendo el círculo.', voice: 'closing', steps: [], eyesClosed: false });
  phases.push({ kind: 'open_eyes', title: 'Abre los ojos', seconds: open, cue: 'Abre los ojos despacio. Mira alrededor. Tómate un momento antes de moverte.', voice: 'open_eyes', steps: [], eyesClosed: false });
  return phases;
}

export function planSeconds(plan: Phase[]): number { return plan.reduce((a, p) => a + p.seconds, 0); }

// ----- Diario de sesiones -----

export interface Session {
  id: number;
  started_at: number;
  ended_at: number | null;
  planned_seconds: number;
  done_seconds: number;
  feeling: number | null;
  unpleasant: boolean;
  notes: string;
}

interface Row { id: number; started_at: number; ended_at: number | null; planned_seconds: number; done_seconds: number; feeling: number | null; unpleasant: number; notes: string }
const map = (r: Row): Session => ({ ...r, unpleasant: r.unpleasant === 1 });

export function start(db: Database, plan: Phase[], now: number): number {
  db.run('INSERT INTO meditation_sessions(started_at, planned_seconds, plan) VALUES (?1, ?2, ?3)', [now, planSeconds(plan), JSON.stringify(plan.map((p) => p.kind))]);
  return db.scalar<number>('SELECT last_insert_rowid()')!;
}

export function finish(db: Database, id: number, o: { now: number; doneSeconds: number; feeling: number | null; unpleasant: boolean; notes: string }): void {
  db.run('UPDATE meditation_sessions SET ended_at = ?2, done_seconds = ?3, feeling = ?4, unpleasant = ?5, notes = ?6 WHERE id = ?1', [id, o.now, Math.max(0, Math.round(o.doneSeconds)), o.feeling, o.unpleasant ? 1 : 0, o.notes.trim()]);
}

/** Sesiones terminadas (con hora de fin), las más recientes primero. */
export function list(db: Database, limit = 100): Session[] {
  return db.all<Row>('SELECT id, started_at, ended_at, planned_seconds, done_seconds, feeling, unpleasant, notes FROM meditation_sessions WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?1', [limit]).map(map);
}

export function get(db: Database, id: number): Session | null {
  const r = db.all<Row>('SELECT id, started_at, ended_at, planned_seconds, done_seconds, feeling, unpleasant, notes FROM meditation_sessions WHERE id = ?1', [id])[0];
  return r ? map(r) : null;
}

/** Borra sesiones empezadas y nunca terminadas (la app se cerró a medias). */
export function discardUnfinished(db: Database): void {
  db.run('DELETE FROM meditation_sessions WHERE ended_at IS NULL');
}

/** Cuántas de las últimas `n` sesiones llevan la bandera de experiencia desagradable. */
export function unpleasantAmongLast(db: Database, n = 3): number {
  return db.scalar<number>('SELECT count(*) FROM (SELECT unpleasant FROM meditation_sessions WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?1) WHERE unpleasant = 1', [n]) ?? 0;
}

export function totals(db: Database): { sessions: number; minutes: number } {
  const r = db.all<{ n: number; s: number }>('SELECT count(*) AS n, coalesce(sum(done_seconds), 0) AS s FROM meditation_sessions WHERE ended_at IS NOT NULL')[0];
  return { sessions: r?.n ?? 0, minutes: Math.round((r?.s ?? 0) / 60) };
}

// ----- Preferencias (en la base cifrada, tabla settings) -----

export interface Prefs { minutes: number; voice: boolean; voiceName: VoiceName; vibrate: boolean; gong: boolean; background: string }
const DEFAULTS: Prefs = { minutes: 10, voice: true, voiceName: 'serena', vibrate: true, gong: true, background: '' };

export function prefs(db: Database): Prefs {
  const raw = db.scalar<string>("SELECT value FROM settings WHERE key = 'meditation_prefs'");
  if (!raw) return { ...DEFAULTS };
  try { const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) }; if (!isVoiceName(p.voiceName)) p.voiceName = DEFAULTS.voiceName; return p; } catch { return { ...DEFAULTS }; }
}

export function setPrefs(db: Database, p: Partial<Prefs>): Prefs {
  const next = { ...prefs(db), ...p };
  db.run("INSERT INTO settings(key, value) VALUES ('meditation_prefs', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(next)]);
  return next;
}

export const FEELINGS: { value: number; label: string }[] = [
  { value: 2, label: 'Más en calma' },
  { value: 1, label: 'Algo más tranquilo' },
  { value: 0, label: 'Igual' },
  { value: -1, label: 'Algo inquieto' },
  { value: -2, label: 'Peor que antes' },
];

export function feelingLabel(v: number | null): string {
  return FEELINGS.find((f) => f.value === v)?.label ?? 'Sin indicar';
}
