import { describe, it, expect } from 'vitest';
import { Database } from './sqlite';
import { CURRENT_VERSION } from './migrations';

describe('sqlite wasm', () => {
  it('crea el esquema, escribe, exporta y reimporta', async () => {
    let writes = 0;
    const db = await Database.create(() => writes++);
    expect(db.version()).toBe(CURRENT_VERSION);
    const id = db.insert("INSERT INTO diary_entries(created_at, updated_at, day, body) VALUES (1, 1, '2026-01-01', 'hola camión')", []);
    expect(id).toBe(1);
    expect(writes).toBeGreaterThan(0);
    // FTS5 con quitado de diacríticos.
    const n = db.scalar<number>("SELECT count(*) FROM diary_fts WHERE diary_fts MATCH 'camion'");
    expect(n).toBe(1);
    const bytes = db.export();
    expect(bytes.byteLength).toBeGreaterThan(4096);
    expect(new TextDecoder().decode(bytes.subarray(0, 15))).toBe('SQLite format 3');
    db.close();
    const db2 = await Database.fromBytes(bytes, () => {});
    expect(db2.get<{ body: string }>('SELECT body FROM diary_entries')?.body).toBe('hola camión');
    db2.check();
    db2.close();
  });

  it('rechaza esquemas más recientes', async () => {
    const db = await Database.create(() => {});
    db.run(`PRAGMA user_version = ${CURRENT_VERSION + 5}`);
    const bytes = db.export();
    db.close();
    await expect(Database.fromBytes(bytes, () => {})).rejects.toThrow(/más reciente/);
  });
});
