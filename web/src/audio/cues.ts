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

function spanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  // Preferir voces locales de España; si no, cualquier español.
  return es.find((v) => v.lang.toLowerCase() === 'es-es' && v.localService) ?? es.find((v) => v.localService) ?? es[0] ?? null;
}

// Chrome deja de hablar si la frase se recoge en el recolector de basura, y a veces se traga
// una frase dicha justo después de `cancel()`: guardamos la referencia y esperamos un poco.
let current: SpeechSynthesisUtterance | null = null;

/** Dice un texto corto con voz pausada y algo más baja. Cancela lo que estuviera diciendo. */
export function speak(text: string, volume = 0.9): void {
  if (!canSpeak()) return;
  try {
    const s = window.speechSynthesis;
    const wasSpeaking = s.speaking || s.pending;
    if (wasSpeaking) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 0.85;
    u.pitch = 0.95;
    u.volume = volume;
    const v = spanishVoice();
    if (v) u.voice = v;
    current = u;
    u.onend = () => { if (current === u) current = null; };
    window.setTimeout(() => { if (current === u) s.speak(u); }, wasSpeaking ? 120 : 0);
  } catch { /* sin voz */ }
}

/** Nombre de la voz que se usará, para mostrarlo; null si no hay voz en español. */
export function voiceName(): string | null {
  if (!canSpeak()) return null;
  const v = spanishVoice();
  return v ? v.name : null;
}

export function hush(): void {
  current = null;
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
