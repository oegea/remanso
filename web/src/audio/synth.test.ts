import { describe, it, expect } from 'vitest';
import { makeNoise, rms, highBandRatio, rng } from './synth';

describe('generadores de ruido', () => {
  it('son deterministas con la misma semilla y distintos con otra', () => {
    const a = makeNoise('white', 2000, 1), b = makeNoise('white', 2000, 1), c = makeNoise('white', 2000, 2);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });
  it('normalizan al pico pedido y no contienen valores no finitos', () => {
    for (const kind of ['white', 'pink', 'brown'] as const) {
      const buf = makeNoise(kind, 48000, 5, 0.5);
      let max = 0;
      for (const v of buf) { expect(Number.isFinite(v)).toBe(true); max = Math.max(max, Math.abs(v)); }
      expect(max).toBeCloseTo(0.5, 5);
      expect(rms(buf)).toBeGreaterThan(0.01);
    }
  });
  it('el rosa tiene menos agudos que el blanco y el marrón menos que el rosa', () => {
    const w = highBandRatio(makeNoise('white', 96000, 3));
    const p = highBandRatio(makeNoise('pink', 96000, 3));
    const b = highBandRatio(makeNoise('brown', 96000, 3));
    expect(w).toBeGreaterThan(p);
    expect(p).toBeGreaterThan(b);
  });
  it('el ruido blanco no tiene componente continua apreciable', () => {
    const buf = makeNoise('white', 96000, 9);
    let s = 0; for (const v of buf) s += v;
    expect(Math.abs(s / buf.length)).toBeLessThan(0.01);
  });
  it('rng devuelve valores en [0, 1)', () => {
    const r = rng(42);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});
