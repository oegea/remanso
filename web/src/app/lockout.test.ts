import { beforeEach, describe, expect, it } from 'vitest';
import { clearFailures, fmtWait, lockedUntil, noteFailure, waitSeconds } from './lockout';

describe('freno a la fuerza bruta', () => {
  beforeEach(() => clearFailures());

  it('los tres primeros fallos no esperan; después dobla hasta cinco minutos', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(waitSeconds)).toEqual([0, 0, 10, 20, 40, 80, 160, 300, 300]);
  });

  it('anota los fallos y bloquea hasta que pasa la espera', () => {
    const t = 1_000_000;
    expect(noteFailure(t)).toBe(0);
    expect(noteFailure(t)).toBe(0);
    expect(lockedUntil(t)).toBe(0);
    expect(noteFailure(t)).toBe(t + 10_000);
    expect(lockedUntil(t + 5_000)).toBe(t + 10_000);
    expect(lockedUntil(t + 10_000)).toBe(0);
    expect(noteFailure(t + 10_000)).toBe(t + 30_000);
  });

  it('acertar limpia el contador', () => {
    const t = 1_000_000;
    noteFailure(t); noteFailure(t); noteFailure(t);
    clearFailures();
    expect(lockedUntil(t)).toBe(0);
    expect(noteFailure(t)).toBe(0);
  });

  it('formatea la espera', () => {
    expect(fmtWait(27_400)).toBe('28 s');
    expect(fmtWait(120_000)).toBe('2 min');
    expect(fmtWait(125_000)).toBe('2 min 5 s');
  });
});
