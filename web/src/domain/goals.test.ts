import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { nowTs } from './dates';
import * as goals from './goals';

describe('goals', () => {
  it('lifecycle', async () => {
    const db = await Database.create(() => {});
    const id = goals.create(db, 'Leer 20 minutos', 'process', 'project');
    goals.setWhy(db, id, 'Quiero volver a disfrutar de los libros');
    const g = goals.get(db, id)!;
    expect(g.kind).toBe('process');
    expect(g.status).toBe('active');
    expect(g.review_every_days).toBe(7);
    expect(g.why).toBe('Quiero volver a disfrutar de los libros');
    expect(g.safety_shown).toBe(false);
    expect(goals.activeCount(db)).toBe(1);
    goals.setStatus(db, id, 'paused', null);
    expect(goals.list(db, false).length).toBe(1);
    goals.setStatus(db, id, 'closed', 'not_important');
    expect(goals.list(db, false)).toEqual([]);
    const closed = goals.list(db, true)[0];
    expect(goals.closeReasonLabel(closed.close_reason!)).toBe('ya no me importa');
    expect(goals.closeReasonLabel('otra')).toBe('cerrado');
    goals.delete(db, id);
    expect(goals.get(db, id)).toBeUndefined();
    db.close();
  });

  it('review_due', async () => {
    const db = await Database.create(() => {});
    const id = goals.create(db, 'x', 'process', 'general');
    const now = nowTs();
    expect(goals.dueForReview(db, now)).toEqual([]);
    expect(goals.dueForReview(db, now + 8 * 86_400).length).toBe(1);
    goals.markReviewed(db, id);
    expect(goals.dueForReview(db, now + 6 * 86_400)).toEqual([]);
    expect(goals.dueForReview(db, now + 8 * 86_400).length).toBe(1);
    db.close();
  });

  it('categories_flag_safety', () => {
    expect(goals.category('substance').red_flag).not.toBeNull();
    expect(goals.category('food_weight').sensitive).toBe(true);
    expect(goals.category('project').red_flag).toBeNull();
    expect(goals.category('desconocida').key).toBe('general');
  });

  it('archive, safety and labels', async () => {
    const db = await Database.create(() => {});
    const id = goals.create(db, 'y', 'outcome', 'substance');
    goals.markSafetyShown(db, id);
    expect(goals.get(db, id)!.safety_shown).toBe(true);
    goals.setHorizon(db, id, '2027-01-01');
    expect(goals.get(db, id)!.horizon_on).toBe('2027-01-01');
    goals.archive(db, id);
    expect(goals.list(db, true)).toEqual([]);
    expect(goals.activeCount(db)).toBe(0);
    expect(goals.goalKindLabel('process')).toBe('proceso (hacer algo con regularidad)');
    expect(goals.goalStatusLabel('achieved')).toBe('alcanzado');
    expect(goals.GOAL_KINDS).toEqual(['process', 'outcome', 'learning']);
    db.close();
  });
});
