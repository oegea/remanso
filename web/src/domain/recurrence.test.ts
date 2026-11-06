import { describe, it, expect } from 'vitest';
import { DAILY, addMonths, describe as describeRule, every, monthly, nextAfter, parse, parseHuman, toStorage, weekdays } from './recurrence';

describe('recurrencia', () => {
  it('ida y vuelta al almacenamiento', () => {
    for (const s of ['daily', 'weekdays:LXV', 'every:2:w', 'monthly:31']) {
      expect(toStorage(parse(s)!)).toBe(s);
    }
    expect(parse('weekdays:')).toBeNull();
    expect(parse('every:0:d')).toBeNull();
    expect(parse('monthly:32')).toBeNull();
    expect(parse('weekdays:Q')).toBeNull();
  });

  it('interpreta lo que escribe el usuario', () => {
    expect(parseHuman('cada día')).toEqual(DAILY);
    expect(parseHuman('laborables')).toEqual(weekdays([true, true, true, true, true, false, false]));
    expect(parseHuman('L X V')).toEqual(weekdays([true, false, true, false, true, false, false]));
    expect(parseHuman('lmx')).toEqual(weekdays([true, true, true, false, false, false, false]));
    expect(parseHuman('cada 3 semanas')).toEqual(every(3, 'weeks'));
    expect(parseHuman('día 15')).toEqual(monthly(15));
    expect(parseHuman('nunca')).toBeNull();
    expect(parseHuman('blabla')).toBeNull();
  });

  it('próximas fechas', () => {
    const thu = '2026-11-05';
    expect(nextAfter(DAILY, thu)).toBe('2026-11-06');
    expect(nextAfter(parseHuman('L V')!, thu)).toBe('2026-11-06');
    expect(nextAfter(parseHuman('L')!, thu)).toBe('2026-11-09');
    expect(nextAfter(every(2, 'weeks'), thu)).toBe('2026-11-19');
    expect(nextAfter(every(1, 'months'), '2026-01-31')).toBe('2026-02-28');
    expect(nextAfter(monthly(31), '2026-02-10')).toBe('2026-02-28');
    expect(nextAfter(monthly(5), thu)).toBe('2026-12-05');
    expect(nextAfter(monthly(5), '2026-11-04')).toBe('2026-11-05');
    expect(addMonths('2026-11-30', 15)).toBe('2028-02-29');
  });

  it('describe en español', () => {
    expect(describeRule(parseHuman('laborables')!)).toBe('laborables');
    expect(describeRule(parseHuman('L X')!)).toBe('lun mié');
    expect(describeRule(every(2, 'months'))).toBe('cada 2 meses');
    expect(describeRule(every(1, 'days'))).toBe('cada día');
    expect(describeRule(monthly(3))).toBe('el día 3 de cada mes');
  });
});
