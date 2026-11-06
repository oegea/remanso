import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { addDays, today } from './dates';
import * as goals from './goals';
import * as metrics from './metrics';
import { formatValue, parseValue } from './metrics';

describe('metrics', () => {
  it('parse_and_format', () => {
    expect(parseValue('number', '72,4 kg', 0, 10)).toEqual({ value: 72.4, text: null });
    expect(parseValue('yes_no', 'sí', 0, 10)).toEqual({ value: 1, text: null });
    expect(parseValue('scale', '11', 0, 10)).toBeUndefined();
    expect(parseValue('scale', '7', 0, 10)).toEqual({ value: 7, text: null });
    expect(parseValue('duration', '1:30', 0, 10)).toEqual({ value: 90, text: null });
    expect(parseValue('duration', '45 min', 0, 10)).toEqual({ value: 45, text: null });
    expect(parseValue('duration', '1h30', 0, 10)).toEqual({ value: 90, text: null });
    expect(parseValue('time', '23:15', 0, 10)).toEqual({ value: 1395, text: null });
    expect(parseValue('count', '12', 0, 10)).toEqual({ value: 12, text: null });
    expect(parseValue('count', '12,5', 0, 10)).toBeUndefined();
    expect(parseValue('text', 'cansado', 0, 10)).toEqual({ value: null, text: 'cansado' });
    expect(parseValue('number', '', 0, 10)).toBeUndefined();
    expect(parseValue('number', 'abc', 0, 10)).toBeUndefined();
    expect(formatValue('number', 72.4, null, 'kg')).toBe('72,4 kg');
    expect(formatValue('number', 72, null, '')).toBe('72');
    expect(formatValue('duration', 90, null, '')).toBe('1h 30min');
    expect(formatValue('duration', 45, null, '')).toBe('45 min');
    expect(formatValue('time', 1395, null, '')).toBe('23:15');
    expect(formatValue('yes_no', 0, null, '')).toBe('no');
    expect(formatValue('count', 12, null, 'páginas')).toBe('12 páginas');
    expect(formatValue('text', null, 'cansado', '')).toBe('cansado');
    expect(formatValue('number', null, null, 'kg')).toBe('');
  });

  it('labels and orders', () => {
    expect(metrics.DIRECTIONS).toEqual(['observe', 'maintain', 'range', 'up', 'down']);
    expect(metrics.METRIC_KINDS).toEqual(['number', 'yes_no', 'scale', 'duration', 'count', 'time', 'text']);
    expect(metrics.directionLabel('observe')).toBe('sólo observar');
    expect(metrics.metricKindLabel('scale')).toBe('escala (0–10, 1–5)');
    expect(metrics.frequencyLabel('adhoc')).toBe('cuando quiera');
    expect(metrics.isNumeric('text')).toBe(false);
    expect(metrics.parseMetricKind('raro')).toBe('number');
  });

  it('create_record_series', async () => {
    const db = await Database.create(() => {});
    const g = goals.create(db, 'Dormir mejor', 'process', 'sleep');
    const m = metrics.create(db, { goal_id: g, name: 'Hora de acostarme', kind: 'time', unit: '', sensitive: false });
    const w = metrics.create(db, { goal_id: g, name: 'Peso', kind: 'number', unit: 'kg', sensitive: true });
    expect(metrics.get(db, w)!.frequency, 'sensible → semanal por defecto').toBe('weekly');
    expect(metrics.get(db, w)!.direction, 'sensible → observar').toBe('observe');
    expect(metrics.get(db, m)!.frequency).toBe('daily');
    const t = today();
    metrics.record(db, m, addDays(t, -1), 1410, null, '');
    metrics.record(db, m, t, 1380, null, '');
    metrics.record(db, m, t, 1400, null, '');
    const s = metrics.dailySeries(db, metrics.get(db, m)!, 30);
    expect(s.length).toBe(2);
    expect(s[1].value, 'media del mismo día').toBe(1390);
    expect(s[1].day).toBe(t);
    expect(metrics.get(db, m)!.count).toBe(3);
    expect(metrics.listForGoal(db, g, false).length).toBe(2);
    metrics.setArchived(db, w, true);
    expect(metrics.listForGoal(db, g, false).length).toBe(1);
    expect(metrics.listForGoal(db, g, true).length).toBe(2);
    expect(metrics.measurements(db, m, 10).length, 'archivar no borra nada').toBe(3);
    expect(metrics.countActive(db)).toBe(1);

    // count acumula por día (suma), no media.
    const c = metrics.create(db, { goal_id: g, name: 'Páginas', kind: 'count', unit: '', sensitive: false });
    metrics.record(db, c, t, 10, null, '');
    const mid = metrics.record(db, c, t, 5, null, '');
    expect(metrics.dailySeries(db, metrics.get(db, c)!, 7)).toEqual([{ day: t, value: 15 }]);
    metrics.deleteMeasurement(db, mid);
    expect(metrics.dailySeries(db, metrics.get(db, c)!, 7)).toEqual([{ day: t, value: 10 }]);

    metrics.setTargets(db, w, 70, 72);
    metrics.setDirection(db, w, 'down');
    metrics.setScale(db, c, 1, 5);
    const ww = metrics.get(db, w)!;
    expect([ww.target_low, ww.target_high, ww.direction]).toEqual([70, 72, 'down']);
    metrics.delete(db, c);
    expect(metrics.get(db, c)).toBeUndefined();
    db.close();
  });
});
