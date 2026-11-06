import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../db/sqlite';
import * as med from './meditation';

describe('plan de sesión', () => {
  it('suma exactamente la duración pedida y tiene la estructura fija', () => {
    for (const m of med.DURATIONS) {
      for (let seed = 1; seed <= 12; seed++) {
        const plan = med.makePlan(m, seed);
        expect(med.planSeconds(plan)).toBe(m * 60);
        expect(plan[0].kind).toBe('intention');
        expect(plan[1].kind).toBe('deep_breaths');
        expect(['settle', 'scan', 'sounds']).toContain(plan[2].kind);
        expect(plan[3].kind).toBe('breath');
        expect(plan[4].kind).toBe('closing_breaths');
        expect(plan[5].kind).toBe('open_eyes');
        for (const p of plan) { expect(p.seconds).toBeGreaterThan(0); for (const s of p.steps) expect(s.at).toBeLessThan(p.seconds); }
      }
    }
  });
  it('varía entre semillas (parte de cuerpo, foco de respiración, reflexión)', () => {
    const kinds = new Set<string>(), cues = new Set<string>(), breaths = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const plan = med.makePlan(10, seed);
      kinds.add(plan[2].kind); cues.add(plan[0].cue); breaths.add(plan[3].cue);
    }
    expect(kinds.size).toBe(3);
    expect(cues.size).toBeGreaterThan(3);
    expect(breaths.size).toBe(3);
  });
  it('es determinista con la misma semilla', () => {
    expect(med.makePlan(15, 7)).toEqual(med.makePlan(15, 7));
  });
});

describe('diario de meditación', () => {
  let db: Database;
  beforeEach(async () => { db = await Database.create(() => {}); });
  it('guarda, termina, lista y cuenta banderas', () => {
    const plan = med.makePlan(5, 1);
    const id = med.start(db, plan, 1000);
    expect(med.list(db)).toHaveLength(0); // sin terminar no aparece
    med.finish(db, id, { now: 1300, doneSeconds: 300, feeling: 1, unpleasant: false, notes: 'bien' });
    const id2 = med.start(db, plan, 2000);
    med.finish(db, id2, { now: 2300, doneSeconds: 120, feeling: -1, unpleasant: true, notes: '' });
    const l = med.list(db);
    expect(l.map((s) => s.id)).toEqual([id2, id]);
    expect(l[0].unpleasant).toBe(true);
    expect(med.unpleasantAmongLast(db, 3)).toBe(1);
    expect(med.totals(db)).toEqual({ sessions: 2, minutes: 7 });
    expect(med.feelingLabel(l[1].feeling)).toBe('Algo más tranquilo');
  });
  it('descarta las empezadas y no terminadas', () => {
    med.start(db, med.makePlan(5, 1), 1000);
    med.discardUnfinished(db);
    expect(db.scalar<number>('SELECT count(*) FROM meditation_sessions')).toBe(0);
  });
  it('preferencias con valores por defecto y persistencia', () => {
    expect(med.prefs(db).minutes).toBe(10);
    med.setPrefs(db, { minutes: 15, voice: true });
    expect(med.prefs(db)).toMatchObject({ minutes: 15, voice: true, vibrate: true });
  });
});
