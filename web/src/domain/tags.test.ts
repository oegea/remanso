import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { allTags, parseTags, setTags, tagsOf } from './tags';

describe('etiquetas', () => {
  it('ida y vuelta y limpieza', async () => {
    const db = await Database.create(() => {});
    setTags(db, 'diary', 1, parseTags('Trabajo, #sueño  salud'));
    expect(tagsOf(db, 'diary', 1)).toEqual(['salud', 'sueño', 'trabajo']);
    setTags(db, 'diary', 1, parseTags('salud'));
    expect(allTags(db)).toEqual([['salud', 1]]);
  });
  it('analiza etiquetas', () => {
    expect(parseTags('a, b c #d')).toEqual(['a', 'b', 'c', 'd']);
    expect(parseTags('  ,, ')).toEqual([]);
  });
});
