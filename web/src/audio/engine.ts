/**
 * Motor de sonido: construye con Web Audio cada sonido del catálogo por capas (búferes de
 * ruido en bucle, filtros, osciladores lentos y ráfagas programadas), con un volumen
 * maestro y fundidos. Sale por un elemento <audio> alimentado por un MediaStream para que el
 * sistema muestre los controles (Media Session) y siga sonando con la pantalla apagada donde
 * el navegador lo permita; si eso falla, se conecta directamente a la salida.
 */
import { makeNoise, rng, type NoiseKind } from './synth';
import type { SoundId } from './catalog';

type Ctx = AudioContext;

interface Layer { stop(): void }

const LOOP_SECONDS = 12;

export class Engine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private out: MediaStreamAudioDestinationNode | null = null;
  private el: HTMLAudioElement | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private layers: Layer[] = [];
  private current: SoundId | null = null;
  private fallbackDirect = false;
  private analyser: AnalyserNode | null = null;

  /** Nivel actual (RMS y pico) a la salida, para comprobar que cada sonido suena y no satura. */
  level(): { rms: number; peak: number } {
    if (!this.analyser) return { rms: 0, peak: 0 };
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let s = 0, peak = 0;
    for (const v of buf) { s += v * v; peak = Math.max(peak, Math.abs(v)); }
    return { rms: Math.sqrt(s / buf.length), peak };
  }

  get sampleRate(): number { return this.ctx?.sampleRate ?? 48000; }

  private ensure(): Ctx {
    if (this.ctx) return this.ctx;
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC({ latencyHint: 'playback' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(this.analyser);
    try {
      this.out = ctx.createMediaStreamDestination();
      this.master.connect(this.out);
      const el = document.createElement('audio');
      el.srcObject = this.out.stream;
      el.setAttribute('aria-hidden', 'true');
      el.style.display = 'none';
      document.body.appendChild(el);
      this.el = el;
    } catch {
      this.master.connect(ctx.destination);
      this.fallbackDirect = true;
    }
    return ctx;
  }

  private noise(kind: NoiseKind, seed: number): AudioBuffer {
    const ctx = this.ensure();
    const key = `${kind}:${seed}:${ctx.sampleRate}`;
    let b = this.buffers.get(key);
    if (!b) {
      const n = Math.floor(LOOP_SECONDS * ctx.sampleRate);
      b = ctx.createBuffer(2, n, ctx.sampleRate);
      b.copyToChannel(makeNoise(kind, n, seed), 0);
      b.copyToChannel(makeNoise(kind, n, seed + 7919), 1);
      this.buffers.set(key, b);
    }
    return b;
  }

  /** Fuente en bucle de un búfer de ruido, con ganancia propia. */
  private loop(kind: NoiseKind, seed: number, gain: number, dest: AudioNode, shape?: (ctx: Ctx, src: AudioNode) => AudioNode): { gain: GainNode; stop(): void } {
    const ctx = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.noise(kind, seed);
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = gain;
    const tail = shape ? shape(ctx, src) : src;
    tail.connect(g).connect(dest);
    src.start();
    return { gain: g, stop: () => { try { src.stop(); } catch { /* ya parada */ } src.disconnect(); g.disconnect(); } };
  }

  /** Oscilador lento que mueve un parámetro alrededor de su valor: `param = base + depth·sin`. */
  private lfo(param: AudioParam, hz: number, depth: number): Layer {
    const ctx = this.ensure();
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    return { stop: () => { o.stop(); o.disconnect(); g.disconnect(); } };
  }

  /** Deriva aleatoria: cada pocos segundos el parámetro tiende a un nuevo valor al azar. */
  private wander(param: AudioParam, min: number, max: number, everyMs: [number, number], tau: number, seed: number): Layer {
    const ctx = this.ensure();
    const r = rng(seed);
    let t: number | null = null;
    const step = () => {
      param.setTargetAtTime(min + r() * (max - min), ctx.currentTime, tau);
      t = window.setTimeout(step, everyMs[0] + r() * (everyMs[1] - everyMs[0]));
    };
    step();
    return { stop: () => { if (t !== null) clearTimeout(t); } };
  }

  /**
   * Ráfagas cortas de ruido filtrado a intervalos aleatorios (gotas, crepitar): se programan
   * con antelación en pequeños bloques para que no dependan del hilo principal.
   */
  private bursts(dest: AudioNode, o: { kind: NoiseKind; everyMs: [number, number]; lenMs: [number, number]; gain: [number, number]; filter: { type: BiquadFilterType; freq: [number, number]; q: number }; seed: number; rateRange?: [number, number] }): Layer {
    const ctx = this.ensure();
    const r = rng(o.seed);
    const buf = this.noise(o.kind, o.seed + 1);
    let next = ctx.currentTime + 0.05;
    let timer: number | null = null;
    const schedule = () => {
      const horizon = ctx.currentTime + 0.35;
      while (next < horizon) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loopStart = r() * (LOOP_SECONDS - 1);
        src.loopEnd = src.loopStart + 1;
        src.loop = true;
        if (o.rateRange) src.playbackRate.value = o.rateRange[0] + r() * (o.rateRange[1] - o.rateRange[0]);
        const f = ctx.createBiquadFilter();
        f.type = o.filter.type;
        f.frequency.value = o.filter.freq[0] + r() * (o.filter.freq[1] - o.filter.freq[0]);
        f.Q.value = o.filter.q;
        const g = ctx.createGain();
        const len = (o.lenMs[0] + r() * (o.lenMs[1] - o.lenMs[0])) / 1000;
        const peak = o.gain[0] + r() * (o.gain[1] - o.gain[0]);
        g.gain.setValueAtTime(0.0001, next);
        g.gain.exponentialRampToValueAtTime(peak, next + Math.min(0.004, len / 3));
        g.gain.exponentialRampToValueAtTime(0.0001, next + len);
        const pan = ctx.createStereoPanner();
        pan.pan.value = r() * 1.6 - 0.8;
        src.connect(f).connect(g).connect(pan).connect(dest);
        src.start(next, src.loopStart);
        src.stop(next + len + 0.02);
        src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); pan.disconnect(); };
        next += (o.everyMs[0] + r() * (o.everyMs[1] - o.everyMs[0])) / 1000;
      }
      timer = window.setTimeout(schedule, 150);
    };
    schedule();
    return { stop: () => { if (timer !== null) clearTimeout(timer); } };
  }

  /** Truenos lejanos: ruido marrón muy grave con ataque lento y cola larga, de tarde en tarde. */
  private thunder(dest: AudioNode, seed: number): Layer {
    const ctx = this.ensure();
    const r = rng(seed);
    let timer: number | null = null;
    const one = () => {
      const t0 = ctx.currentTime + 0.1;
      const src = ctx.createBufferSource();
      src.buffer = this.noise('brown', seed + 3);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(90 + r() * 60, t0);
      f.frequency.exponentialRampToValueAtTime(45, t0 + 5);
      const g = ctx.createGain();
      const dur = 4 + r() * 5;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35 + r() * 0.25, t0 + 0.4 + r() * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(dest);
      src.start(t0, r() * 8);
      src.stop(t0 + dur + 0.1);
      src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
      timer = window.setTimeout(one, (18 + r() * 40) * 1000);
    };
    timer = window.setTimeout(one, (6 + r() * 12) * 1000);
    return { stop: () => { if (timer !== null) clearTimeout(timer); } };
  }

  private build(id: SoundId, dest: AudioNode): Layer[] {
    const L: Layer[] = [];
    const filt = (type: BiquadFilterType, freq: number, q = 0.7, gainDb = 0) => (c: Ctx, src: AudioNode) => {
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.gain.value = gainDb; src.connect(f); return f;
    };
    const chain = (...fs: ((c: Ctx, src: AudioNode) => AudioNode)[]) => (c: Ctx, src: AudioNode) => fs.reduce((n, f) => f(c, n), src);
    switch (id) {
      case 'white': L.push(this.loop('white', 11, 0.3, dest)); break;
      case 'pink': L.push(this.loop('pink', 12, 0.75, dest)); break;
      case 'brown': L.push(this.loop('brown', 13, 0.85, dest)); break;
      case 'grey':
        L.push(this.loop('pink', 14, 0.36, dest, chain(filt('lowshelf', 180, 0.7, 6), filt('peaking', 3200, 0.8, -5), filt('highshelf', 6500, 0.7, 7))));
        break;
      case 'rain_soft':
      case 'rain_heavy':
      case 'storm': {
        const heavy = id !== 'rain_soft';
        const bed = this.loop('pink', 21, heavy ? 0.9 : 0.7, dest, filt('lowpass', heavy ? 1400 : 900, 0.5));
        L.push(bed, this.lfo(bed.gain.gain, 0.06, heavy ? 0.14 : 0.12));
        const hiss = this.loop('white', 22, heavy ? 0.18 : 0.11, dest, filt('bandpass', 4800, 0.5));
        L.push(hiss, this.wander(hiss.gain.gain, heavy ? 0.1 : 0.06, heavy ? 0.25 : 0.16, [2500, 6000], 1.5, 23));
        L.push(this.bursts(dest, { kind: 'white', everyMs: heavy ? [12, 45] : [40, 140], lenMs: [12, 45], gain: heavy ? [0.09, 0.28] : [0.09, 0.26], filter: { type: 'bandpass', freq: [2600, 7500], q: 1.4 }, seed: 24, rateRange: [0.7, 1.5] }));
        if (id === 'storm') L.push(this.thunder(dest, 25));
        break;
      }
      case 'waves': {
        const body = this.loop('brown', 31, 0.5, dest, filt('lowpass', 700, 0.6));
        const foam = this.loop('white', 32, 0.0, dest, filt('highpass', 1800, 0.5));
        L.push(body, foam);
        // Cada ola: dos vaivenes de periodos distintos sumados, para que ninguna sea igual.
        L.push(this.lfo(body.gain.gain, 0.11, 0.3), this.lfo(body.gain.gain, 0.047, 0.15));
        L.push(this.lfo(foam.gain.gain, 0.11, 0.06), this.wander(foam.gain.gain, 0.02, 0.1, [3000, 7000], 2, 33));
        break;
      }
      case 'wind': {
        const w = this.loop('pink', 41, 1.4, dest, filt('bandpass', 500, 1.1));
        L.push(w, this.wander(w.gain.gain, 0.6, 2.0, [1500, 4000], 1.8, 42));
        const tone = this.loop('pink', 43, 0.4, dest, filt('bandpass', 900, 3));
        L.push(tone, this.wander(tone.gain.gain, 0.08, 0.6, [900, 3000], 1.2, 44));
        break;
      }
      case 'stream': {
        const a = this.loop('white', 51, 0.7, dest, filt('bandpass', 1900, 0.9));
        const b = this.loop('white', 52, 0.6, dest, filt('bandpass', 650, 1.2));
        L.push(a, b, this.lfo(a.gain.gain, 2.7, 0.12), this.lfo(b.gain.gain, 1.9, 0.12), this.wander(b.gain.gain, 0.4, 0.85, [1200, 2600], 0.8, 53));
        L.push(this.bursts(dest, { kind: 'white', everyMs: [60, 220], lenMs: [20, 70], gain: [0.06, 0.2], filter: { type: 'bandpass', freq: [1200, 3200], q: 2 }, seed: 54 }));
        break;
      }
      case 'fire': {
        const rumble = this.loop('brown', 61, 0.8, dest, filt('lowpass', 380, 0.6));
        const hiss = this.loop('pink', 62, 0.1, dest, filt('bandpass', 2600, 0.8));
        L.push(rumble, hiss, this.wander(rumble.gain.gain, 0.6, 1.0, [2000, 5000], 1.5, 63));
        L.push(this.bursts(dest, { kind: 'white', everyMs: [70, 420], lenMs: [5, 28], gain: [0.12, 0.45], filter: { type: 'highpass', freq: [1500, 3500], q: 0.9 }, seed: 64, rateRange: [0.8, 1.6] }));
        break;
      }
    }
    return L;
  }

  async play(id: SoundId, volume: number): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state !== 'running') await ctx.resume();
    if (this.el && !this.fallbackDirect && this.el.paused) {
      try { await this.el.play(); } catch {
        this.master!.disconnect();
        this.master!.connect(ctx.destination);
        this.fallbackDirect = true;
      }
    }
    this.teardown();
    this.layers = this.build(id, this.master!);
    this.current = id;
    const g = this.master!.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(0.0001, ctx.currentTime);
    g.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + 1.2);
  }

  setVolume(volume: number): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0.0001, volume), this.ctx.currentTime, 0.05);
  }

  async pause(): Promise<void> {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0.0001, t, 0.15);
    await new Promise((r) => setTimeout(r, 500));
    await this.ctx.suspend();
  }

  async resume(volume: number): Promise<void> {
    if (!this.ctx || !this.master) return;
    await this.ctx.resume();
    if (this.el && !this.fallbackDirect && this.el.paused) { try { await this.el.play(); } catch { /* ya conectado o sin permiso */ } }
    this.master.gain.setTargetAtTime(Math.max(0.0001, volume), this.ctx.currentTime, 0.3);
  }

  /** Fundido largo antes de parar (temporizador): `seconds` de bajada. */
  fadeOut(seconds: number): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, seconds / 4);
  }

  async stop(): Promise<void> {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.12);
    await new Promise((r) => setTimeout(r, 450));
    this.teardown();
    this.current = null;
    await this.ctx.suspend();
    if (this.el) this.el.pause();
  }

  private teardown(): void {
    for (const l of this.layers) l.stop();
    this.layers = [];
  }

  get playing(): SoundId | null { return this.current; }
}

export const engine = new Engine();
if (import.meta.env.DEV) (window as unknown as { __remansoAudio: Engine }).__remansoAudio = engine;
