import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { addDays, today } from './dates';
import * as actions from './actions';
import { Schedule } from './actions';
import * as goals from './goals';
import * as metrics from './metrics';
import * as milestones from './milestones';

describe('milestones', () => {
  it('action_count_milestone_and_history', async () => {
    const db = await Database.create(() => {});
    const g = goals.create(db, 'Correr', 'process', 'activity');
    const a = actions.create(db, g, 'Salir a correr', Schedule.perWeekOf(2), false);
    const m = milestones.create(db, { goal_id: g, title: 'Diez salidas', kind: 'action_count', action_id: a, target_value: 3 });
    const t = today();
    expect(milestones.evaluate(db, g, t)).toEqual([]);
    for (let i = 0; i < 3; i++) actions.log(db, a, addDays(t, -i), true, '');
    expect(milestones.progress(db, milestones.get(db, m)!, t)).toEqual([3, 3]);
    const reached = milestones.evaluate(db, g, t);
    expect(reached.length).toBe(1);
    expect(reached[0].status).toBe('reached');
    expect(reached[0].reached_at).not.toBeNull();
    expect(milestones.evaluate(db, g, t), 'no se repite').toEqual([]);

    const d = milestones.create(db, { goal_id: g, title: 'Fecha', kind: 'date', target_day: addDays(t, 10) });
    expect(milestones.get(db, d)!.position).toBe(2);
    milestones.reschedule(db, d, addDays(t, 20), 'necesito más tiempo');
    const h = milestones.historyOf(db, d);
    expect(h.length).toBe(1);
    expect(h[0].note).toBe('necesito más tiempo');
    expect(h[0].field).toBe('target_day');
    expect(h[0].old_value).toBe(addDays(t, 10));
    expect(h[0].new_value).toBe(addDays(t, 20));
    expect(milestones.get(db, d)!.target_day).toBe(addDays(t, 20));
    // La fecha aún no ha llegado; al llegar, se alcanza.
    expect(milestones.evaluate(db, g, t)).toEqual([]);
    expect(milestones.evaluate(db, g, addDays(t, 20)).map((x) => x.id)).toEqual([d]);
    expect(milestones.progress(db, milestones.get(db, d)!, t)).toBeUndefined();

    milestones.setTargetValue(db, m, 5, 'subo el listón');
    const hm = milestones.historyOf(db, m);
    expect(hm.length).toBe(1);
    expect([hm[0].old_value, hm[0].new_value]).toEqual(['3', '5']);
    milestones.markPending(db, m);
    expect(milestones.get(db, m)!.status).toBe('pending');
    expect(milestones.get(db, m)!.reached_at).toBeNull();
    milestones.markDropped(db, m);
    expect(milestones.get(db, m)!.status).toBe('dropped');
    milestones.setTitle(db, m, '  Cinco salidas ');
    expect(milestones.get(db, m)!.title).toBe('Cinco salidas');
    expect(milestones.listForGoal(db, g).map((x) => x.id)).toEqual([m, d]);
    milestones.delete(db, m);
    expect(milestones.listForGoal(db, g).map((x) => x.id)).toEqual([d]);
    expect(milestones.historyOf(db, m)).toEqual([]);
    db.close();
  });

  it('metric_value uses the 7-day level for noisy metrics', async () => {
    const db = await Database.create(() => {});
    const g = goals.create(db, 'Peso', 'outcome', 'food_weight');
    const w = metrics.create(db, { goal_id: g, name: 'Peso', kind: 'number', unit: 'kg', sensitive: true });
    metrics.setDirection(db, w, 'down');
    const m = milestones.create(db, { goal_id: g, title: 'Bajar de 70', kind: 'metric_value', metric_id: w, target_value: 70 });
    const t = today();
    // Un único punto por debajo no basta si la media de la semana sigue por encima.
    metrics.record(db, w, addDays(t, -2), 72, null, '');
    metrics.record(db, w, addDays(t, -1), 71, null, '');
    metrics.record(db, w, t, 69, null, '');
    expect(milestones.progress(db, milestones.get(db, m)!, t)).toEqual([69, 70]);
    expect(milestones.evaluate(db, g, t)).toEqual([]);
    metrics.record(db, w, t, 65, null, '');
    // Media: (72 + 71 + 67) / 3 = 70 → alcanzado (<=).
    expect(milestones.evaluate(db, g, t).map((x) => x.id)).toEqual([m]);
    db.close();
  });

  it('sustain_weeks and manual', async () => {
    const db = await Database.create(() => {});
    const g = goals.create(db, 'Leer', 'process', 'project');
    const a = actions.create(db, g, 'Leer', Schedule.perWeekOf(1), false);
    const s = milestones.create(db, { goal_id: g, title: 'Dos semanas', kind: 'sustain_weeks', action_id: a, target_value: 2 });
    const man = milestones.create(db, { goal_id: g, title: 'Fase 1', kind: 'manual' });
    const t = '2026-11-05';
    actions.log(db, a, '2026-11-03', true, '');
    actions.log(db, a, '2026-10-28', true, '');
    expect(milestones.progress(db, milestones.get(db, s)!, t)).toEqual([2, 2]);
    expect(milestones.evaluate(db, g, t).map((x) => x.id)).toEqual([s]);
    expect(milestones.get(db, man)!.status, 'los manuales nunca se evalúan').toBe('pending');
    milestones.markReached(db, man);
    expect(milestones.get(db, man)!.status).toBe('reached');
    expect(milestones.MILESTONE_KINDS).toEqual(['manual', 'action_count', 'sustain_weeks', 'metric_value', 'date']);
    expect(milestones.milestoneKindLabel('sustain_weeks')).toBe('mantener una acción N semanas');
    expect(milestones.parseMilestoneKind('sustain_days')).toBe('sustain_weeks');
    db.close();
  });
});
