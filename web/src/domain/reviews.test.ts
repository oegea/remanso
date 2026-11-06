import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { today, weekdayIndex } from './dates';
import * as prompts from './prompts';
import * as reviews from './reviews';

describe('sesiones de revisión', () => {
  it('sesiones y regla semanal', async () => {
    const db = await Database.create(() => {});
    const t = today();
    expect(reviews.guidedToday(db, t)).toBeNull();
    const id = reviews.start(db, 'close', null);
    expect(reviews.guidedToday(db, t)).toBeNull(); // sin completar no cuenta
    reviews.complete(db, id, '');
    expect(reviews.guidedToday(db, t)).toBe('close');
    expect(reviews.lastOfKind(db, 'close')).toBe(t);
    expect(reviews.lastOfKind(db, 'open')).toBeNull();
    expect(reviews.count(db, 'close')).toBe(1);
    expect(reviews.weeklyAvailable(db, t, 0)).toBe(false); // sin preguntas semanales activas
    prompts.installSet(db, 'weekly');
    expect(reviews.weeklyAvailable(db, t, 0)).toBe(true);
    expect(!reviews.weeklyAvailable(db, t, 6) || weekdayIndex(t) === 6).toBe(true);
    const w = reviews.start(db, 'weekly', null);
    reviews.complete(db, w, '');
    expect(reviews.weeklyAvailable(db, t, 0)).toBe(false);
    expect(reviews.emptyWeeklyStreak(db)).toBe(1);
  });

  it('racha de semanales vacías', async () => {
    const db = await Database.create(() => {});
    prompts.installSet(db, 'weekly');
    const p = prompts.list(db, 'weekly')[0];
    const w1 = reviews.start(db, 'weekly', null);
    prompts.answer(db, p.id, 'algo', null, w1);
    reviews.complete(db, w1, '');
    expect(reviews.emptyWeeklyStreak(db)).toBe(0);
    const w2 = reviews.start(db, 'weekly', null);
    reviews.complete(db, w2, '');
    const w3 = reviews.start(db, 'weekly', null);
    reviews.complete(db, w3, '');
    expect(reviews.emptyWeeklyStreak(db)).toBe(2);
    reviews.start(db, 'weekly', null); // sin completar: no cuenta
    expect(reviews.emptyWeeklyStreak(db)).toBe(2);
    expect(reviews.count(db, 'weekly')).toBe(3);
  });
});

describe('historial de sesiones', () => {
  it('sólo lista sesiones terminadas con respuestas, con pregunta y respuesta', async () => {
    const db = await Database.create(() => {});
    prompts.installSet(db, 'close');
    const [q1, q2] = prompts.list(db, 'close');
    const empty = reviews.start(db, 'close', null);
    reviews.complete(db, empty, '');
    const open = reviews.start(db, 'close', null);
    prompts.answer(db, q1.id, 'sin terminar', null, open); // sin completar: no cuenta
    const full = reviews.start(db, 'close', null);
    prompts.answer(db, q1.id, 'Un paseo', null, full);
    prompts.answer(db, q2.id, '', 4, full);
    reviews.complete(db, full, '');
    const h = reviews.history(db);
    expect(h.map((r) => r.id)).toEqual([full]);
    expect(h[0].kind).toBe('close');
    expect(h[0].answers).toEqual([
      { question: q1.text, text: 'Un paseo', value: null },
      { question: q2.text, text: '', value: 4 },
    ]);
  });
});

describe('hoy: una sesión de cada tipo, respuestas y «ahora no»', () => {
  it('doneToday, todayAnswers y dismiss', async () => {
    const db = await Database.create(() => {});
    const t = today();
    prompts.installSet(db, 'open');
    const [q1] = prompts.list(db, 'open');
    expect(reviews.doneToday(db, 'open', t)).toBe(false);
    expect(reviews.dismissed(db, 'open', t)).toBe(false);
    reviews.dismiss(db, 'open', t);
    expect(reviews.dismissed(db, 'open', t)).toBe(true);
    expect(reviews.dismissed(db, 'close', t)).toBe(false);
    const id = reviews.start(db, 'open', null);
    prompts.answer(db, q1.id, 'Acabar el informe', null, id);
    expect(reviews.todayAnswers(db, 'open', t)).toEqual([]); // sin completar no se muestra
    reviews.complete(db, id, '');
    expect(reviews.doneToday(db, 'open', t)).toBe(true);
    expect(reviews.doneToday(db, 'close', t)).toBe(false);
    expect(reviews.todayAnswers(db, 'open', t)).toEqual([{ question: q1.text, text: 'Acabar el informe', value: null }]);
  });
});
