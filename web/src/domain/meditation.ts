/**
 * Meditación de calma y atención: sesiones guiadas, variadas, y su diario. Nada aquí
 * tiene que ver con los impulsos: se medita por meditar.
 *
 * Estructura de toda sesión: reflexión amable → gong → tres respiraciones profundas →
 * una parte de cuerpo (asentarse, recorrido o sonidos) → atención a la respiración (en
 * la nariz, en el vientre o contando) → gong → abrir los ojos → tres respiraciones →
 * despedida. Las variantes y las proporciones cambian con la semilla, para que ninguna
 * sesión sea igual. Con voz, las fases con círculo empiezan por la explicación (`lead`)
 * y el círculo aparece cuando la voz ha terminado de explicar cómo seguirlo.
 */
import type { Database } from '../db/sqlite';
import { rng } from '../audio/synth';
import { isVoiceName, type VoiceId, type VoiceName } from '../audio/voice';
import DURATIONS_JSON from '../audio/voice-durations.json';

export type PhaseKind = 'intention' | 'deep_breaths' | 'settle' | 'scan' | 'sounds' | 'posture' | 'weight' | 'breath_body' | 'breath' | 'closing_breaths' | 'open_eyes';

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
  /** Segundos iniciales en que se enseña la indicación (la voz explica) antes del círculo. */
  lead?: number;
  /** Frase que suena al acabar la última parte (la despedida), antes del formulario. */
  endVoice?: VoiceId;
}

/** Diez minutos como mínimo: con menos no hay sitio para la voz y para practicar en silencio. */
export const DURATIONS = [10, 15, 20] as const;

const INTENTIONS: [VoiceId, string][] = [
  ['intention_1', 'Piensa en alguien a quien le deseas que le vaya bien hoy. Quédate un momento con ese deseo.'],
  ['intention_2', 'Recuerda algo pequeño y bueno de estos días: una conversación, un rato de sol, un plato que te gustó.'],
  ['intention_3', 'Deséate a ti mismo tranquilidad para este rato, sin exigirte nada.'],
  ['intention_4', 'Piensa en algo que agradeces hoy, por pequeño que sea, y déjalo estar un momento.'],
  ['intention_5', 'Desea que las personas con las que te cruzarás hoy estén bien. Sin más.'],
  ['intention_6', 'Date permiso para no hacer nada útil durante estos minutos.'],
  ['intention_7', 'Recuerda por qué te sientas hoy. Querer un rato de calma ya es suficiente.'],
  ['intention_8', 'Durante estos minutos no hay nada que resolver ni que conseguir. Sólo toca estar.'],
];

const REMINDERS: [VoiceId, string][] = [
  ['reminder_1', 'Si notas que la mente se ha ido, no pasa nada. Vuelve a la respiración, con suavidad.'],
  ['reminder_2', 'Los pensamientos vienen y van. No hace falta apartarlos ni seguirlos; míralos pasar.'],
  ['reminder_3', 'No intentes dejar la mente en blanco. Sólo observa, y vuelve al aire.'],
  ['reminder_4', 'Si aparece una sensación, un ruido o una idea, déjala estar y vuelve.'],
  ['reminder_5', 'Cada vez que vuelves es la práctica. Volver no es fallar.'],
  ['reminder_6', 'Relaja la cara, los hombros, las manos. Y sigue con la respiración.'],
  ['reminder_7', 'Si notas sueño o pesadez, endereza un poco la espalda y aviva la atención.'],
  ['reminder_8', 'Si notas prisa o inquietud, afloja los hombros y deja que la atención se pose más blanda.'],
  ['reminder_9', 'De vez en cuando, vigila de reojo si sigues con tu apoyo. Si no, vuelve.'],
  ['reminder_10', 'La atención se posa, no se aprieta. Si fuerzas, suelta un poco.'],
  ['reminder_11', 'Deja que esta respiración sea la primera.'],
];

const FAREWELLS: VoiceId[] = ['farewell', 'farewell_2', 'farewell_3'];

/** Variantes de la parte de cuerpo: explicación, pasos y texto en pantalla. */
interface BodyVariant { kind: PhaseKind; title: string; cue: string; voice: VoiceId; steps: [VoiceId, string][]; eyesClosed: boolean }
const BODIES: BodyVariant[] = [
  { kind: 'settle', title: 'Asentarse', voice: 'settle', eyesClosed: true, cue: 'Cierra los ojos. Respira con normalidad y nota el cuerpo sentado: el peso en el asiento, los pies en el suelo, las manos donde estén.',
    steps: [['settle_feet', 'Los pies en el suelo.'], ['settle_hands', 'Las manos, donde descansen.']] },
  { kind: 'scan', title: 'Un recorrido por el cuerpo', voice: 'scan', eyesClosed: true, cue: 'Cierra los ojos y respira con normalidad. Vamos a recorrer el cuerpo despacio, de los pies a la cara, sólo notando lo que hay.',
    steps: [] /* se rellena abajo con SCAN_REGIONS */ },
  { kind: 'sounds', title: 'Los sonidos', voice: 'sounds', eyesClosed: true, cue: 'Cierra los ojos. Deja que lleguen los sonidos de alrededor, cercanos y lejanos, sin ir a buscarlos ni ponerles nombre.',
    steps: [['sounds_step', 'Los sonidos aparecen y desaparecen solos.']] },
  { kind: 'posture', title: 'La postura, punto por punto', voice: 'posture', eyesClosed: true, cue: 'Cierra los ojos. Vamos a colocar la postura de abajo arriba, ajustando lo mínimo, para que el cuerpo pueda quedarse quieto sin esfuerzo.',
    steps: [['posture_1', 'Los pies y el asiento.'], ['posture_2', 'La espalda: recta, sin rigidez.'], ['posture_3', 'Las manos, donde estén cómodas.'], ['posture_4', 'Los hombros, lejos de las orejas.'], ['posture_5', 'La cabeza y la cara.']] },
  { kind: 'weight', title: 'El peso y el apoyo', voice: 'weight', eyesClosed: true, cue: 'Cierra los ojos. Nota sólo el peso del cuerpo y lo que lo sostiene, como una montaña que no hace nada por mantenerse en pie.',
    steps: [['weight_support', 'Dónde apoya el cuerpo.'], ['weight_still', 'La quietud que da ese peso.']] },
  { kind: 'breath_body', title: 'La respiración en todo el cuerpo', voice: 'breath_body', eyesClosed: true, cue: 'Cierra los ojos. Siente cómo el cuerpo entero se mueve con el aire, en un vaivén muy pequeño, sin respirar más hondo.',
    steps: [['breath_body_step', 'El cuerpo se ensancha un poco al entrar el aire y se afloja al salir.']] },
];

/** Variantes del foco de la parte de respiración. */
interface FocusVariant { voice: VoiceId; cue: string; eyesClosed: boolean }
const FOCUSES: FocusVariant[] = [
  { voice: 'breath_nose', eyesClosed: true, cue: 'Lleva ahora la atención al aire que entra y sale por la nariz. Fresco al entrar, templado al salir. Ese es tu punto de apoyo.' },
  { voice: 'breath_belly', eyesClosed: true, cue: 'Lleva ahora la atención al vientre, que sube al coger aire y baja al soltarlo. Sin cambiar el ritmo. Ese es tu punto de apoyo.' },
  { voice: 'breath_count', eyesClosed: true, cue: 'Lleva ahora la atención a la respiración y cuenta cada espiración: uno, dos… hasta diez, y vuelve a empezar. Si te pierdes, empieza en uno, sin más.' },
  { voice: 'breath_cycle', eyesClosed: true, cue: 'Sigue cada ciclo entero: el aire entra, una pausa breve, sale, otra pausa. Sin cambiar el ritmo. Ese es tu punto de apoyo.' },
  { voice: 'breath_count_in', eyesClosed: true, cue: 'Cuenta al empezar a coger aire, hacia atrás: diez, nueve… hasta uno, y vuelve a diez. Si te pierdes, empieza otra vez en diez.' },
  { voice: 'gaze', eyesClosed: false, cue: 'Ojos entreabiertos, la mirada posada en un punto quieto delante de ti, un poco por debajo de la altura de los ojos. Cuando la atención se vaya, vuelve a él.' },
  { voice: 'mind', eyesClosed: true, cue: 'Deja que los pensamientos aparezcan y pasen, como nubes en un cielo que no se mueve. No los sigas ni los apartes: míralos llegar y míralos irse.' },
];

const SCAN_REGIONS: [string, string][] = [
  ['Los pies', 'Lleva la atención a los pies: su peso, el contacto con el suelo o el calzado.'],
  ['Las piernas', 'Sube a las piernas. Nota dónde apoyan y dónde no.'],
  ['La cadera y la espalda', 'La cadera sobre el asiento, la espalda. Nota el apoyo sin corregir nada.'],
  ['Las manos', 'Las manos, donde descansen. Su temperatura, su peso.'],
  ['Los hombros y el cuello', 'Los hombros y el cuello. Si hay tensión, sólo obsérvala.'],
  ['La cara', 'La cara: la frente, los ojos, la mandíbula. Deja que se aflojen si quieren.'],
];

BODIES[1].steps = SCAN_REGIONS.map(([, text], i) => [`scan_${i + 1}` as VoiceId, text]);

function pick<T>(r: () => number, list: readonly T[]): T { return list[Math.floor(r() * list.length)]; }
function shuffle<T>(r: () => number, list: readonly T[]): T[] { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/**
 * Lo que dura cada frase de la voz (medido de los MP3, el mayor de las dos voces;
 * `tools/voice_durations.py`). El plan suma estas duraciones para saber qué cabe.
 */
const DUR = DURATIONS_JSON as Record<VoiceId, number>;
/** Silencio mínimo tras cada frase, para respirar entre indicaciones. */
export const GAP_S = 4;
/** Silencio mínimo tras la explicación de una parte antes del primer paso (sin voz, los 10 s de siempre). */
export const INTRO_GAP_S = 8, SILENT_INTRO_GAP_S = 10;
/** Lo que tarda el gong antes de la frase que lo sigue. */
export const GONG_S = 2.5;

/** Tiempo mínimo de una frase: lo que dura más su silencio. Sin voz, nada. */
export function lineSeconds(id: VoiceId | undefined, voice = true): number {
  return voice && id ? DUR[id] + GAP_S : 0;
}
/** Tiempo mínimo de una parte: su explicación (más su silencio) y todos sus pasos, cada uno con el suyo. */
export function needSeconds(intro: VoiceId | undefined, steps: readonly VoiceId[], voice: boolean): number {
  const head = voice ? (intro ? DUR[intro] + INTRO_GAP_S : 0) : SILENT_INTRO_GAP_S;
  return Math.ceil(head + steps.reduce((a, id) => a + lineSeconds(id, voice), 0));
}

/**
 * Coloca los pasos de una parte: nunca antes de que acabe lo anterior (explicación o paso
 * previo, con su silencio), repartidos por el tiempo que sobra, y siempre de modo que la
 * última frase quepa entera antes del final. `before` y `after` son huecos de silencio
 * (en «pasos») que se reservan antes del primero y después del último: la respiración usa
 * 1 y 1 para que los recordatorios queden espaciados y ninguno caiga sobre el gong.
 */
function placeSteps(seconds: number, intro: VoiceId | undefined, steps: readonly [VoiceId, string][], voice: boolean, before = 0, after = 0.5): Step[] {
  const head = voice ? (intro ? DUR[intro] + INTRO_GAP_S : 0) : SILENT_INTRO_GAP_S;
  const n = steps.length;
  if (n === 0) return [];
  const lens = steps.map(([id]) => lineSeconds(id, voice));
  const tailNeed = (i: number) => lens.slice(i).reduce((a, b) => a + b, 0);
  const free = Math.max(0, seconds - head - tailNeed(0));
  const slots = n - 1 + before + after;
  const out: Step[] = [];
  let minAt = head;
  for (let i = 0; i < n; i++) {
    const even = head + (tailNeed(0) - tailNeed(i)) + (free * (i + before)) / slots;
    const latest = seconds - tailNeed(i);
    const at = Math.round(Math.min(latest, Math.max(minAt, even)));
    out.push({ at, text: steps[i][1], voice: steps[i][0] });
    minAt = at + lens[i];
  }
  return out;
}

/**
 * Plan de una sesión de `minutes` minutos. La misma semilla da el mismo plan (pruebas).
 * Con voz, cada parte reserva como mínimo lo que duran sus frases con sus silencios; sólo
 * se eligen variantes cuya suma cabe en el tiempo pedido, y el resto se reparte como
 * silencio. Así la duración elegida es un mínimo real: nada se corta ni se omite.
 */
export function makePlan(minutes: number, seed = Date.now(), voice = true): Phase[] {
  const r = rng(seed);
  const total = minutes * 60;

  // Partes fijas. La reflexión inicial se elige al azar entre las que caben: en sesiones
  // cortas con voz, el presupuesto manda.
  const deepLead = voice ? Math.ceil(DUR.deep_breaths + 3) : 0;
  const deep = 30 + deepLead;
  const closing = 30;
  const open = voice ? Math.ceil(GONG_S + DUR.closing + GAP_S + 2) : 12;
  const intentionFor = (id: VoiceId) => Math.max(45, Math.ceil(lineSeconds('empecemos', voice) + (voice ? GONG_S : 0) + lineSeconds(id, voice)));

  // Cuerpo y respiración: lo que necesita cada variante (explicación y todos sus pasos).
  const needOf = (b: BodyVariant) => needSeconds(b.voice, b.steps.map(([id]) => id), voice);
  const bodyMinAny = Math.min(...BODIES.map(needOf));
  const remindersAll = shuffle(r, REMINDERS);
  const shortestReminder = [...REMINDERS].sort((a, b) => DUR[a[0]] - DUR[b[0]])[0];
  const breathMinFor = (id: VoiceId) => needSeconds(id, [shortestReminder[0]], voice);

  // Combinación: al azar entre las que caben; si ninguna cabe (no debería), la más corta.
  const intents = shuffle(r, INTENTIONS), focuses = shuffle(r, FOCUSES);
  const fitsAll = (iid: VoiceId, bid: VoiceId) => total - intentionFor(iid) - deep - closing - open >= bodyMinAny + breathMinFor(bid);
  let intent = intents.find((i) => focuses.some((f) => fitsAll(i[0], f.voice)));
  let focus = intent ? focuses.find((f) => fitsAll(intent![0], f.voice))! : undefined;
  if (!intent || !focus) {
    intent = [...INTENTIONS].sort((a, b) => DUR[a[0]] - DUR[b[0]])[0];
    focus = [...FOCUSES].sort((a, b) => DUR[a.voice] - DUR[b.voice])[0];
  }
  const intention = intentionFor(intent[0]);
  const main = total - intention - deep - closing - open;
  // Si el primer recordatorio al azar no cabe, va el más corto.
  if (needSeconds(focus.voice, [remindersAll[0][0]], voice) > main - bodyMinAny) {
    const k = remindersAll.findIndex((x) => x[0] === shortestReminder[0]);
    if (k > 0) { remindersAll.splice(k, 1); remindersAll.unshift(shortestReminder); }
  }
  const breathMin = needSeconds(focus.voice, [remindersAll[0][0]], voice);

  // Cuerpo: sólo las variantes que caben enteras dejando a la respiración su mínimo; el
  // recorrido del cuerpo, además, sólo si puede ocupar su parte sin estrechar la respiración.
  const bodyMax = main - breathMin;
  const fits = BODIES.filter((b) => needOf(b) <= bodyMax && (b.kind !== 'scan' || Math.round(main * 0.4) >= needOf(b)));
  const bodyVar = fits.length ? pick(r, fits) : [...BODIES].sort((a, b) => needOf(a) - needOf(b))[0];
  const bodyShare = bodyVar.kind === 'scan' ? 0.4 + r() * 0.1 : 0.25 + r() * 0.15;
  const body = Math.max(Math.round(main * bodyShare), Math.min(needOf(bodyVar), bodyMax));
  const breath = main - body;

  const phases: Phase[] = [];
  phases.push({ kind: 'intention', title: 'Para empezar', seconds: intention, cue: intent[1], voice: intent[0], steps: [], eyesClosed: false });
  phases.push({ kind: 'deep_breaths', title: 'Tres respiraciones profundas', seconds: deep, lead: deepLead, cue: 'Cuando aparezca el círculo, coge aire despacio mientras crece y suéltalo mientras se encoge. Tres veces.', voice: 'deep_breaths', steps: [], eyesClosed: false });
  phases.push({ kind: bodyVar.kind, title: bodyVar.title, seconds: body, cue: bodyVar.cue, voice: bodyVar.voice, steps: placeSteps(body, bodyVar.voice, bodyVar.steps, voice), eyesClosed: bodyVar.eyesClosed });
  // Tantos recordatorios como quepan (uno cada ~75 s), nunca más de cuatro ni menos de uno.
  let n = Math.max(1, Math.min(4, Math.floor((breath - needSeconds(focus.voice, [], voice)) / 75)));
  while (n > 1 && needSeconds(focus.voice, remindersAll.slice(0, n).map(([id]) => id), voice) > breath) n--;
  phases.push({ kind: 'breath', title: focus.voice === 'gaze' ? 'Un punto a la vista' : focus.voice === 'mind' ? 'Mirar la mente' : 'La respiración', seconds: breath, cue: focus.cue, voice: focus.voice, steps: placeSteps(breath, focus.voice, remindersAll.slice(0, n), voice, 1, 1), eyesClosed: focus.eyesClosed });
  phases.push({ kind: 'open_eyes', title: 'Para terminar', seconds: open, cue: 'Abre los ojos despacio. Mira alrededor. Cuando estés, tres respiraciones más siguiendo el círculo.', voice: 'closing', steps: [], eyesClosed: false });
  phases.push({ kind: 'closing_breaths', title: 'Tres respiraciones', seconds: closing, cue: 'Coge aire mientras el círculo crece y suéltalo mientras se encoge. Tres veces.', steps: [], eyesClosed: false, endVoice: pick(r, FAREWELLS) });
  return phases;
}

/** Tiempo mínimo que necesita un plan: lo que duran todas sus frases con sus silencios, por partes. */
export function planMinSeconds(plan: Phase[], voice = true): number {
  return plan.reduce((a, p) => a + Math.max(p.kind === 'deep_breaths' || p.kind === 'closing_breaths' ? 30 + (p.lead ?? 0) : 0, needSeconds(p.voice, p.steps.map((s) => s.voice).filter((v): v is VoiceId => !!v), voice)), 0);
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

/** Las notas se pueden cambiar después; la duración, cómo te sentiste y la bandera, no. */
export function setNotes(db: Database, id: number, notes: string): void {
  db.run('UPDATE meditation_sessions SET notes = ?2 WHERE id = ?1', [id, notes.trim()]);
}

/** Borra una sesión (registro por error, prueba). Los totales se recalculan. */
export function remove(db: Database, id: number): void {
  db.run('DELETE FROM meditation_sessions WHERE id = ?1', [id]);
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
  try { const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) }; if (!isVoiceName(p.voiceName)) p.voiceName = DEFAULTS.voiceName; if (!(DURATIONS as readonly number[]).includes(p.minutes)) p.minutes = DEFAULTS.minutes; return p; } catch { return { ...DEFAULTS }; }
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
