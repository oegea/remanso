import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { Database } from '../db/sqlite';
import { dumpJson, exportPlaintextZip } from './backup';

describe('exportación en claro', () => {
  it('genera Markdown por entrada y nota y un JSON de todas las tablas', async () => {
    const db = await Database.create(() => {});
    db.run("INSERT INTO diary_entries(created_at, updated_at, day, title, body) VALUES (1,1,'2026-03-04','Día','texto del diario')");
    db.run("INSERT INTO notebooks(name, created_at) VALUES ('Ideas / proyectos', 1)");
    db.run("INSERT INTO notes(notebook_id, title, body, created_at, updated_at) VALUES (1, 'Nota: uno', 'cuerpo', 1, 1)");
    const zip = exportPlaintextZip(db);
    const files = unzipSync(zip);
    const names = Object.keys(files);
    expect(names).toContain('diario/2026/2026-03-04-1.md');
    expect(names.some((n) => n.startsWith('cuadernos/Ideas-_-proyectos/1-Nota_-uno.md'))).toBe(true);
    expect(strFromU8(files['diario/2026/2026-03-04-1.md'])).toContain('texto del diario');
    const json = JSON.parse(strFromU8(files['datos.json']));
    expect(json.tablas.notes[0].title).toBe('Nota: uno');
    expect(json.tablas.diary_fts).toBeUndefined();
    expect(dumpJson(db).esquema).toBe(db.version());
    db.close();
  });
});
