import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../db/sqlite';
import * as med from './meditation';

describe('plan de sesión', () => {
  it('suma exactamente la duración pedida y tiene la estructura fija', () => {
    for (const m of med.DURATIONS) {
      for (let seed = 1; seed <= 12; seed++) {
        for (const voice of [true, false]) {
          const plan = med.makePlan(m, seed, voice);
          expect(med.planSeconds(plan)).toBe(m * 60);
          expect(plan.map((p) => p.kind).slice(0, 2)).toEqual(['intention', 'deep_breaths']);
          expect(['settle', 'scan', 'sounds']).toContain(plan[2].kind);
          expect(plan.map((p) => p.kind).slice(3)).toEqual(['breath', 'open_eyes', 'closing_breaths']);
          expect(plan[1].seconds - (plan[1].lead ?? 0), 'treinta segundos de círculo tras la explicación').toBe(30);
          if (voice) expect(plan[1].lead!).toBeGreaterThanOrEqual(med.lineSeconds('deep_breaths') - med.GAP_S);
          else expect(plan[1].lead).toBe(0);
          expect(med.planMinSeconds(plan, voice), 'el plan cabe en el tiempo pedido').toBeLessThanOrEqual(m * 60);
        }
      }
    }
  });
  it('con voz, ninguna frase pisa a otra: cada paso empieza cuando la anterior ha acabado y cabe entero', () => {
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 20; seed++) {
      const plan = med.makePlan(m, seed, true);
      expect(plan[0].seconds).toBeGreaterThanOrEqual(med.lineSeconds('empecemos') + med.GONG_S + med.lineSeconds(plan[0].voice));
      expect(plan[4].seconds).toBeGreaterThanOrEqual(med.GONG_S + med.lineSeconds('closing'));
      for (const p of plan) {
        let free = p.voice ? med.lineSeconds(p.voice) - med.GAP_S + med.INTRO_GAP_S : 0;
        for (const s of p.steps) {
          expect(s.at, `${m} min, semilla ${seed}, ${p.kind}`).toBeGreaterThanOrEqual(Math.floor(free));
          expect(s.at + med.lineSeconds(s.voice), 'la frase del paso cabe en su parte').toBeLessThanOrEqual(p.seconds + 0.5);
          free = s.at + med.lineSeconds(s.voice);
        }
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
  it('nada se omite: cada variante lleva todos sus pasos y desde diez minutos entran las tres', () => {
    const kinds = new Set<string>();
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 30; seed++) {
      const p = med.makePlan(m, seed, true);
      kinds.add(p[2].kind);
      expect(p[2].steps.length, 'asentarse: pies y manos; recorrido: seis regiones; sonidos: su paso').toBe(p[2].kind === 'settle' ? 2 : p[2].kind === 'scan' ? 6 : 1);
      expect(p[3].steps.length).toBeGreaterThanOrEqual(1);
    }
    expect(kinds.size).toBe(3);
  });
  it('es determinista con la misma semilla', () => {
    expect(med.makePlan(15, 7)).toEqual(med.makePlan(15, 7));
  });
});

describe('diario de meditación', () => {
  let db: Database;
  beforeEach(async () => { db = await Database.create(() => {}); });
  it('guarda, termina, lista y cuenta banderas', () => {
    const plan = med.makePlan(10, 1);
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
    med.setNotes(db, id, '  ahora mejor ');
    expect(med.get(db, id)!.notes).toBe('ahora mejor');
    med.remove(db, id2);
    expect(med.list(db).map((s) => s.id)).toEqual([id]);
    expect(med.totals(db)).toEqual({ sessions: 1, minutes: 5 });
  });
  it('descarta las empezadas y no terminadas', () => {
    med.start(db, med.makePlan(10, 1), 1000);
    med.discardUnfinished(db);
    expect(db.scalar<number>('SELECT count(*) FROM meditation_sessions')).toBe(0);
  });
  it('preferencias con valores por defecto y persistencia', () => {
    expect(med.prefs(db).minutes).toBe(10);
    db.run("INSERT INTO settings(key, value) VALUES ('meditation_prefs', '{\"minutes\":5}') ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    expect(med.prefs(db).minutes, 'cinco minutos ya no existe: pasa a diez').toBe(10);
    med.setPrefs(db, { minutes: 15, voice: true });
    expect(med.prefs(db)).toMatchObject({ minutes: 15, voice: true, vibrate: true });
  });
});
