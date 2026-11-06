import { describe, it, expect } from 'vitest';
import { addDays } from '../dates';
import type { DayValue } from '../metrics';
import { currentLevel, describeChange, enoughForTrend, ewma, movingAverage, slopePerDay, timeRegularityMinutes, weekOverWeek } from './trend';

const d = (i: number) => addDays('2026-01-01', i);
const series = (n: number, f: (i: number) => number, day: (i: number) => string = d): DayValue[] =>
  Array.from({ length: n }, (_, i) => ({ day: day(i), value: f(i) }));

describe('trend', () => {
  it('ewma_and_moving_average', () => {
    expect(ewma([10, 20], 0.5)).toEqual([10, 15]);
    expect(ewma([], 0.1)).toEqual([]);
    const s = series(10, (i) => i);
    const ma = movingAverage(s, 7);
    expect(ma[9].value).toBe(6);
    expect(ma[0].value).toBe(0);
    expect(ma[9].day).toBe(d(9));
  });

  it('current_level', () => {
    const s = series(10, (i) => i);
    expect(currentLevel(s, 'number')).toBe(6);
    expect(currentLevel(s, 'time')).toBe(9);
    expect(currentLevel([], 'number')).toBeUndefined();
  });

  it('minimum_n_rules', () => {
    const s = series(3, () => 70);
    const r = enoughForTrend(s, 'number', false);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('3 de 7');
      expect(r.message).toBe('Todavía no hay datos suficientes para ver una tendencia (3 de 7 registros). Las variaciones de un día a otro son normales.');
    }
    const s7 = series(7, () => 70);
    expect(enoughForTrend(s7, 'number', false)).toEqual({ ok: true });
    // Siete registros en tres días no cubren siete días naturales.
    const dense = series(7, () => 70, (i) => d(Math.floor(i / 3)));
    expect(enoughForTrend(dense, 'number', false).ok).toBe(false);
    expect(enoughForTrend(series(4, () => 70), 'number', true)).toEqual({ ok: true });
    expect(enoughForTrend(series(4, () => 5), 'scale', false).ok).toBe(false);
    expect(enoughForTrend(series(5, () => 5), 'scale', false).ok).toBe(true);
    expect(enoughForTrend([], 'yes_no', false)).toEqual({
      ok: false,
      message: 'Todavía no hay datos suficientes para ver una tendencia (0 de 4 registros). Las variaciones de un día a otro son normales.',
    });
  });

  it('slope_and_change', () => {
    const s = series(14, (i) => 80 - 0.1 * i);
    const sl = slopePerDay(s)!;
    expect(Math.abs(sl + 0.1)).toBeLessThan(1e-9);
    expect(slopePerDay(s.slice(0, 1))).toBeUndefined();
    const [cur, prev] = weekOverWeek(s, d(13), false);
    const txt = describeChange(cur, prev, 'kg', 1);
    expect(txt).toBe('bajó 0,7 kg respecto a la media de la semana anterior');
    expect(describeChange(1, 1, '', 1)).toBe('sin cambios respecto a la semana anterior');
    expect(describeChange(2.5, 1, '', 1)).toBe('subió 1,5 respecto a la media de la semana anterior');
    expect(describeChange(undefined, 1, '', 1)).toBeUndefined();
    const [sumCur, sumPrev] = weekOverWeek(s, d(13), true);
    expect(sumCur).toBeCloseTo(7 * 80 - 0.1 * (7 + 8 + 9 + 10 + 11 + 12 + 13), 9);
    expect(sumPrev).toBeCloseTo(7 * 80 - 0.1 * (0 + 1 + 2 + 3 + 4 + 5 + 6), 9);
  });

  it('circular_time_regularity', () => {
    // 23:50, 00:10, 00:00 → muy regular pese al cruce de medianoche.
    const r = timeRegularityMinutes([1430, 10, 0])!;
    expect(r).toBeLessThan(15);
    const r2 = timeRegularityMinutes([1200, 1380, 60])!;
    expect(r2).toBeGreaterThan(60);
    expect(timeRegularityMinutes([1, 2])).toBeUndefined();
  });
});
