import { describe, it, expect } from 'vitest';
import { addDays } from '../dates';
import { activityRows, activityRowText, chartRow, lineChart, progressBar, sparkline, sparklineText } from './spark';

describe('spark', () => {
  it('spark_and_bar', () => {
    expect(sparkline([1, 2, 3], 3)).toEqual([0, 0.5, 1]);
    expect(sparkline([5, 5], 2)).toEqual([0.5, 0.5]);
    expect(sparkline([1, 2, 3, 4], 2)).toEqual([0, 1]);
    expect(sparkline([], 3)).toEqual([]);
    expect(sparklineText([1, 2, 3], 3)).toBe('▁▅█');
    expect(sparklineText([5, 5], 2)).toBe('▅▅');
    const p = progressBar(3, 10, 10, '');
    expect(p.filled).toBe(3);
    expect(p.ratio).toBeCloseTo(0.3);
    expect(p.text).toBe('llevas 3 de 10');
    expect(progressBar(8, 10, 10, 'km').text).toBe('faltan 2 km de 10 km');
    expect(progressBar(12, 10, 10, '').text).toBe('12 de 10');
    expect(progressBar(12, 10, 10, '').ratio).toBe(1);
    expect(progressBar(2.5, 10, 10, 'kg').text).toBe('llevas 2,5 kg de 10 kg');
    expect(progressBar(1, 0, 10, '').ratio).toBe(0);
  });

  it('activity_calendar_marks_gaps_neutrally', () => {
    const today = '2026-11-05'; // jueves
    const done = new Set([today, addDays(today, -2)]);
    const nd = new Set([addDays(today, -1)]);
    const rows = activityRows(done, nd, today, 1);
    expect(rows.length).toBe(1);
    expect(rows[0].label).toBe('2 nov');
    expect(rows[0].weekStart).toBe('2026-11-02');
    expect(rows[0].days).toEqual(['blank', 'done', 'not', 'done', 'future', 'future', 'future']);
    expect(activityRowText(rows[0].days)).toBe('· ● ○ ●');
    const two = activityRows(done, nd, today, 2);
    expect(two.length).toBe(2);
    expect(two[0].label).toBe('26 oct');
    expect(two[0].days.every((s) => s === 'blank')).toBe(true);
  });

  it('chart_shape', () => {
    const pts = lineChart([1, 2, 3], 3);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ]);
    // Mismas filas que el terminal: ["  *", " * ", "*  "].
    expect(pts.map((p) => chartRow(p.y, 3))).toEqual([2, 1, 0]);
    expect(lineChart([4], 3)).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(lineChart([], 3)).toEqual([]);
  });
});
