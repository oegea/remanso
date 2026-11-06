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

const LOOP_SECONDS = 24;

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

  /** Un búfer largo por tipo de ruido (24 s, estéreo); cada fuente arranca en un punto distinto. */
  private noise(kind: NoiseKind, _seed = 0): AudioBuffer {
    const ctx = this.ensure();
    const key = `${kind}:${ctx.sampleRate}`;
    let b = this.buffers.get(key);
    if (!b) {
      const n = Math.floor(LOOP_SECONDS * ctx.sampleRate);
      b = ctx.createBuffer(2, n, ctx.sampleRate);
      const base = kind === 'white' ? 101 : kind === 'pink' ? 202 : 303;
      b.copyToChannel(makeNoise(kind, n, base), 0);
      b.copyToChannel(makeNoise(kind, n, base + 7919), 1);
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
    src.start(0, rng(seed)() * (LOOP_SECONDS - 1));
    return { gain: g, stop: () => { try { src.stop(); } catch { /* ya parada */ } src.disconnect(); g.disconnect(); } };
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

  /**
   * Burbujeo: tonos cortos con subida de tono (la burbuja que se cierra), densos y a bajo
   * volumen, repartidos en estéreo. Es lo que distingue un arroyo de un simple siseo.
   */
  private blips(dest: AudioNode, o: { everyMs: [number, number]; freq: [number, number]; lenMs: [number, number]; gain: [number, number]; rise: number; seed: number }): Layer {
    const ctx = this.ensure();
    const r = rng(o.seed);
    let next = ctx.currentTime + 0.05;
    let timer: number | null = null;
    const schedule = () => {
      const horizon = ctx.currentTime + 0.35;
      while (next < horizon) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const f0 = o.freq[0] + r() * (o.freq[1] - o.freq[0]);
        const len = (o.lenMs[0] + r() * (o.lenMs[1] - o.lenMs[0])) / 1000;
        osc.frequency.setValueAtTime(f0, next);
        osc.frequency.exponentialRampToValueAtTime(f0 * o.rise, next + len);
        const g = ctx.createGain();
        const peak = o.gain[0] + r() * (o.gain[1] - o.gain[0]);
        g.gain.setValueAtTime(0.0001, next);
        g.gain.exponentialRampToValueAtTime(peak, next + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, next + len);
        const pan = ctx.createStereoPanner();
        pan.pan.value = r() * 1.6 - 0.8;
        osc.connect(g).connect(pan).connect(dest);
        osc.start(next);
        osc.stop(next + len + 0.01);
        osc.onended = () => { osc.disconnect(); g.disconnect(); pan.disconnect(); };
        next += (o.everyMs[0] + r() * (o.everyMs[1] - o.everyMs[0])) / 1000;
      }
      timer = window.setTimeout(schedule, 150);
    };
    schedule();
    return { stop: () => { if (timer !== null) clearTimeout(timer); } };
  }

  /** Envolvente en campana suave: sube con sen² durante `rise` y baja con cos² durante `fall`. */
  private static bell(peak: number, rise: number, fall: number, floor = 0.0001, shape = 1): { curve: Float32Array<ArrayBuffer>; duration: number } {
    const n = 96;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    const total = rise + fall;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * total;
      const x = t < rise ? Math.sin((t / rise) * Math.PI / 2) ** 2 : Math.cos(((t - rise) / fall) * Math.PI / 2) ** 2;
      // `shape` < 1 redondea la campana (más tiempo arriba); > 1 la afila.
      curve[i] = floor + (peak - floor) * x ** shape;
    }
    return { curve, duration: total };
  }

  /**
   * Olas tranquilas, cada 9–16 s y solapadas: un «shhh» que crece despacio (ruido rosa que se
   * abre en brillo), llega arriba sin golpe y se retira largo mientras se cierra; una capa de
   * espuma suave que entra justo después de la cresta; un leve desplazamiento en el estéreo.
   * Sin ráfagas ni rampas bruscas. Debajo, el mar lejano. Es la versión que mejor resultado
   * dio de las probadas; para un mar más creíble, la fase 2 contempla grabaciones CC0.
   */
  private waves(dest: AudioNode, seed: number): Layer {
    const ctx = this.ensure();
    const r = rng(seed);
    let timer: number | null = null;
    const one = () => {
      const t0 = ctx.currentTime + 0.05;
      // Mucha variedad, para que no se aprenda el patrón: más olas pequeñas que grandes,
      // subidas y retiradas de duración muy distinta, curvas de forma distinta.
      const size = 0.35 + Math.pow(r(), 1.4) * 0.75;
      const rise = 1.5 + r() * 3.5;
      const fall = 2.5 + r() * 6.5;
      const shape = 0.7 + r() * 0.9;
      const pan = ctx.createStereoPanner();
      const side = (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.3);
      pan.pan.setValueAtTime(side, t0); pan.pan.linearRampToValueAtTime(-side * 0.4, t0 + rise + fall);
      pan.connect(dest);
      const body = ctx.createBufferSource(); body.buffer = this.noise('pink'); body.loop = true;
      const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.Q.value = 0.3;
      const fb = Engine.bell(800 + 1700 * size, rise, fall, 180, shape);
      bf.frequency.setValueCurveAtTime(fb.curve, t0, fb.duration);
      const bg = ctx.createGain();
      const gb = Engine.bell(0.85 * size, rise, fall, 0.0001, shape);
      bg.gain.setValueCurveAtTime(gb.curve, t0, gb.duration);
      body.connect(bf).connect(bg).connect(pan);
      body.start(t0, r() * (LOOP_SECONDS - 1)); body.stop(t0 + gb.duration + 0.05);
      const withFoam = size > 0.6 || r() < 0.4;
      const foam = ctx.createBufferSource(); foam.buffer = this.noise('white'); foam.loop = true;
      const ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 1800; ff.Q.value = 0.35;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.3;
      const tf = t0 + rise * 0.8;
      const ffb = Engine.bell(3200, rise * 0.4, fall * 0.9, 600);
      fl.frequency.setValueCurveAtTime(ffb.curve, tf, ffb.duration);
      const fg = ctx.createGain();
      const gf = Engine.bell(withFoam ? (0.12 + 0.18 * size) : 0.0001, rise * 0.4, fall * 0.9);
      fg.gain.setValueCurveAtTime(gf.curve, tf, gf.duration);
      foam.connect(ff).connect(fl).connect(fg).connect(pan);
      foam.start(tf, r() * (LOOP_SECONDS - 1)); foam.stop(tf + gf.duration + 0.05);
      foam.onended = () => { [body, bf, bg, foam, ff, fl, fg, pan].forEach((n) => n.disconnect()); };
      // A veces una ola sigue a otra casi de inmediato; otras veces el mar descansa.
      const gap = r() < 0.25 ? 3 + r() * 2.5 : 5 + r() * 11;
      timer = window.setTimeout(one, gap * 1000);
    };
    one();
    return { stop: () => { if (timer !== null) clearTimeout(timer); } };
  }

  /**
   * Viento: rachas (una ganancia que sube y baja despacio, al azar) sobre un fondo ancho;
   * dos silbidos resonantes cuya frecuencia deriva y que sólo se oyen cuando la racha
   * aprieta; hojas que crujen en las rachas; y un rumor grave.
   */
  private wind(dest: AudioNode, seed: number): Layer[] {
    const ctx = this.ensure();
    const L: Layer[] = [];
    const gust = ctx.createGain(); gust.gain.value = 0.4; gust.connect(dest);
    L.push(this.wander(gust.gain, 0.15, 1.0, [2500, 7000], 2.4, seed));
    const body = this.loop('pink', seed + 1, 1.2, gust, filt('bandpass', 420, 0.8));
    L.push(body, this.wander((body.gain as GainNode).gain, 0.8, 1.5, [1500, 4000], 1.2, seed + 2));
    // Silbidos: resonadores estrechos con frecuencia que deriva; más fuertes al apretar la racha.
    const howl = ctx.createGain(); howl.gain.value = 0; howl.connect(gust);
    L.push(this.wander(howl.gain, 0.0, 0.22, [5000, 12000], 3.5, seed + 3));
    const w = this.loop('pink', seed + 10, 1.0, howl, (c, src) => { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.8; f.frequency.value = 200; src.connect(f); L.push(this.wander(f.frequency, 140, 320, [6000, 12000], 5, seed + 20)); return f; });
    L.push(w);
    // Hojas: crujidos agudos en las rachas.
    L.push(this.bursts(gust, { kind: 'white', everyMs: [40, 160], lenMs: [15, 60], gain: [0.02, 0.09], filter: { type: 'bandpass', freq: [2500, 6000], q: 1.0 }, seed: seed + 30, rateRange: [0.8, 1.4] }));
    // Rumor grave constante.
    const low = this.loop('brown', seed + 4, 0.35, dest, filt('lowpass', 140, 0.6));
    L.push(low, this.wander((low.gain as GainNode).gain, 0.2, 0.45, [3000, 7000], 2, seed + 5));
    return L;

    function filt(type: BiquadFilterType, freq: number, q: number) {
      return (c: Ctx, src: AudioNode) => { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; src.connect(f); return f; };
    }
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
        const bed = this.loop('pink', 21, heavy ? 0.78 : 0.6, dest, filt('lowpass', heavy ? 1400 : 900, 0.5));
        L.push(bed, this.wander(bed.gain.gain, heavy ? 0.6 : 0.45, heavy ? 0.95 : 0.75, [4000, 9000], 3, 26));
        const hiss = this.loop('white', 22, heavy ? 0.14 : 0.1, dest, filt('bandpass', 3600, 0.3));
        L.push(hiss, this.wander(hiss.gain.gain, heavy ? 0.14 : 0.08, heavy ? 0.3 : 0.2, [2500, 6000], 1.5, 23));
        L.push(this.bursts(dest, { kind: 'white', everyMs: heavy ? [9, 34] : [28, 105], lenMs: [12, 45], gain: heavy ? [0.18, 0.52] : [0.18, 0.5], filter: { type: 'bandpass', freq: [2600, 7500], q: 1.4 }, seed: 24, rateRange: [0.7, 1.5] }));
        if (id === 'storm') L.push(this.thunder(dest, 25));
        break;
      }
      case 'waves': {
        // Mar de fondo: grave que respira despacio, rumor medio lejano y, siempre, un siseo
        // sutil de agua (el mar no calla entre ola y ola) con un brillo muy leve.
        const bed = this.loop('brown', 31, 0.32, dest, filt('lowpass', 320, 0.6));
        const far = this.loop('pink', 34, 0.12, dest, filt('lowpass', 900, 0.4));
        const water = this.loop('white', 36, 0.09, dest, filt('bandpass', 1700, 0.45));
        const glint = this.loop('white', 37, 0.025, dest, filt('bandpass', 4200, 0.8));
        L.push(bed, far, water, glint);
        L.push(this.wander(bed.gain.gain, 0.26, 0.48, [3000, 7000], 2.5, 32), this.wander(far.gain.gain, 0.08, 0.18, [4000, 9000], 3, 35));
        L.push(this.wander(water.gain.gain, 0.06, 0.13, [1500, 4000], 1.2, 38), this.wander(glint.gain.gain, 0.012, 0.035, [800, 2500], 0.7, 39));
        L.push(this.waves(dest, 33));
        break;
      }
      case 'wind': L.push(...this.wind(dest, 41)); break;
      case 'stream': {
        // Agua que corre: turbulencia en dos bandas con varios vaivenes rápidos y distintos,
        // un fondo grave y, encima, el burbujeo (tonos cortos que suben) y gorgoteos resonantes.
        const low = this.loop('pink', 51, 0.55, dest, filt('bandpass', 380, 0.8));
        const mid = this.loop('white', 52, 0.5, dest, filt('bandpass', 1700, 0.9));
        const high = this.loop('white', 53, 0.04, dest, filt('bandpass', 6000, 0.5));
        L.push(low, mid, high);
        L.push(this.wander(mid.gain.gain, 0.32, 0.65, [250, 700], 0.18, 58), this.wander(mid.gain.gain, 0.4, 0.6, [1500, 4000], 1.1, 59));
        L.push(this.wander(low.gain.gain, 0.4, 0.65, [1200, 3000], 0.9, 54), this.wander(high.gain.gain, 0.02, 0.06, [800, 2000], 0.6, 55));
        L.push(this.blips(dest, { everyMs: [35, 110], freq: [350, 1400], lenMs: [25, 70], gain: [0.07, 0.18], rise: 1.6, seed: 56 }));
        L.push(this.bursts(dest, { kind: 'white', everyMs: [120, 420], lenMs: [50, 160], gain: [0.15, 0.4], filter: { type: 'bandpass', freq: [300, 900], q: 7 }, seed: 57 }));
        break;
      }
      case 'fire': {
        const rumble = this.loop('brown', 61, 0.65, dest, filt('lowpass', 380, 0.6));
        const hiss = this.loop('pink', 62, 0.14, dest, filt('bandpass', 2600, 0.8));
        L.push(rumble, hiss, this.wander(rumble.gain.gain, 0.5, 0.85, [2000, 5000], 1.5, 63));
        L.push(this.bursts(dest, { kind: 'white', everyMs: [70, 420], lenMs: [5, 28], gain: [0.22, 0.7], filter: { type: 'highpass', freq: [1500, 3500], q: 0.9 }, seed: 64, rateRange: [0.8, 1.6] }));
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
