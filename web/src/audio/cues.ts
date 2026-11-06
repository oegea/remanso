/**
 * Señales de la sesión de meditación: gong sintetizado (parciales inarmónicos con cola
 * larga, como un cuenco metálico), vibración del móvil cuando el navegador lo permite y
 * voz local sintética (Web Speech) para indicaciones breves. Nada de esto se usa fuera de
 * la sesión; nada suena sin un gesto previo de la persona.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: 'playback' });
  }
  return ctx;
}

/** Gong suave: fundamental y parciales inarmónicos con decaimiento distinto. `soft` lo atenúa. */
export async function gong(soft = false, volume = 0.6): Promise<void> {
  const c = audio();
  if (c.state !== 'running') await c.resume();
  const t0 = c.currentTime + 0.02;
  const base = 196; // sol grave
  const partials: [number, number, number][] = [[1, 1, 9], [2.76, 0.45, 6], [5.4, 0.22, 4], [8.9, 0.1, 2.5], [1.005, 0.5, 9.5]];
  const master = c.createGain();
  master.gain.value = (soft ? 0.35 : 1) * volume;
  master.connect(c.destination);
  for (const [ratio, amp, decay] of partials) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = base * ratio;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(amp * 0.25, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + decay + 0.1);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  window.setTimeout(() => master.disconnect(), 11_000);
}

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/** Patrón corto y reconocible; en iOS no existe la API y no pasa nada. */
export function vibrate(kind: 'phase' | 'step' | 'end' = 'phase'): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(kind === 'phase' ? [160, 90, 160] : kind === 'step' ? [90] : [220, 100, 220, 100, 320]);
  } catch { /* sin vibración */ }
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

let preferredName: string | null = null;
const KEY_WORKING = 'remanso.voz.funciona';
const failed = new Set<string>();

/** Voces en español disponibles, las de España primero. */
export function spanishVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  const es = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
  return [...es.filter((v) => v.lang.toLowerCase() === 'es-es'), ...es.filter((v) => v.lang.toLowerCase() !== 'es-es')];
}

/** Elige la voz por nombre (se guarda en las preferencias de meditación). */
export function setPreferredVoice(name: string | null): void { preferredName = name; }

function remembered(): string | null { try { return localStorage.getItem(KEY_WORKING); } catch { return null; } }
function remember(name: string): void { try { localStorage.setItem(KEY_WORKING, name); } catch { /* nada */ } }

/**
 * Candidatas por orden: la elegida, la que funcionó la última vez, las locales de España,
 * el resto en español y, al final, la voz por defecto del sistema (sin fijar ninguna).
 * Se saltan las que ya fallaron en esta sesión.
 */
function candidates(): (SpeechSynthesisVoice | null)[] {
  const es = spanishVoices();
  const out: (SpeechSynthesisVoice | null)[] = [];
  const push = (v: SpeechSynthesisVoice | null | undefined) => { if (v !== undefined && !out.includes(v) && !(v && failed.has(v.name))) out.push(v); };
  if (preferredName) push(es.find((v) => v.name === preferredName));
  const r = remembered(); if (r) push(es.find((v) => v.name === r));
  for (const v of es.filter((v) => v.localService && !/google/i.test(v.name))) push(v);
  for (const v of es) push(v);
  push(null);
  return out;
}

/** Nombre de la voz que se usará, para mostrarlo; null si no hay voz en español. */
export function voiceName(): string | null {
  const c = candidates()[0];
  return c ? c.name : (spanishVoices().length ? null : null);
}

// Chrome deja de hablar si la frase se recoge en el recolector de basura, y a veces se traga
// una frase dicha justo después de `cancel()`: guardamos la referencia y esperamos un poco.
let current: SpeechSynthesisUtterance | null = null;
let seq = 0;

/**
 * Dice un texto corto con voz pausada. Si la voz elegida no arranca en dos segundos (Chrome
 * «habla» en silencio con voces que el sistema lista pero no tiene, y una frase así colgada
 * bloquea la cola de todo el navegador), se cancela y se prueba la siguiente candidata.
 * Resuelve con el nombre de la voz que sonó, o null si ninguna.
 */
export async function speak(text: string, volume = 0.9): Promise<string | null> {
  if (!canSpeak()) return null;
  const s = window.speechSynthesis;
  const mine = ++seq;
  for (const voice of candidates()) {
    if (mine !== seq) return null; // otra frase ha tomado el relevo
    const ok = await tryOnce(s, text, voice, volume);
    if (ok === 'started') { const name = voice ? voice.name : 'sistema'; remember(name); return name; }
    if (ok === 'interrupted') return null;
    if (voice) { failed.add(voice.name); console.warn('[voz] no arranca, se descarta:', voice.name); }
  }
  return null;
}

/**
 * Un intento con una voz. Comprobado en Chrome/macOS: tras `cancel()` hay que esperar
 * ~medio segundo antes de `speak()`, y nunca llamar a `pause()`/`resume()`: eso es lo que
 * dejaba el motor «hablando» sin arrancar. Con esa espera, todas las voces arrancan en ms.
 */
function tryOnce(s: SpeechSynthesis, text: string, voice: SpeechSynthesisVoice | null, volume: number): Promise<'started' | 'hung' | 'interrupted'> {
  return new Promise((resolve) => {
    try {
      let wait = 0;
      if (s.speaking || s.pending) { s.cancel(); wait = 500; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice?.lang ?? 'es-ES';
      if (voice) u.voice = voice;
      u.rate = 0.85;
      u.pitch = 0.95;
      u.volume = volume;
      current = u;
      let done = false;
      let watchdog = 0;
      u.onstart = () => { if (!done) { done = true; clearTimeout(watchdog); resolve('started'); } };
      u.onerror = (e) => { if (!done) { done = true; clearTimeout(watchdog); resolve(e.error === 'interrupted' || e.error === 'canceled' ? 'interrupted' : 'hung'); } };
      u.onend = () => { if (current === u) current = null; };
      window.setTimeout(() => {
        if (current !== u) { resolve('interrupted'); return; }
        watchdog = window.setTimeout(() => { if (!done) { done = true; try { s.cancel(); } catch { /* nada */ } resolve('hung'); } }, 4000);
        s.speak(u);
      }, wait);
    } catch { resolve('hung'); }
  });
}

/**
 * iOS Safari sólo permite hablar si la primera frase nace de un gesto: se llama desde el
 * botón «Empezar» con una frase vacía, y a partir de ahí las indicaciones programadas suenan.
 */
export function unlockSpeech(text = 'Empecemos.'): void {
  if (!canSpeak()) return;
  void speak(text);
}

export function hush(): void {
  current = null;
  seq++;
  if (canSpeak()) { try { window.speechSynthesis.cancel(); } catch { /* nada */ } }
}

/** Mantener la pantalla encendida durante la sesión (si el navegador lo permite). */
export async function keepAwake(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    const lock = await nav.wakeLock?.request('screen');
    return () => { void lock?.release(); };
  } catch { return () => {}; }
}
