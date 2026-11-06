/**
 * Estado del reproductor, fuera de React: qué suena, si está en pausa, volumen y
 * temporizador de apagado. Nada suena sin un gesto de la persona; el volumen y el último
 * uso elegido se recuerdan en este dispositivo (localStorage, sin datos sensibles).
 */
import { useSyncExternalStore } from 'react';
import { engine } from './engine';
import { nextId, sound, type SoundId, type Use } from './catalog';
import { nextTrackId, playableUrl, track, type Track } from './tracks';

export interface PlayerState {
  /** Ambiente sintetizado en marcha, o null. */
  soundId: SoundId | null;
  /** Pista musical en marcha, o null (nunca a la vez que un ambiente). */
  trackId: string | null;
  /** Bucle de la pista actual. */
  loop: boolean;
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

const KEY_LOOP = 'remanso.sonidos.bucle';

let state: PlayerState = {
  soundId: null,
  trackId: null,
  loop: read(KEY_LOOP, false, (s) => s === '1'),
  status: 'paused',
  volume: read(KEY_VOL, 0.6, (s) => Math.min(1, Math.max(0, Number(s) || 0.6))),
  timerMinutes: 0,
  endsAt: null,
  elapsedBefore: 0,
  playingSince: null,
  use: read<Use | null>(KEY_USE, null, (s) => (['write', 'calm', 'sleep', 'meditate'].includes(s) ? (s as Use) : null)),
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
  const t = state.trackId ? track(state.trackId) : null;
  if (!state.soundId && !t) { ms.metadata = null; ms.playbackState = 'none'; return; }
  const title = t ? t.title : sound(state.soundId!).name;
  try { ms.metadata = new MediaMetadata({ title, artist: t ? 'Oriol Egea · Remanso' : 'Remanso', album: t ? 'Música' : 'Sonidos' }); } catch { /* sin soporte */ }
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
  fadeTimer = setTimeout(() => (state.trackId ? engine.fadeOutTrack(FADE_SECONDS) : engine.fadeOut(FADE_SECONDS)), Math.max(0, state.timerMinutes * 60_000 - FADE_SECONDS * 1000));
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

engine.onTrackEnded = () => { void player.next(); };

export const player = {
  async play(id: SoundId): Promise<void> {
    ensureHandlers();
    await engine.play(id, state.volume);
    set({ soundId: id, trackId: null, status: 'playing', elapsedBefore: 0, playingSince: Date.now() });
    armTimer();
  },
  /** Reproduce una pista musical (desde la caché si está guardada). */
  async playTrack(t: Track): Promise<void> {
    ensureHandlers();
    if (state.soundId) await engine.stop();
    await engine.playTrack(await playableUrl(t), state.volume, state.loop);
    set({ trackId: t.id, soundId: null, status: 'playing', elapsedBefore: 0, playingSince: Date.now() });
    armTimer();
  },
  async pause(): Promise<void> {
    if ((!state.soundId && !state.trackId) || state.status !== 'playing') return;
    set({ status: 'paused', elapsedBefore: elapsed(), playingSince: null });
    clearTimers();
    set({ endsAt: null });
    if (state.trackId) await engine.pauseTrack(); else await engine.pause();
  },
  async resume(): Promise<void> {
    if ((!state.soundId && !state.trackId) || state.status === 'playing') return;
    if (state.trackId) await engine.resumeTrack(state.volume); else await engine.resume(state.volume);
    set({ status: 'playing', playingSince: Date.now() });
    armTimer();
  },
  async toggle(): Promise<void> { return state.status === 'playing' ? player.pause() : player.resume(); },
  async stop(): Promise<void> {
    clearTimers();
    const wasTrack = !!state.trackId;
    set({ soundId: null, trackId: null, status: 'paused', endsAt: null, elapsedBefore: 0, playingSince: null });
    if (wasTrack) await engine.stopTrack(); else await engine.stop();
  },
  async next(): Promise<void> {
    if (state.trackId) {
      const n = nextTrackId(state.trackId, state.use);
      const t = n ? track(n) : undefined;
      if (t) await player.playTrack(t); else await player.stop();
      return;
    }
    if (!state.soundId) return;
    await player.play(nextId(state.soundId, state.use));
  },
  setLoop(loop: boolean): void {
    set({ loop });
    write(KEY_LOOP, loop ? '1' : '0');
    engine.setTrackLoop(loop);
  },
  /** Posición y duración de la pista en curso (0 si es un ambiente). */
  position(): { position: number; duration: number } {
    return state.trackId ? engine.trackPosition() : { position: 0, duration: 0 };
  },
  setVolume(v: number): void {
    const volume = Math.min(1, Math.max(0, v));
    set({ volume });
    write(KEY_VOL, String(volume));
    engine.setVolume(volume);
    engine.setTrackVolume(volume);
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
