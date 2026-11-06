/**
 * Copias de seguridad (contenedor cifrado) y exportación en claro (zip con
 * Markdown y JSON). La exportación sólo se ejecuta tras doble confirmación.
 */
import { zipSync, strToU8 } from 'fflate';
import type { Database } from '../db/sqlite';
import { fmtTime } from '../domain/dates';

export function backupFileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `remanso-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.remanso`;
}

export function download(name: string, bytes: Uint8Array, type = 'application/octet-stream') {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function safeName(s: string): string {
  const out = s.replace(/[^\p{L}\p{N} _-]/gu, '_').trim().replace(/ /g, '-');
  return (out || 'sin-nombre').slice(0, 60);
}

/** Zip en claro: diario/AAAA/AAAA-MM-DD-id.md, cuadernos/<cuaderno>/<id>-<título>.md, datos.json. */
export function exportPlaintextZip(db: Database): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const entries = db.all<{ id: number; day: string; created_at: number; title: string | null; body: string }>(
    'SELECT id, day, created_at, title, body FROM diary_entries WHERE deleted_at IS NULL ORDER BY day, created_at',
  );
  for (const e of entries) {
    const md = `# ${e.day}${e.title ? ' · ' + e.title : ''}\n\n_${e.day} ${fmtTime(e.created_at)}_\n\n${e.body}\n`;
    files[`diario/${e.day.slice(0, 4)}/${e.day}-${e.id}.md`] = strToU8(md);
  }
  const notes = db.all<{ id: number; title: string; body: string; nb: string }>(
    'SELECT n.id, n.title, n.body, b.name AS nb FROM notes n JOIN notebooks b ON b.id = n.notebook_id ORDER BY b.position, n.id',
  );
  for (const n of notes) {
    const name = n.title ? `${n.id}-${safeName(n.title)}.md` : `${n.id}.md`;
    const md = n.title ? `# ${n.title}\n\n${n.body}\n` : n.body;
    files[`cuadernos/${safeName(n.nb)}/${name}`] = strToU8(md);
  }
  files['datos.json'] = strToU8(JSON.stringify(dumpJson(db), null, 2));
  return zipSync(files, { level: 6 });
}

export function dumpJson(db: Database): Record<string, unknown> {
  const tables = db
    .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%' ORDER BY name")
    .map((r) => r.name)
    .filter((t) => !t.endsWith('_fts'));
  const data: Record<string, unknown[]> = {};
  for (const t of tables) data[t] = db.all(`SELECT * FROM "${t}"`);
  return {
    formato: 1,
    aplicacion: 'remanso-web 0.1.0',
    esquema: db.version(),
    exportado_en: Math.floor(Date.now() / 1000),
    tablas: data,
  };
}
