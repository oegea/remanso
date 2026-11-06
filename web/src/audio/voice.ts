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
export function voiceUrl(voice: VoiceName, id: VoiceId): string {
  return `${import.meta.env.BASE_URL}voz/${voice}/${id}.mp3`;
}

let el: HTMLAudioElement | null = null;
let seq = 0;
let settle: (() => void) | null = null;

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

/**
 * Reproduce una frase, cortando la que estuviera sonando. Resuelve cuando termina (o
 * enseguida si el navegador no deja reproducir). No hay nada asíncrono antes de `play()`,
 * para que valga dentro de un gesto.
 */
export function playLine(voice: VoiceName, id: VoiceId, volume = 1): Promise<void> {
  const a = element();
  seq++;
  finish();
  return new Promise<void>((resolve) => {
    settle = resolve;
    a.src = voiceUrl(voice, id);
    a.volume = volume;
    a.play().catch(() => finish());
  });
}

/** Como `playLine`, pero espera a que acabe la frase que esté sonando. Si mientras tanto se para o se cambia de frase, no suena. */
export async function queueLine(voice: VoiceName, id: VoiceId, volume = 1): Promise<void> {
  if (settle) {
    const mine = seq;
    await new Promise<void>((resolve) => { const prev = settle; settle = () => { prev?.(); resolve(); }; });
    if (seq !== mine) return;
  }
  return playLine(voice, id, volume);
}

export function stopLine(): void {
  seq++;
  finish();
  if (el) { try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* nada */ } }
}

export function pauseLine(): void { if (el && !el.paused) el.pause(); }
export function resumeLine(): void { if (el && el.paused && !el.ended && el.getAttribute('src')) void el.play().catch(() => {}); }

/** Pide todas las frases de una voz para que el service worker las guarde (sin fallar nunca). */
export async function warmVoice(voice: VoiceName): Promise<void> {
  for (const id of VOICE_IDS) {
    try { await fetch(voiceUrl(voice, id), { cache: 'force-cache' }); } catch { /* sin red: se servirá cuando toque */ }
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __remansoVoice: unknown }).__remansoVoice = { element: () => el };

export async function isVoiceSaved(voice: VoiceName): Promise<boolean> {
  try {
    for (const id of VOICE_IDS) if (!(await caches.match(voiceUrl(voice, id)))) return false;
    return true;
  } catch { return false; }
}
