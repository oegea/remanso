/**
 * Sólo para pruebas: un `<audio>` de mentira que «suena» lo que dura cada frase de la voz
 * (voice-durations.json, por un factor) con los temporizadores simulados de vitest, y apunta
 * qué sonó, cuándo, y si algo lo cortó. Así las pruebas ejercitan la cola real de voice.ts.
 */
import DUR from './voice-durations.json';

export interface Spoken { id: string; start: number; end: number | null; cut: boolean }

/** Lo que ha sonado, en orden. */
export const spoken: Spoken[] = [];
let factor = 1;

/** Vacía el registro. `f` alarga o acorta todos los audios (una voz más lenta, una toma distinta). */
export function resetFakeAudio(f = 1): void { spoken.length = 0; factor = f; }

export class FakeAudio {
  volume = 1;
  preload = '';
  paused = true;
  ended = false;
  private url = '';
  private current: Spoken | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners: Record<string, (() => void)[]> = {};

  get src(): string { return this.url; }
  set src(v: string) { this.halt(); this.url = v; }
  addEventListener(type: string, fn: () => void): void { (this.listeners[type] ??= []).push(fn); }
  getAttribute(name: string): string | null { return name === 'src' && this.url ? this.url : null; }
  removeAttribute(name: string): void { if (name === 'src') { this.halt(); this.url = ''; } }
  load(): void { /* nada */ }
  pause(): void { this.halt(); }
  play(): Promise<void> {
    const id = this.url.split('/').pop()!.replace(/\.mp3.*$/, '');
    const line: Spoken = { id, start: Date.now() / 1000, end: null, cut: false };
    spoken.push(line);
    this.current = line; this.paused = false; this.ended = false;
    this.timer = setTimeout(() => {
      line.end = Date.now() / 1000;
      this.current = null; this.paused = true; this.ended = true;
      this.listeners.ended?.forEach((f) => f());
    }, (DUR as Record<string, number>)[id] * factor * 1000);
    return Promise.resolve();
  }

  /** Lo que sonaba deja de sonar antes de acabar: queda apuntado como cortado. */
  private halt(): void {
    if (!this.current) return;
    clearTimeout(this.timer);
    this.current.cut = true; this.current.end = Date.now() / 1000;
    this.current = null; this.paused = true;
  }
}

/** Pone el `<audio>` de mentira como `Audio` global (voice.ts lo crea la primera vez que suena algo). */
export function installFakeAudio(): void { Object.assign(globalThis, { Audio: FakeAudio }); }
