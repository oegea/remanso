/**
 * Señales de la sesión de meditación: gong sintetizado (parciales inarmónicos con cola
 * larga, como un cuenco metálico), vibración del móvil cuando el navegador lo permite y
 * pantalla encendida. La voz guía (frases pregrabadas) está en voice.ts. Nada de esto se usa
 * fuera de la sesión; nada suena sin un gesto previo de la persona.
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

/** Mantener la pantalla encendida durante la sesión (si el navegador lo permite). */
export async function keepAwake(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    const lock = await nav.wakeLock?.request('screen');
    return () => { void lock?.release(); };
  } catch { return () => {}; }
}
