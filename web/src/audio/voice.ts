/**
 * Voz guía de la sesión de meditación: frases pregrabadas (public/voz/<voz>/<id>.mp3,
 * generadas con un modelo abierto; ver tools/gen_voice.py) reproducidas con un <audio>.
 * Nada suena sin un gesto previo: la primera frase («Empecemos») se lanza desde el botón,
 * lo que además desbloquea el audio en iOS para las frases programadas que vienen después.
 * El service worker guarda cada frase la primera vez que suena (CacheFirst en vite.config.ts),
 * y `warmVoice` las pide todas de golpe para que la sesión funcione sin conexión.
 */
import LINES from './voice-lines.json';

export type VoiceId = keyof typeof LINES;
export type VoiceName = 'serena' | 'ryan';

export const VOICE_IDS = Object.keys(LINES) as VoiceId[];
export const VOICES: { id: VoiceName; label: string; desc: string }[] = [
  { id: 'serena', label: 'Serena', desc: 'voz femenina' },
  { id: 'ryan', label: 'Ryan', desc: 'voz masculina' },
];

export function isVoiceName(v: unknown): v is VoiceName { return v === 'serena' || v === 'ryan'; }
export function voiceText(id: VoiceId): string { return LINES[id]; }
/**
 * Cada archivo lleva en la dirección una huella de su contenido (la calcula vite.config.ts
 * al compilar). El service worker guarda la voz con CacheFirst: sin la huella, una frase
 * regenerada no llegaría nunca a quien ya tuviera guardada la toma anterior.
 */
const REV: Partial<Record<VoiceName, Record<string, string>>> = typeof __VOICE_REV__ === 'undefined' ? {} : __VOICE_REV__;
export function voiceUrl(voice: VoiceName, id: VoiceId): string {
  const rev = REV[voice]?.[id];
  return `${import.meta.env.BASE_URL}voz/${voice}/${id}.mp3${rev ? `?v=${rev}` : ''}`;
}

let el: HTMLAudioElement | null = null;
/** Sube al parar todo o al lanzar una frase directa: lo que hubiera en cola deja de tocar. */
let epoch = 0;
let settle: (() => void) | null = null;
/** La última frase lanzada o encolada: la siguiente que se encole espera a que acabe. */
let tail: Promise<void> = Promise.resolve();
let queued = 0;

function finish(): void { const f = settle; settle = null; f?.(); }

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    el.addEventListener('ended', finish);
    el.addEventListener('error', finish);
  }
  return el;
}

/** Hace sonar una frase ya. Resuelve cuando termina (o enseguida si el navegador no deja reproducir). */
function start(voice: VoiceName, id: VoiceId, volume: number): Promise<void> {
  const a = element();
  finish();
  return new Promise<void>((resolve) => {
    settle = resolve;
    a.src = voiceUrl(voice, id);
    a.volume = volume;
    a.play().catch(() => finish());
  });
}

/**
 * Reproduce una frase ahora mismo, cortando la que estuviera sonando y descartando las que
 * esperaban en cola. Es para lo que nace de un gesto (el botón de empezar, el de prueba):
 * no hay nada asíncrono antes de `play()`. Lo que se encole después espera a que termine.
 */
export function playLine(voice: VoiceName, id: VoiceId, volume = 1): Promise<void> {
  epoch++;
  const p = start(voice, id, volume);
  tail = p.catch(() => {});
  return p;
}

/**
 * Pone una frase en cola: suena cuando acaban la que suena (venga de `playLine` o de la
 * cola) y las que ya esperaban, en orden de llegada. Ninguna frase corta a otra. Si
 * mientras espera se para todo (`stopLine`) o se lanza una frase directa (`playLine`), no suena.
 */
export function queueLine(voice: VoiceName, id: VoiceId, volume = 1): Promise<void> {
  const mine = epoch;
  queued++;
  const p = tail.then(() => {
    queued--;
    if (epoch !== mine) return;
    return start(voice, id, volume);
  });
  tail = p.catch(() => {});
  return p;
}

/** Hay una frase sonando o esperando en cola: no es momento de cambiar de parte. */
export function busy(): boolean { return settle !== null || queued > 0; }

export function stopLine(): void {
  epoch++; // las frases en cola ven que ya no toca y no suenan
  finish();
  if (el) { try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* nada */ } }
}

export function pauseLine(): void { if (el && !el.paused) el.pause(); }
export function resumeLine(): void { if (el && el.paused && !el.ended && el.getAttribute('src')) void el.play().catch(() => {}); }

/** Nombre de la caché de la voz en el service worker (el mismo que en vite.config.ts). */
const VOICE_CACHE = 'remanso-voz-v1';

/**
 * Pide todas las frases de una voz para que el service worker las guarde (sin fallar nunca)
 * y, al acabar, retira de la caché las tomas que ya no son las vigentes.
 */
export async function warmVoice(voice: VoiceName): Promise<void> {
  for (const id of VOICE_IDS) {
    try { await fetch(voiceUrl(voice, id), { cache: 'force-cache' }); } catch { /* sin red: se servirá cuando toque */ }
  }
  try {
    const current = new Set(VOICES.flatMap((v) => VOICE_IDS.map((id) => new URL(voiceUrl(v.id, id), location.href).href)));
    const cache = await caches.open(VOICE_CACHE);
    for (const req of await cache.keys()) if (!current.has(req.url)) await cache.delete(req);
  } catch { /* sin caché: nada que limpiar */ }
}

if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __remansoVoice: unknown }).__remansoVoice = { element: () => el };

export async function isVoiceSaved(voice: VoiceName): Promise<boolean> {
  try {
    for (const id of VOICE_IDS) if (!(await caches.match(voiceUrl(voice, id)))) return false;
    return true;
  } catch { return false; }
}
