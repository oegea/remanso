import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import * as diary from './diary';

describe('diario', () => {
  it('crear, editar, listar, borrar', async () => {
    const db = await Database.create(() => {});
    const id = diary.create(db);
    expect(diary.isEmpty(db, id)).toBe(true);
    diary.saveBody(db, id, 'Un título', '# Encabezado\n\nPrimera frase del día.');
    const e = diary.get(db, id)!;
    expect(e.title).toBe('Un título');
    expect(diary.isEmpty(db, id)).toBe(false);
    const l = diary.list(db, 0, 10);
    expect(l.length).toBe(1);
    expect(l[0].preview).toBe('Encabezado');
    expect(l[0].words).toBe(5);
    expect(diary.count(db)).toBe(1);
    diary.delete(db, id);
    expect(diary.get(db, id)).toBeNull();
    expect(diary.count(db)).toBe(0);
  });

  it('varias entradas por día, ordenadas', async () => {
    const db = await Database.create(() => {});
    const a = diary.create(db);
    const b = diary.create(db);
    db.run('UPDATE diary_entries SET created_at = created_at + 10 WHERE id = ?1', [b]);
    const l = diary.list(db, 0, 10);
    expect(l.map((e) => e.id)).toEqual([b, a]);
    expect(diary.daysWithEntries(db, '2000-01-01', '2999-12-31').length).toBe(1);
    expect(diary.lastEntryDay(db)).toBe(l[0].day);
  });

  it('título vacío se guarda como NULL', async () => {
    const db = await Database.create(() => {});
    const id = diary.create(db);
    diary.saveBody(db, id, '   ', 'x');
    expect(diary.get(db, id)!.title).toBeNull();
  });

  it('objetivo y vista previa', async () => {
    const db = await Database.create(() => {});
    const id = diary.create(db);
    diary.saveBody(db, id, null, '\n\n> - cita larga');
    diary.setGoal(db, id, 7);
    expect(diary.get(db, id)!.goal_id).toBe(7);
    expect(diary.forGoal(db, 7, 5)[0].preview).toBe('cita larga');
    expect(diary.previewOf('a'.repeat(130))).toBe('a'.repeat(120) + '…');
    expect(diary.wordCount('# - hola, mundo 3')).toBe(3);
  });
});
