import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { nowTs } from './dates';
import * as plans from './plans';

interface Rem { id: number; due_at: number; done_at: number | null; title: string }
const forRef = (db: Database, id: number) =>
  db.all<Rem>("SELECT id, due_at, done_at, title FROM reminders WHERE ref_kind = 'plan' AND ref_id = ?1 AND done_at IS NULL ORDER BY due_at", [id]);

describe('planes si–entonces', () => {
  it('detecta frases vagas (lista cerrada)', () => {
    expect(plans.isVague('cuando pueda')).toBe(true);
    expect(plans.isVague('')).toBe(true);
    expect(plans.isVague('  Algún Día ')).toBe(true);
    expect(plans.isVague('al llegar a casa a las 19:00')).toBe(false);
  });

  it('crea con refuerzos y revisa', async () => {
    const db = await Database.create(() => {});
    const id = plans.create(db, null, null, 'al terminar de cenar', 'pongo el libro en la mesa y leo una página', true);
    const r = forRef(db, id);
    expect(r).toHaveLength(2);
    expect(r[0].due_at).toBeGreaterThan(nowTs() + 6 * 86_400);
    expect(r[1].due_at).toBeGreaterThan(nowTs() + 13 * 86_400);
    expect(r[0].title).toBe('Plan: si al terminar de cenar → pongo el libro en la mesa y leo una página');
    // 09:00 local
    for (const x of r) {
      const d = new Date(x.due_at * 1000);
      expect([d.getHours(), d.getMinutes()]).toEqual([9, 0]);
    }
    expect(plans.review(db, id, 'not_used', '')).toBe(false);
    expect(plans.review(db, id, 'not_used', '')).toBe(true); // dos «no se dio» → ofrecer archivar
    const p = plans.get(db, id)!;
    expect(p.not_used).toBe(2);
    expect(p.last_reviewed_at).not.toBeNull();
    plans.setArchived(db, id, true);
    expect(forRef(db, id)).toHaveLength(0);
    expect(plans.listActive(db)).toHaveLength(0);
    expect(plans.get(db, id)!.archived).toBe(true);
  });

  it('sin refuerzos, listados, actualización y borrado', async () => {
    const db = await Database.create(() => {});
    db.run("INSERT INTO goals(name, started_on, created_at, updated_at) VALUES ('g', '2026-01-01', 1, 1)");
    const id = plans.create(db, 1, null, ' si llueve ', ' cojo el paraguas ', false);
    expect(forRef(db, id)).toHaveLength(0);
    const p = plans.get(db, id)!;
    expect([p.situation, p.response, p.goal_id]).toEqual(['si llueve', 'cojo el paraguas', 1]);
    plans.update(db, id, 'si nieva', 'me quedo');
    expect(plans.get(db, id)!.situation).toBe('si nieva');
    const id2 = plans.create(db, 1, null, 'a', 'b', false);
    plans.setArchived(db, id2, true);
    expect(plans.listForGoal(db, 1, false).map((x) => x.id)).toEqual([id]);
    expect(plans.listForGoal(db, 1, true).map((x) => x.id)).toEqual([id, id2]);
    plans.setArchived(db, id2, false);
    expect(plans.listActive(db)).toHaveLength(2);
    expect(plans.review(db, id, 'yes', 'bien')).toBe(false);
    expect(plans.get(db, id)!.helpful_yes).toBe(1);
    plans.delete(db, id);
    expect(plans.get(db, id)).toBeUndefined();
    expect(db.scalar<number>('SELECT count(*) FROM plan_reviews')).toBe(0);
    expect(plans.HELPFUL.map(([k]) => k)).toEqual(['yes', 'partly', 'no', 'not_used']);
  });
});
