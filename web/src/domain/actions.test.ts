import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { addDays, today } from './dates';
import * as actions from './actions';
import { Schedule } from './actions';

describe('actions', () => {
  it('schedule_parsing', () => {
    expect(Schedule.parseHuman('3 veces por semana')).toEqual({ kind: 'per_week', n: 3 });
    expect(Schedule.parseHuman('3/semana')).toEqual({ kind: 'per_week', n: 3 });
    expect(Schedule.parseHuman('cada día')).toEqual({ kind: 'daily' });
    expect(Schedule.parseHuman('semanal')).toEqual({ kind: 'per_week', n: 1 });
    expect(Schedule.parseHuman('cada 2 semanas')).toBeNull();
    expect(Schedule.parseHuman('9 veces por semana')).toBeNull();
    expect(Schedule.parseHuman('')).toBeNull();
    const lxv = Schedule.parseHuman('L X V')!;
    expect(Schedule.perWeek(lxv)).toBe(3);
    expect(Schedule.describe(lxv)).toBe('lun mié vie');
    expect(Schedule.describe(Schedule.parseHuman('laborables')!)).toBe('laborables');
    expect(Schedule.parse('per_week:4')).toEqual({ kind: 'per_week', n: 4 });
    expect(Schedule.parse('weekdays:LXV')).toEqual({ kind: 'weekdays', days: [true, false, true, false, true, false, false] });
    expect(Schedule.parse('otra cosa')).toEqual({ kind: 'daily' });
    expect(Schedule.toStorage(Schedule.perWeekOf(4))).toBe('per_week:4');
    expect(Schedule.toStorage(Schedule.parse('weekdays:LXV'))).toBe('weekdays:LXV');
    expect(Schedule.toStorage(Schedule.daily)).toBe('daily');
    expect(Schedule.describe(Schedule.perWeekOf(4))).toBe('4 veces por semana');
    expect(Schedule.describe(Schedule.perWeekOf(1))).toBe('1 vez por semana');
    expect(Schedule.perWeek(Schedule.daily)).toBe(7);
    // 2026-11-05 es jueves.
    expect(Schedule.plannedOn(Schedule.parse('weekdays:J'), '2026-11-05')).toBe(true);
    expect(Schedule.plannedOn(Schedule.parse('weekdays:LV'), '2026-11-05')).toBe(false);
    expect(Schedule.plannedOn(Schedule.perWeekOf(2), '2026-11-05')).toBe(true);
  });

  it('logging_and_summary', async () => {
    const db = await Database.create(() => {});
    const a = actions.create(db, null, 'Caminar 20 minutos', Schedule.perWeekOf(3), false);
    const t = today();
    for (const i of [0, 1, 3, 8, 9, 10, 40]) actions.log(db, a, addDays(t, -i), true, '');
    actions.log(db, a, addDays(t, -2), false, 'resfriado');
    expect(actions.statusOn(db, a, t)).toBe(true);
    expect(actions.statusOn(db, a, addDays(t, -2))).toBe(false);
    expect(actions.statusOn(db, a, addDays(t, -5)), 'hueco, no fallo').toBeUndefined();
    const act = actions.get(db, a)!;
    expect(act.schedule).toEqual({ kind: 'per_week', n: 3 });
    expect(act.avoid).toBe(false);
    const s = actions.summary(db, act, t);
    expect(s.last7).toBe(3);
    expect(s.last30).toBe(6);
    expect(s.total).toBe(7);
    expect(s.per_week).toBe(3);
    expect(actions.firstDone(db, a)).toBe(addDays(t, -40));
    expect(actions.doneDays(db, a, addDays(t, -3), t)).toEqual([addDays(t, -3), addDays(t, -1), t]);
    actions.log(db, a, t, null, '');
    expect(actions.statusOn(db, a, t)).toBeUndefined();
    expect(actions.totalDone(db, a)).toBe(6);
    db.close();
  });

  it('weeks_meeting_target', async () => {
    const db = await Database.create(() => {});
    const a = actions.create(db, null, 'Leer', Schedule.perWeekOf(2), false);
    const t = '2026-11-05'; // jueves; semana del 2 nov
    // Esta semana: 2 hechos; semana anterior: 2; dos semanas atrás: 1 → corta la cuenta.
    for (const d of ['2026-11-02', '2026-11-04', '2026-10-26', '2026-10-30', '2026-10-20']) actions.log(db, a, d, true, '');
    const s = actions.summary(db, actions.get(db, a)!, t);
    expect(s.this_week).toBe(2);
    expect(s.last_week).toBe(2);
    expect(s.weeks_meeting_target).toBe(2);
    expect(actions.firstDone(db, actions.create(db, null, 'Nada', Schedule.daily, true))).toBeUndefined();
    db.close();
  });

  it('lists, setters and goal linkage', async () => {
    const db = await Database.create(() => {});
    const goals = await import('./goals');
    const g = goals.create(db, 'Objetivo', 'process', 'general');
    const a = actions.create(db, g, 'Acción', Schedule.daily, false);
    const b = actions.create(db, g, 'Evitar', Schedule.daily, true);
    const c = actions.create(db, null, 'Suelta', Schedule.daily, false);
    expect(actions.listForGoal(db, g, false).map((x) => x.id)).toEqual([a, b]);
    expect(actions.listActive(db).map((x) => x.id)).toEqual([a, b, c]);
    expect(actions.get(db, b)!.avoid).toBe(true);
    actions.setPaused(db, a, true);
    actions.setArchived(db, b, true);
    expect(actions.listForGoal(db, g, false).map((x) => x.id)).toEqual([a]);
    expect(actions.listForGoal(db, g, true).map((x) => x.id)).toEqual([a, b]);
    expect(actions.listActive(db).map((x) => x.id)).toEqual([c]);
    goals.setStatus(db, g, 'paused', null);
    actions.setPaused(db, a, false);
    expect(actions.listActive(db).map((x) => x.id), 'objetivo pausado → sus acciones no salen en Hoy').toEqual([c]);
    actions.setName(db, c, '  Nueva  ');
    actions.setCue(db, c, 'al despertar');
    actions.setSchedule(db, c, Schedule.parse('weekdays:LMX'));
    const cc = actions.get(db, c)!;
    expect([cc.name, cc.cue, Schedule.toStorage(cc.schedule)]).toEqual(['Nueva', 'al despertar', 'weekdays:LMX']);
    actions.delete(db, c);
    expect(actions.get(db, c)).toBeUndefined();
    db.close();
  });
});
