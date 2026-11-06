/**
 * Estado del reproductor, fuera de React: qué suena, si está en pausa, volumen y
 * temporizador de apagado. Nada suena sin un gesto de la persona; el volumen y el último
 * uso elegido se recuerdan en este dispositivo (localStorage, sin datos sensibles).
 */
import { useSyncExternalStore } from 'react';
import { engine } from './engine';
import { nextId, sound, type SoundId, type Use } from './catalog';

export interface PlayerState {
  soundId: SoundId | null;
  status: 'playing' | 'paused';
  volume: number;
  /** Minutos elegidos para el apagado (0 = sin apagado). */
  timerMinutes: number;
  /** Momento (ms de reloj) en que se apagará, si hay temporizador en marcha. */
  endsAt: number | null;
  /** Tiempo sonando antes de la última pausa (ms) y momento de la última reanudación. */
  elapsedBefore: number;
  playingSince: number | null;
  use: Use | null;
}

const KEY_VOL = 'remanso.sonidos.volumen';
const KEY_USE = 'remanso.sonidos.uso';

function read<T>(key: string, fallback: T, parse: (s: string) => T): T {
  try { const v = localStorage.getItem(key); return v === null ? fallback : parse(v); } catch { return fallback; }
}
function write(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ } }

let state: PlayerState = {
  soundId: null,
  status: 'paused',
  volume: read(KEY_VOL, 0.6, (s) => Math.min(1, Math.max(0, Number(s) || 0.6))),
  timerMinutes: 0,
  endsAt: null,
  elapsedBefore: 0,
  playingSince: null,
  use: read<Use | null>(KEY_USE, null, (s) => (['write', 'calm', 'sleep'].includes(s) ? (s as Use) : null)),
};
const listeners = new Set<() => void>();
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

function set(patch: Partial<PlayerState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
  mediaSession();
}

function mediaSession(): void {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  if (!state.soundId) { ms.metadata = null; ms.playbackState = 'none'; return; }
  const s = sound(state.soundId);
  try { ms.metadata = new MediaMetadata({ title: s.name, artist: 'Remanso', album: 'Sonidos' }); } catch { /* sin soporte */ }
  ms.playbackState = state.status === 'playing' ? 'playing' : 'paused';
}

let handlersSet = false;
function ensureHandlers(): void {
  if (handlersSet || !('mediaSession' in navigator)) return;
  handlersSet = true;
  const ms = navigator.mediaSession;
  const safe = (k: MediaSessionAction, f: () => void) => { try { ms.setActionHandler(k, f); } catch { /* acción no soportada */ } };
  safe('play', () => void player.resume());
  safe('pause', () => void player.pause());
  safe('stop', () => void player.stop());
  safe('nexttrack', () => void player.next());
}

function clearTimers(): void {
  if (fadeTimer !== null) { clearTimeout(fadeTimer); fadeTimer = null; }
  if (stopTimer !== null) { clearTimeout(stopTimer); stopTimer = null; }
}

const FADE_SECONDS = 25;

function armTimer(): void {
  clearTimers();
  if (state.timerMinutes <= 0 || state.status !== 'playing') { set({ endsAt: null }); return; }
  const endsAt = Date.now() + state.timerMinutes * 60_000;
  set({ endsAt });
  fadeTimer = setTimeout(() => engine.fadeOut(FADE_SECONDS), Math.max(0, state.timerMinutes * 60_000 - FADE_SECONDS * 1000));
  stopTimer = setTimeout(() => void player.stop(), state.timerMinutes * 60_000);
}

/** Milisegundos que lleva sonando el sonido actual (contando pausas como tiempo parado). */
export function elapsed(): number {
  return state.elapsedBefore + (state.playingSince ? Date.now() - state.playingSince : 0);
}

/** «12:34» o «1:02:03». */
export function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export const player = {
  async play(id: SoundId): Promise<void> {
    ensureHandlers();
    await engine.play(id, state.volume);
    set({ soundId: id, status: 'playing', elapsedBefore: 0, playingSince: Date.now() });
    armTimer();
  },
  async pause(): Promise<void> {
    if (!state.soundId || state.status !== 'playing') return;
    set({ status: 'paused', elapsedBefore: elapsed(), playingSince: null });
    clearTimers();
    set({ endsAt: null });
    await engine.pause();
  },
  async resume(): Promise<void> {
    if (!state.soundId || state.status === 'playing') return;
    await engine.resume(state.volume);
    set({ status: 'playing', playingSince: Date.now() });
    armTimer();
  },
  async toggle(): Promise<void> { return state.status === 'playing' ? player.pause() : player.resume(); },
  async stop(): Promise<void> {
    clearTimers();
    set({ soundId: null, status: 'paused', endsAt: null, elapsedBefore: 0, playingSince: null });
    await engine.stop();
  },
  async next(): Promise<void> {
    if (!state.soundId) return;
    await player.play(nextId(state.soundId, state.use));
  },
  setVolume(v: number): void {
    const volume = Math.min(1, Math.max(0, v));
    set({ volume });
    write(KEY_VOL, String(volume));
    engine.setVolume(volume);
  },
  setTimer(minutes: number): void {
    set({ timerMinutes: minutes });
    armTimer();
  },
  setUse(use: Use | null): void {
    set({ use });
    write(KEY_USE, use ?? '');
  },
  get state(): PlayerState { return state; },
};

export function usePlayer(): PlayerState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => state);
}
