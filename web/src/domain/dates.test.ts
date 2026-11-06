import { describe, it, expect } from 'vitest';
import { fmtDateLong, fmtDateShort, fmtRelativeDays, parseDayInput, parseTimeInput, weekStart, daysInMonth, addDays } from './dates';

describe('fechas en español', () => {
  const t = '2026-11-05'; // jueves
  it('formatea', () => {
    expect(fmtDateShort(t)).toBe('jue 5 nov 2026');
    expect(fmtDateLong(t)).toBe('jueves, 5 de noviembre de 2026');
    expect(fmtRelativeDays(t, t)).toBe('hoy');
    expect(fmtRelativeDays(addDays(t, -9), t)).toBe('hace 9 días');
    expect(fmtRelativeDays(addDays(t, -21), t)).toBe('hace 3 semanas');
    expect(fmtRelativeDays(addDays(t, 1), t)).toBe('mañana');
  });
  it('semana y mes', () => {
    expect(weekStart(t)).toBe('2026-11-02');
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
  it('entradas de fecha', () => {
    const p = (s: string) => parseDayInput(s, t)?.day;
    expect(p('hoy')).toBe(t);
    expect(p('mañana')).toBe('2026-11-06');
    expect(p('+3')).toBe('2026-11-08');
    expect(p('lun')).toBe('2026-11-09');
    expect(p('jueves')).toBe('2026-11-12');
    expect(p('20')).toBe('2026-11-20');
    expect(p('2')).toBe('2026-12-02');
    expect(p('1/3')).toBe('2027-03-01');
    expect(p('25/12/26')).toBe('2026-12-25');
    expect(parseDayInput('ninguna', t)).toEqual({ day: null });
    expect(parseDayInput('xyz', t)).toBeUndefined();
    expect(parseDayInput('32', t)).toBeUndefined();
    expect(parseTimeInput('18:30')).toEqual([18, 30]);
    expect(parseTimeInput('25:00')).toBeUndefined();
  });
});
