import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import * as safety from './safety';
import { T } from '../text/texts';

describe('derivación y acompañamiento profesional', () => {
  it('sin acompañamiento: bloque base más la línea de la señal; el 024 ante daño', async () => {
    const db = await Database.create(() => {});
    expect(safety.isSupervised(db)).toBe(false);
    expect(safety.derivation(db, null)).toEqual([T.DERIVATION_BASE]);
    expect(safety.derivation(db, 'substance')).toEqual([T.DERIVATION_BASE, T.DERIVATION_SUBSTANCE]);
    expect(safety.derivation(db, 'eating')).toEqual([T.DERIVATION_BASE, T.DERIVATION_EATING]);
    expect(safety.derivation(db, 'self_harm')).toEqual([T.DERIVATION_BASE, T.DERIVATION_SUICIDAL]);
    expect(safety.derivation(db, 'gambling', { harm: true })).toEqual([T.DERIVATION_BASE, T.DERIVATION_SUICIDAL]);
    expect(safety.sensitiveMetricText(db)).toBe(T.METRIC_SENSITIVE_TEXT);
  });

  it('con acompañamiento: nota breve que conserva el 112 y los matices médico y de autocuidado', async () => {
    const db = await Database.create(() => {});
    safety.setSupervised(db, true);
    expect(safety.isSupervised(db)).toBe(true);
    for (const flag of [null, 'self_harm', 'gambling'] as const) {
      const lines = safety.derivation(db, flag, { harm: true });
      expect(lines).toEqual([T.DERIVATION_SUPERVISED]);
      expect(lines.join(' ')).toContain('112');
    }
    expect(safety.derivation(db, 'eating')).toEqual([T.DERIVATION_SUPERVISED, T.DERIVATION_EATING_SUPERVISED]);
    expect(safety.derivation(db, 'substance')).toEqual([T.DERIVATION_SUPERVISED, T.DERIVATION_SUBSTANCE_SUPERVISED]);
    expect(safety.sensitiveMetricText(db)).toBe(T.METRIC_SENSITIVE_SUPERVISED);
    safety.setSupervised(db, false);
    expect(safety.isSupervised(db)).toBe(false);
  });

  it('los avisos únicos se marcan una sola vez', async () => {
    const db = await Database.create(() => {});
    expect(safety.firstTime(db, 'harm_warning_shown')).toBe(true);
    expect(safety.firstTime(db, 'harm_warning_shown')).toBe(false);
  });
});
