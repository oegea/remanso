import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import * as prompts from './prompts';

describe('preguntas de reflexión', () => {
  it('instalar, desactivar, responder', async () => {
    const db = await Database.create(() => {});
    expect(prompts.setEnabled(db, 'close')).toBe(false); // nada instalado por defecto
    expect(prompts.installSet(db, 'close')).toBe(3);
    expect(prompts.setEnabled(db, 'close')).toBe(true);
    const ps = prompts.list(db, 'close');
    expect(ps).toHaveLength(3);
    expect(ps[0].text).toBe('¿Qué pasó hoy que quieras recordar?');
    expect(ps[1].source_ref).toBe('tres_cosas_buenas');
    const a = prompts.answer(db, ps[0].id, 'Un paseo al atardecer', null, null);
    expect(a).toBeGreaterThan(0);
    expect(prompts.answers(db, ps[0].id, 5)[0].text).toBe('Un paseo al atardecer');
    prompts.disableSet(db, 'close');
    expect(prompts.setEnabled(db, 'close')).toBe(false);
    expect(prompts.installSet(db, 'close')).toBe(0); // reactivar no duplica
    expect(prompts.list(db, 'close')).toHaveLength(3);
    expect(prompts.list(db, 'weekly')).toHaveLength(0);
  });

  it('opciones semanales y SRBAI', async () => {
    const db = await Database.create(() => {});
    prompts.installSet(db, 'weekly');
    const w = prompts.list(db, 'weekly');
    expect(w).toHaveLength(6);
    expect(prompts.choices(w[4])).toEqual(['Sí', 'Algunos', 'No', 'No tengo']);
    expect(w[4].kind).toBe('choice');
    const ps = prompts.ensureSrbai(db, 7, 'Leer en el sofá');
    expect(ps).toHaveLength(4);
    expect(ps[0].text.startsWith('«Leer en el sofá»')).toBe(true);
    expect(ps[0].kind).toBe('scale');
    expect(prompts.choices(ps[0])).toEqual(['1', '5']);
    expect(prompts.ensureSrbai(db, 7, 'otro nombre')).toHaveLength(4); // no duplica
    expect(prompts.lastSrbaiDay(db, 7)).toBeNull();
    for (const p of ps) prompts.answer(db, p.id, '', 3, null);
    const h = prompts.srbaiHistory(db, 7);
    expect(h).toHaveLength(1);
    expect(h[0][1]).toBe(3);
    expect(prompts.lastSrbaiDay(db, 7)).not.toBeNull();
    expect(prompts.lastSrbaiDay(db, 8)).toBeNull();
  });

  it('crear, editar y archivar preguntas propias', async () => {
    const db = await Database.create(() => {});
    prompts.installSet(db, 'open');
    const id = prompts.create(db, '  ¿Qué agradezco hoy?  ', 'free', null, 'open', null);
    const l = prompts.list(db, 'open');
    expect(l).toHaveLength(3);
    expect(l[2].id).toBe(id);
    expect(l[2].text).toBe('¿Qué agradezco hoy?');
    expect(l[2].source_ref).toBe('usuario');
    expect(l[2].position).toBe(2);
    prompts.setText(db, id, 'Otra');
    prompts.archive(db, id);
    expect(prompts.list(db, 'open')).toHaveLength(2);
    expect(prompts.templates('goal_review')).toHaveLength(5);
    expect(prompts.templates('nada')).toHaveLength(0);
    expect(prompts.SCHEDULES.map(([k]) => k)).toEqual(['open', 'close', 'weekly']);
  });
});
