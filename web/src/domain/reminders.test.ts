import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { addDays, nowTs, today, tsToDay } from './dates';
import { DAILY, every } from './recurrence';
import * as rem from './reminders';

describe('recordatorios', () => {
  it('vencidos, posponer, cerrar', async () => {
    const db = await Database.create(() => {});
    const now = 1_700_000_000;
    const a = rem.create(db, 'Revisar objetivos', now - 60, null, null, null);
    const b = rem.create(db, 'Más tarde', now + 3600, null, null, null);
    expect(rem.due(db, now).map((r) => r.id)).toEqual([a]);
    expect(rem.nextDueAt(db, now)).toBe(now + 3600);
    rem.snooze(db, a, now + 600);
    expect(rem.due(db, now)).toEqual([]);
    expect(rem.nextDueAt(db, now)).toBe(now + 600);
    expect(rem.due(db, now + 601).length).toBe(1);
    expect(rem.effectiveAt(rem.get(db, a)!)).toBe(now + 600);
    rem.markShown(db, a);
    rem.markShown(db, a);
    const shown = rem.get(db, a)!;
    expect(shown.max_shows).toBe(rem.MAX_SHOWS_DEFAULT);
    expect(rem.needsReview(shown)).toBe(true);
    rem.dismiss(db, a);
    expect(rem.get(db, a)!.done_at).not.toBeNull();
    expect(rem.upcoming(db, now, 10)[0].id).toBe(b);
    expect(rem.nextDueAt(db, now + 7200)).toBeNull();
  });

  it('un recordatorio repetido salta hacia delante desde hoy', async () => {
    const db = await Database.create(() => {});
    // Vencido hace 10 días, repetición diaria: al cerrarlo salta a mañana, no a hace 9 días.
    const old = nowTs() - 10 * 86_400;
    const id = rem.create(db, 'Agua a las plantas', old, DAILY, null, null);
    rem.dismiss(db, id);
    const r = rem.get(db, id)!;
    expect(r.done_at).toBeNull();
    expect(tsToDay(r.due_at)).toBe(addDays(today(), 1));
    expect(r.shown_count).toBe(0);
    // Conserva la hora del aviso original.
    const d0 = new Date(old * 1000), d1 = new Date(r.due_at * 1000);
    expect([d1.getHours(), d1.getMinutes()]).toEqual([d0.getHours(), d0.getMinutes()]);
  });

  it('referencias, repetición, reprogramar, archivar, borrar', async () => {
    const db = await Database.create(() => {});
    const now = 1_700_000_000;
    const a = rem.create(db, 'Tarea', now, null, 'task', 7);
    const b = rem.create(db, 'Otra', now + 10, null, 'task', 7);
    expect(rem.forRef(db, 'task', 7).map((r) => r.id)).toEqual([a, b]);
    rem.setRepeat(db, a, every(2, 'weeks'));
    expect(rem.get(db, a)!.repeat).toEqual(every(2, 'weeks'));
    rem.markShown(db, a);
    rem.snooze(db, a, now + 5);
    rem.reschedule(db, a, now + 100);
    expect(rem.get(db, a)).toMatchObject({ due_at: now + 100, snoozed_until: null, shown_count: 0 });
    rem.archive(db, a);
    expect(rem.forRef(db, 'task', 7).map((r) => r.id)).toEqual([b]);
    expect(rem.due(db, now + 1000).map((r) => r.id)).toEqual([b]);
    rem.delete(db, b);
    expect(rem.get(db, b)).toBeNull();
    expect(() => rem.dismiss(db, b)).not.toThrow();
  });
});
