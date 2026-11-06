import { describe, it, expect } from 'vitest';
import { SOUNDS, USES, FAMILIES, nextId, sound, fmtRemaining } from './catalog';

describe('catálogo de sonidos', () => {
  it('cada sonido tiene nombre, descripción, familia conocida y al menos un uso', () => {
    for (const s of SOUNDS) {
      expect(s.name.length).toBeGreaterThan(2);
      expect(s.desc.length).toBeGreaterThan(10);
      expect(FAMILIES.map((f) => f.key)).toContain(s.family);
      expect(s.uses.length).toBeGreaterThan(0);
    }
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(SOUNDS.length);
  });
  it('cada uso ofrece varios sonidos', () => {
    for (const u of USES) expect(SOUNDS.filter((s) => s.uses.includes(u.key)).length).toBeGreaterThanOrEqual(3);
  });
  it('nextId recorre la lista en bucle, respetando el uso elegido', () => {
    expect(nextId(SOUNDS[0].id)).toBe(SOUNDS[1].id);
    expect(nextId(SOUNDS[SOUNDS.length - 1].id)).toBe(SOUNDS[0].id);
    const sleep = SOUNDS.filter((s) => s.uses.includes('sleep'));
    expect(nextId(sleep[0].id, 'sleep')).toBe(sleep[1].id);
    expect(sound(nextId('grey', 'sleep')).uses).toContain('sleep');
  });
  it('fmtRemaining redondea hacia arriba y usa horas cuando toca', () => {
    expect(fmtRemaining(90_000)).toBe('2 min');
    expect(fmtRemaining(20_000)).toBe('1 min');
    expect(fmtRemaining(0)).toBe('menos de un minuto');
    expect(fmtRemaining(3_600_000)).toBe('1 h');
    expect(fmtRemaining(65 * 60_000)).toBe('1 h 05 min');
  });
});
