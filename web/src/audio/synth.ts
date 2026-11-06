/**
 * Generadores puros de ruido (sin AudioContext), para poder probarlos y para rellenar
 * búferes que luego suenan en bucle. Todo con un PRNG con semilla: el mismo sonido es
 * igual en cada sesión y cada canal estéreo lleva una semilla distinta (anchura).
 */

export type NoiseKind = 'white' | 'pink' | 'brown';

/** mulberry32: pequeño, determinista, suficiente para ruido de audio. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ruido rosa por el filtro de Paul Kellet (versión «refinada»): −3 dB/octava con un
 * error < 0,5 dB entre 20 Hz y 20 kHz. Ruido marrón por integración con fuga (−6 dB/oct).
 * La salida se normaliza a un pico de `peak`.
 */
export function makeNoise(kind: NoiseKind, length: number, seed: number, peak = 0.5): Float32Array<ArrayBuffer> {
  const out = new Float32Array(new ArrayBuffer(length * 4));
  const r = rng(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
  for (let i = 0; i < length; i++) {
    const w = r() * 2 - 1;
    if (kind === 'white') out[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      brown = (brown + 0.02 * w) / 1.02;
      out[i] = brown * 3.5;
    }
  }
  let max = 1e-9;
  for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(out[i]));
  const k = peak / max;
  for (let i = 0; i < length; i++) out[i] *= k;
  return out;
}

/** Energía media (RMS) de un búfer; sirve a las pruebas y al ajuste de niveles. */
export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, buf.length));
}

/**
 * Reparto de energía entre la mitad baja y la mitad alta del espectro, estimado con una
 * diferencia de primer orden (realza agudos): sirve para comprobar en pruebas que el rosa
 * tiene menos agudos que el blanco y el marrón menos que el rosa.
 */
export function highBandRatio(buf: Float32Array): number {
  let hi = 0, all = 0;
  for (let i = 1; i < buf.length; i++) {
    const d = buf[i] - buf[i - 1];
    hi += d * d;
    all += buf[i] * buf[i];
  }
  return all === 0 ? 0 : hi / all;
}
