/** Búsqueda local con FTS5 (dentro de la base cifrada). */
import type { Database } from '../db/sqlite';

export type Id = number;

export type Hit =
  | { kind: 'diary'; id: Id; day: string; title: string | null; snippet: string }
  | { kind: 'note'; id: Id; notebook_id: Id; notebook: string; title: string; snippet: string };

/**
 * Convierte texto libre en una consulta FTS5 segura: cada término entre
 * comillas y con prefijo, para que la sintaxis del usuario nunca se interprete.
 */
export function ftsQuery(input: string): string | null {
  const terms = input
    .split(/\s+/)
    .map((t) => t.replace(/"/g, ''))
    .filter((t) => t !== '')
    .map((t) => `"${t}"*`);
  return terms.length === 0 ? null : terms.join(' ');
}

interface DiaryRow {
  id: Id;
  day: string;
  title: string | null;
  snippet: string;
}
interface NoteRow {
  id: Id;
  notebook_id: Id;
  notebook: string;
  title: string;
  snippet: string;
}

export function searchAll(db: Database, input: string, limit: number): Hit[] {
  const q = ftsQuery(input);
  if (q === null) return [];
  const out: Hit[] = [];
  const diary = db.all<DiaryRow>(
    `SELECT e.id, e.day, e.title, snippet(diary_fts, 1, '', '', '…', 14) AS snippet
     FROM diary_fts JOIN diary_entries e ON e.id = diary_fts.rowid
     WHERE diary_fts MATCH ?1 AND e.deleted_at IS NULL ORDER BY rank LIMIT ?2`,
    [q, limit],
  );
  for (const r of diary) out.push({ kind: 'diary', id: r.id, day: r.day, title: r.title, snippet: clean(r.snippet) });
  const notes = db.all<NoteRow>(
    `SELECT n.id, n.notebook_id, b.name AS notebook, n.title, snippet(notes_fts, 1, '', '', '…', 14) AS snippet
     FROM notes_fts JOIN notes n ON n.id = notes_fts.rowid JOIN notebooks b ON b.id = n.notebook_id
     WHERE notes_fts MATCH ?1 ORDER BY rank LIMIT ?2`,
    [q, limit],
  );
  for (const r of notes) {
    out.push({ kind: 'note', id: r.id, notebook_id: r.notebook_id, notebook: r.notebook, title: r.title, snippet: clean(r.snippet) });
  }
  return out;
}

export function searchDiary(db: Database, input: string, limit: number): Hit[] {
  return searchAll(db, input, limit).filter((h) => h.kind === 'diary');
}

export function searchNotes(db: Database, input: string, limit: number): Hit[] {
  return searchAll(db, input, limit).filter((h) => h.kind === 'note');
}

function clean(s: string): string {
  return s.split(/\s+/).filter((w) => w !== '').join(' ');
}
