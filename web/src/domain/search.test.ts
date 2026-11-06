import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import * as diary from './diary';
import * as notebooks from './notebooks';
import { ftsQuery, searchAll, searchDiary, searchNotes } from './search';

describe('búsqueda', () => {
  it('la consulta se sanea', () => {
    expect(ftsQuery('hola mundo')).toBe('"hola"* "mundo"*');
    expect(ftsQuery('a"b OR NOT')).toBe('"ab"* "OR"* "NOT"*');
    expect(ftsQuery('   ')).toBeNull();
  });

  it('encuentra en diario y notas, con y sin tildes', async () => {
    const db = await Database.create(() => {});
    const e = diary.create(db);
    diary.saveBody(db, e, null, 'Hoy he dormido mejor que ayer, la camión... no, el camión pasó tarde.');
    const nb = notebooks.createNotebook(db, 'Casa');
    const n = notebooks.createNote(db, nb, 'Sueño');
    notebooks.saveNote(db, n, 'Sueño', 'Rutina para dormir: luz tenue, sin pantallas.');

    const hits = searchAll(db, 'dormi', 10);
    expect(hits.length).toBe(2);
    expect(hits[0]).toMatchObject({ kind: 'diary', id: e });
    expect(hits[1]).toMatchObject({ kind: 'note', title: 'Sueño', notebook: 'Casa' });
    expect(hits[0].snippet).toContain('dormido');
    // Sin tilde también encuentra «camión».
    expect(searchDiary(db, 'camion', 10).length).toBe(1);
    expect(searchNotes(db, 'dormir', 10).length).toBe(1);
    // Sintaxis FTS no se interpreta.
    expect(searchAll(db, 'dormido OR', 10)).toEqual([]);
    expect(searchAll(db, 'col:x', 10)).toEqual([]);
  });
});
