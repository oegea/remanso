import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import * as sup from './support';

describe('invitación a apoyar', () => {
  it('sin enlace configurado nunca se muestra', async () => {
    const db = await Database.create(() => {});
    expect(sup.shouldShow(db, 1000)).toBe(false);
  });

  it('aparece a los dos días, se aplaza una semana y «no volver a mostrar» es definitivo', async () => {
    const db = await Database.create(() => {});
    const t0 = 1_000_000;
    expect(sup.firstUse(db, t0)).toBe(t0);
    expect(sup.shouldShow(db, t0, true)).toBe(false);
    expect(sup.shouldShow(db, t0 + sup.FIRST_AFTER_S - 1, true)).toBe(false);
    expect(sup.shouldShow(db, t0 + sup.FIRST_AFTER_S, true)).toBe(true);
    const t1 = t0 + sup.FIRST_AFTER_S;
    sup.later(db, t1);
    expect(sup.shouldShow(db, t1 + 1, true)).toBe(false);
    expect(sup.shouldShow(db, t1 + sup.LATER_S - 1, true)).toBe(false);
    expect(sup.shouldShow(db, t1 + sup.LATER_S, true)).toBe(true);
    sup.never(db);
    expect(sup.shouldShow(db, t1 + 10 * sup.LATER_S, true)).toBe(false);
  });
});
