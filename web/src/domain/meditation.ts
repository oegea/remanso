/**
 * Meditación de calma y atención: sesiones guiadas, variadas, y su diario. Nada aquí
 * tiene que ver con los impulsos: se medita por meditar.
 *
 * Estructura de toda sesión: «Empecemos» y gong → reflexión amable → tres respiraciones
 * profundas → una parte de cuerpo (`BODIES`) → atención con un apoyo (`FOCUSES`) → gong →
 * abrir los ojos → tres respiraciones → despedida. Las variantes cambian con la semilla,
 * para que ninguna sesión sea igual.
 *
 * MODELO DE TIEMPOS (docs/design/meditacion-tiempos.md). Una sesión es una fila de cosas que
 * duran lo que duran (cada frase de la voz, medida; el círculo; el gong) y, tras cada frase,
 * un silencio que depende de lo que esa frase pide a quien la escucha: su papel (`Role`).
 * La tabla `SILENCE` da para cada papel un mínimo y un máximo. Con eso, tres reglas:
 *  1. Ningún guion se recorta: una combinación entra si cabe entera con sus silencios al
 *     mínimo; si no, se elige otra.
 *  2. Lo que sobra se reparte entre todos los silencios de la sesión en la misma proporción
 *     de su margen (`stretch`: 0 = todos al mínimo, 1 = todos al máximo). Un anuncio, con un
 *     segundo de margen, casi no se estira; la práctica, con minutos, se lleva casi todo.
 *  3. La parte principal lleva los recordatorios que dejan esa proporción más cerca de la
 *     mitad: más tiempo da más silencio, hasta que conviene un recordatorio más.
 * Este módulo hace el plan; quien lo lleva a cabo segundo a segundo es meditationRun.ts.
 */
import type { Database } from '../db/sqlite';
import { rng } from '../audio/synth';
import { isVoiceName, type VoiceId, type VoiceName } from '../audio/voice';
import DURATIONS_JSON from '../audio/voice-durations.json';

export type PhaseKind = 'intention' | 'deep_breaths' | 'settle' | 'scan' | 'sounds' | 'posture' | 'weight' | 'breath_body' | 'breath' | 'closing_breaths' | 'open_eyes';

/**
 * Qué pide una frase a quien la escucha; de eso depende el silencio que necesita después.
 *  - `welcome`: colocarse (la postura, dejar el teléfono).
 *  - `reflection`: quedarse un momento con una idea.
 *  - `announce`: nada; avisa de lo que viene enseguida en pantalla (el círculo). No se estira.
 *  - `explain`: nada todavía; explica una parte cuya primera indicación llega a continuación.
 *  - `adjust`: un ajuste breve del cuerpo (un punto de la postura).
 *  - `place`: llevar la atención a un sitio y notarlo (una zona de un recorrido).
 *  - `practice`: practicar por cuenta propia con lo que se acaba de indicar.
 *  - `focus`: lo mismo en la parte principal de la sesión, la más larga y la más callada.
 */
export type Role = 'welcome' | 'reflection' | 'announce' | 'explain' | 'adjust' | 'place' | 'practice' | 'focus';

export interface Span { min: number; max: number }

/**
 * Silencio tras una frase, en segundos, según su papel. Por debajo del mínimo la indicación
 * siguiente atropella; por encima del máximo la persona se queda esperando o demasiado sola.
 * Es la única tabla que hay que tocar para cambiar el ritmo de las sesiones.
 */
export const SILENCE: Record<Role, Span> = {
  welcome: { min: 2, max: 5 },
  reflection: { min: 8, max: 18 },
  announce: { min: 1, max: 1 },
  explain: { min: 6, max: 12 },
  adjust: { min: 8, max: 30 },
  place: { min: 12, max: 60 },
  practice: { min: 40, max: 150 },
  focus: { min: 60, max: 180 },
};

/** Lo que tarda el gong antes de la frase que lo sigue. */
export const GONG_S = 2.5;
/** Lo que dura el círculo: tres respiraciones de 4 s al coger aire y 6 s al soltarlo. */
export const CIRCLE_S = 30;
export interface Step { at: number; text: string; voice?: VoiceId; role: Role }

export interface Phase {
  kind: PhaseKind;
  title: string;
  seconds: number;
  /** Instrucción visible, breve. */
  cue: string;
  /** Frase pregrabada que la voz guía dice en la fase (texto completo en voice-lines.json). */
  voice?: VoiceId;
  /** Qué pide esa frase (`SILENCE`). */
  role?: Role;
  /** Segundo de la fase en que se dice; si falta, al empezarla. */
  voiceAt?: number;
  /** Pasos intermedios (zonas de un recorrido, recordatorios), en segundos desde el inicio de la fase. */
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

/** Una frase de un guion: cuál es, qué pide y lo que se ve en pantalla cuando toca. */
export interface Line { id: VoiceId; role: Role; text: string }
type L = [VoiceId, Role, string];
const lines = (list: L[]): Line[] => list.map(([id, role, text]) => ({ id, role, text }));

const INTENTIONS: Line[] = lines([
  ['intention_1', 'reflection', 'Piensa en alguien a quien le deseas que le vaya bien hoy. Quédate un momento con ese deseo.'],
  ['intention_2', 'reflection', 'Recuerda algo pequeño y bueno de estos días: una conversación, un rato de sol, un plato que te gustó.'],
  ['intention_3', 'reflection', 'Deséate a ti mismo tranquilidad para este rato, sin exigirte nada.'],
  ['intention_4', 'reflection', 'Piensa en algo que agradeces hoy, por pequeño que sea, y déjalo estar un momento.'],
  ['intention_5', 'reflection', 'Desea que las personas con las que te cruzarás hoy estén bien. Sin más.'],
  ['intention_6', 'reflection', 'Date permiso para no hacer nada útil durante estos minutos.'],
  ['intention_7', 'reflection', 'Recuerda por qué te sientas hoy. Querer un rato de calma ya es suficiente.'],
  ['intention_8', 'reflection', 'Durante estos minutos no hay nada que resolver ni que conseguir. Sólo toca estar.'],
]);

const REMINDERS: Line[] = lines([
  ['reminder_1', 'focus', 'Si notas que la mente se ha ido, no pasa nada. Vuelve a la respiración, con suavidad.'],
  ['reminder_2', 'focus', 'Los pensamientos vienen y van. No hace falta apartarlos ni seguirlos; míralos pasar.'],
  ['reminder_3', 'focus', 'No intentes dejar la mente en blanco. Sólo observa, y vuelve al aire.'],
  ['reminder_4', 'focus', 'Si aparece una sensación, un ruido o una idea, déjala estar y vuelve.'],
  ['reminder_5', 'focus', 'Cada vez que vuelves es la práctica. Volver no es fallar.'],
  ['reminder_6', 'focus', 'Relaja la cara, los hombros, las manos. Y sigue con la respiración.'],
  ['reminder_7', 'focus', 'Si notas sueño o pesadez, endereza un poco la espalda y aviva la atención.'],
  ['reminder_8', 'focus', 'Si notas prisa o inquietud, afloja los hombros y deja que la atención se pose más blanda.'],
  ['reminder_9', 'focus', 'De vez en cuando, vigila de reojo si sigues con tu apoyo. Si no, vuelve.'],
  ['reminder_10', 'focus', 'La atención se posa, no se aprieta. Si fuerzas, suelta un poco.'],
  ['reminder_11', 'focus', 'Deja que esta respiración sea la primera.'],
]);

/** Recordatorios que hablan de la respiración: sólo valen cuando el apoyo es la respiración. */
const BREATH_ONLY: ReadonlySet<VoiceId> = new Set<VoiceId>(['reminder_1', 'reminder_2', 'reminder_3', 'reminder_4', 'reminder_6', 'reminder_11']);

const FAREWELLS: VoiceId[] = ['farewell', 'farewell_2', 'farewell_3'];

/**
 * Variantes de la parte de cuerpo. Cada una es un guion: su explicación y sus indicaciones,
 * cada frase con su papel. Los recorridos (zonas, puntos de la postura) van siempre enteros.
 */
interface BodyVariant { kind: PhaseKind; title: string; eyesClosed: boolean; script: Line[] }
const BODIES: BodyVariant[] = [
  { kind: 'settle', title: 'Asentarse', eyesClosed: true, script: lines([
    ['settle', 'explain', 'Cierra los ojos. Respira con normalidad y nota el cuerpo sentado: el peso en el asiento, los pies en el suelo, las manos donde estén.'],
    ['settle_feet', 'place', 'Los pies en el suelo.'],
    ['scan_2', 'place', 'Las piernas: dónde apoyan y dónde no.'],
    ['scan_3', 'place', 'La cadera y la espalda, sin corregir nada.'],
    ['settle_hands', 'place', 'Las manos, donde descansen.'],
    ['scan_5', 'place', 'Los hombros y el cuello.'],
    ['scan_6', 'place', 'La cara. Y el cuerpo entero, sentado, respirando.'],
  ]) },
  { kind: 'scan', title: 'Un recorrido por el cuerpo', eyesClosed: true, script: lines([
    ['scan', 'explain', 'Cierra los ojos y respira con normalidad. Vamos a recorrer el cuerpo despacio, de los pies a la cara, sólo notando lo que hay.'],
    ['scan_1', 'place', 'Lleva la atención a los pies: su peso, el contacto con el suelo o el calzado.'],
    ['scan_2', 'place', 'Sube a las piernas. Nota dónde apoyan y dónde no.'],
    ['scan_3', 'place', 'La cadera sobre el asiento, la espalda. Nota el apoyo sin corregir nada.'],
    ['scan_4', 'place', 'Las manos, donde descansen. Su temperatura, su peso.'],
    ['scan_5', 'place', 'Los hombros y el cuello. Si hay tensión, sólo obsérvala.'],
    ['scan_6', 'place', 'La cara: la frente, los ojos, la mandíbula. Deja que se aflojen si quieren.'],
  ]) },
  { kind: 'sounds', title: 'Los sonidos', eyesClosed: true, script: lines([
    ['sounds', 'practice', 'Cierra los ojos. Deja que lleguen los sonidos de alrededor, cercanos y lejanos, sin ir a buscarlos ni ponerles nombre.'],
    ['sounds_step', 'practice', 'Los sonidos aparecen y desaparecen solos.'],
  ]) },
  { kind: 'posture', title: 'La postura, punto por punto', eyesClosed: true, script: lines([
    ['posture', 'explain', 'Cierra los ojos. Vamos a colocar la postura de abajo arriba, ajustando lo mínimo, para que el cuerpo pueda quedarse quieto sin esfuerzo.'],
    ['posture_1', 'adjust', 'Los pies y el asiento.'],
    ['posture_2', 'adjust', 'La espalda: recta, sin rigidez.'],
    ['posture_3', 'adjust', 'Las manos, donde estén cómodas.'],
    ['posture_4', 'adjust', 'Los hombros, lejos de las orejas.'],
    ['posture_5', 'adjust', 'La cabeza y la cara.'],
  ]) },
  { kind: 'weight', title: 'El peso y el apoyo', eyesClosed: true, script: lines([
    ['weight', 'explain', 'Cierra los ojos. Nota sólo el peso del cuerpo y lo que lo sostiene, como una montaña que no hace nada por mantenerse en pie.'],
    ['weight_support', 'practice', 'Dónde apoya el cuerpo.'],
    ['weight_still', 'practice', 'La quietud que da ese peso.'],
  ]) },
  { kind: 'breath_body', title: 'La respiración en todo el cuerpo', eyesClosed: true, script: lines([
    ['breath_body', 'practice', 'Cierra los ojos. Siente cómo el cuerpo entero se mueve con el aire, en un vaivén muy pequeño, sin respirar más hondo.'],
    ['breath_body_step', 'practice', 'El cuerpo se ensancha un poco al entrar el aire y se afloja al salir.'],
  ]) },
];

/** Variantes del apoyo de la parte principal. Tras su frase, y tras cada recordatorio, se practica. */
interface FocusVariant { voice: VoiceId; cue: string; eyesClosed: boolean; /** El apoyo es la respiración. */ breath: boolean }
const FOCUSES: FocusVariant[] = [
  { voice: 'breath_nose', eyesClosed: true, breath: true, cue: 'Lleva ahora la atención al aire que entra y sale por la nariz. Fresco al entrar, templado al salir. Ese es tu punto de apoyo.' },
  { voice: 'breath_belly', eyesClosed: true, breath: true, cue: 'Lleva ahora la atención al vientre, que sube al coger aire y baja al soltarlo. Sin cambiar el ritmo. Ese es tu punto de apoyo.' },
  { voice: 'breath_count', eyesClosed: true, breath: true, cue: 'Lleva ahora la atención a la respiración y cuenta cada espiración: uno, dos… hasta diez, y vuelve a empezar. Si te pierdes, empieza en uno, sin más.' },
  { voice: 'breath_cycle', eyesClosed: true, breath: true, cue: 'Sigue cada ciclo entero: el aire entra, una pausa breve, sale, otra pausa. Sin cambiar el ritmo. Ese es tu punto de apoyo.' },
  { voice: 'breath_count_in', eyesClosed: true, breath: true, cue: 'Cuenta al empezar a coger aire, hacia atrás: diez, nueve… hasta uno, y vuelve a diez. Si te pierdes, empieza otra vez en diez.' },
  { voice: 'gaze', eyesClosed: false, breath: false, cue: 'Ojos entreabiertos, la mirada posada en un punto quieto delante de ti, un poco por debajo de la altura de los ojos. Cuando la atención se vaya, vuelve a él.' },
  { voice: 'mind', eyesClosed: true, breath: false, cue: 'Deja que los pensamientos aparezcan y pasen, como nubes en un cielo que no se mueve. No los sigas ni los apartes: míralos llegar y míralos irse.' },
];
const focusScript = (f: FocusVariant, reminders: Line[]): Line[] => [{ id: f.voice, role: 'focus', text: f.cue }, ...reminders];

function pick<T>(r: () => number, list: readonly T[]): T { return list[Math.floor(r() * list.length)]; }
function shuffle<T>(r: () => number, list: readonly T[]): T[] { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/**
 * Lo que dura cada frase de la voz (medido de los MP3, el mayor de las dos voces;
 * `tools/voice_durations.py`). Sin voz una frase no ocupa tiempo: sólo se ve en pantalla.
 */
const DUR = DURATIONS_JSON as Record<VoiceId, number>;
export function lineDuration(id: VoiceId | undefined, voice = true): number { return voice && id ? DUR[id] : 0; }

type Said = Pick<Line, 'id' | 'role'>;

/** Lo que suman las frases de un guion, sus silencios al mínimo y el margen de esos silencios. */
function measure(script: readonly Said[], voice: boolean): { said: number; least: number; room: number } {
  let said = 0, least = 0, room = 0;
  for (const l of script) { said += lineDuration(l.id, voice); least += SILENCE[l.role].min; room += SILENCE[l.role].max - SILENCE[l.role].min; }
  return { said, least, room };
}

/** Entre cuánto y cuánto puede durar un guion: sus frases más sus silencios al mínimo y al máximo. */
export function span(script: readonly Said[], voice = true): Span {
  const m = measure(script, voice);
  return { min: Math.ceil(m.said + m.least), max: Math.floor(m.said + m.least + m.room) };
}

/**
 * Cuánto hay que estirar los silencios de un guion para que ocupe `seconds`: 0 = todos al
 * mínimo, 1 = todos al máximo. Negativo: no cabe.
 */
export function stretch(script: readonly Said[], seconds: number, voice = true): number {
  const m = measure(script, voice);
  return m.room > 0 ? (seconds - m.said - m.least) / m.room : 0;
}

/** El silencio tras una frase de ese papel cuando la sesión se estira `k`. */
export function silence(role: Role, k: number): number {
  return SILENCE[role].min + Math.max(0, k) * (SILENCE[role].max - SILENCE[role].min);
}

/**
 * Coloca las frases de un guion en `seconds`: cada una empieza cuando han acabado la
 * anterior y su silencio, todos estirados en la misma proporción. Devuelve el segundo en
 * que empieza cada frase.
 */
export function layout(script: readonly Said[], seconds: number, voice = true): number[] {
  const k = stretch(script, seconds, voice);
  const at: number[] = [];
  let t = 0;
  for (const l of script) {
    at.push(t <= 0 ? 0 : Math.ceil(t - 1e-6));
    t += lineDuration(l.id, voice) + silence(l.role, k);
  }
  return at;
}

const WELCOME: Said = { id: 'empecemos', role: 'welcome' };
const DEEP: Said = { id: 'deep_breaths', role: 'announce' };
const CLOSING: Said = { id: 'closing', role: 'announce' };
/** Lo que ocupa en toda sesión con voz lo que no es frase ni silencio: los dos círculos y el gong del final. */
const FIXED_S = 2 * CIRCLE_S + GONG_S;
/** Sin voz, las partes que no son práctica duran lo que se tarda en leerlas: la reflexión y «abre los ojos». */
const SILENT_OPENING_S = 45, SILENT_OPEN_EYES_S = 12;
/** Margen para los redondeos a segundos enteros al comprobar que una combinación cabe. */
const ROUNDING_S = 3;

/**
 * Plan de una sesión de `minutes` minutos. La misma semilla da el mismo plan (pruebas).
 * El azar elige el contenido (reflexión, variante de cuerpo, apoyo, recordatorios,
 * despedida) entre lo que cabe entero; los tiempos salen del modelo, sin azar.
 */
export function makePlan(minutes: number, seed = Date.now(), voice = true): Phase[] {
  const r = rng(seed);
  const total = minutes * 60;

  // La sesión entera como un solo guion, y el tiempo que tiene para sus frases y silencios.
  // Sin voz, las partes que no son práctica tienen duración fija y sólo se reparte la práctica.
  const session = (intent: Line, practice: readonly Said[]): Said[] => (voice ? [WELCOME, intent, DEEP, ...practice, CLOSING] : [...practice]);
  const room = voice ? total - FIXED_S : total - SILENT_OPENING_S - SILENT_OPEN_EYES_S - 2 * CIRCLE_S;
  const fits = (intent: Line, practice: readonly Said[]) => span(session(intent, practice), voice).min + ROUNDING_S <= room;

  // Contenido: al azar entre lo que cabe entero. Si nada cupiera (no debería), lo más corto.
  const shuffled = shuffle(r, REMINDERS);
  const shortest = [...REMINDERS].filter((l) => !BREATH_ONLY.has(l.id)).sort((a, b) => DUR[a.id] - DUR[b.id])[0];
  const smallest = [...BODIES].sort((a, b) => span(a.script, voice).min - span(b.script, voice).min)[0];
  const intents = shuffle(r, INTENTIONS), focuses = shuffle(r, FOCUSES);
  let intent = intents.find((i) => focuses.some((f) => fits(i, [...smallest.script, ...focusScript(f, [shortest])])));
  let focus = intent ? focuses.find((f) => fits(intent!, [...smallest.script, ...focusScript(f, [shortest])])) : undefined;
  if (!intent || !focus) {
    intent = [...INTENTIONS].sort((a, b) => DUR[a.id] - DUR[b.id])[0];
    focus = [...FOCUSES].sort((a, b) => DUR[a.voice] - DUR[b.voice])[0];
  }
  // Los recordatorios que encajan con el apoyo elegido, en el orden que ha dado el azar.
  const reminders = shuffled.filter((l) => focus!.breath || !BREATH_ONLY.has(l.id));
  const withBody = (b: BodyVariant, n: number): Line[] => [...b.script, ...focusScript(focus!, reminders.slice(0, n))];
  // Si con el primer recordatorio al azar no cupiera ningún cuerpo, va el más corto.
  if (!fits(intent, withBody(smallest, 1))) {
    const k = reminders.findIndex((x) => x.id === shortest.id);
    if (k > 0) { reminders.splice(k, 1); reminders.unshift(shortest); }
  }
  const bodies = BODIES.filter((b) => fits(intent!, withBody(b, 1)));
  const body = bodies.length ? pick(r, bodies) : smallest;

  // Recordatorios: los que dejan el estiramiento de la sesión más cerca de la mitad.
  let n = 1;
  const off = (count: number) => Math.abs(stretch(session(intent!, withBody(body, count)), room, voice) - 0.5);
  for (let count = 2; count <= reminders.length && fits(intent, withBody(body, count)); count++) if (off(count) < off(n)) n = count;
  const practice = withBody(body, n);
  const k = stretch(session(intent, practice), room, voice);

  // Las partes que no son práctica, con sus silencios estirados como los demás.
  const voiceAt = voice ? Math.ceil(DUR.empecemos + silence('welcome', k)) : undefined;
  const opening = voice ? Math.ceil(DUR.empecemos + silence('welcome', k) + DUR[intent.id] + silence('reflection', k)) : SILENT_OPENING_S;
  const deepLead = voice ? Math.ceil(DUR.deep_breaths + silence('announce', k)) : 0;
  const open = voice ? Math.ceil(GONG_S + DUR.closing + silence('announce', k)) : SILENT_OPEN_EYES_S;

  // La práctica (cuerpo y parte principal) ocupa el resto, colocada como un solo guion.
  const main = total - opening - deepLead - CIRCLE_S - open - CIRCLE_S;
  const at = layout(practice, main, voice);
  const split = body.script.length;
  const bodySeconds = at[split];
  const steps = (from: number, to: number, origin: number): Step[] => practice.slice(from, to).map((l, i) => ({ at: at[from + i] - origin, text: l.text, voice: l.id, role: l.role }));

  const phases: Phase[] = [];
  phases.push({ kind: 'intention', title: 'Para empezar', seconds: opening, cue: intent.text, voice: intent.id, role: intent.role, voiceAt, steps: [], eyesClosed: false });
  phases.push({ kind: 'deep_breaths', title: 'Tres respiraciones profundas', seconds: deepLead + CIRCLE_S, lead: deepLead, cue: 'Cuando aparezca el círculo, coge aire despacio mientras crece y suéltalo mientras se encoge. Tres veces.', voice: 'deep_breaths', role: 'announce', steps: [], eyesClosed: false });
  phases.push({ kind: body.kind, title: body.title, seconds: bodySeconds, cue: body.script[0].text, voice: body.script[0].id, role: body.script[0].role, steps: steps(1, split, 0), eyesClosed: body.eyesClosed });
  phases.push({ kind: 'breath', title: focus.voice === 'gaze' ? 'Un punto a la vista' : focus.voice === 'mind' ? 'Mirar la mente' : 'La respiración', seconds: main - bodySeconds, cue: focus.cue, voice: focus.voice, role: 'focus', steps: steps(split + 1, practice.length, bodySeconds), eyesClosed: focus.eyesClosed });
  phases.push({ kind: 'open_eyes', title: 'Para terminar', seconds: open, cue: 'Abre los ojos despacio. Mira alrededor. Cuando estés, tres respiraciones más siguiendo el círculo.', voice: 'closing', role: 'announce', steps: [], eyesClosed: false });
  phases.push({ kind: 'closing_breaths', title: 'Tres respiraciones', seconds: CIRCLE_S, cue: 'Coge aire mientras el círculo crece y suéltalo mientras se encoge. Tres veces.', steps: [], eyesClosed: false, endVoice: pick(r, FAREWELLS) });
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
