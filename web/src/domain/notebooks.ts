/** Cuadernos y notas. */
import type { Database } from '../db/sqlite';
import { nowTs } from './dates';
import { previewOf } from './diary';

export type Id = number;

export interface Notebook {
  id: Id;
  name: string;
  description: string;
  position: number;
  created_at: number;
  archived: boolean;
  note_count: number;
}

export interface Note {
  id: Id;
  notebook_id: Id;
  title: string;
  body: string;
  pinned: boolean;
  created_at: number;
  updated_at: number;
  archived: boolean;
}

export interface NoteSummary {
  id: Id;
  notebook_id: Id;
  title: string;
  preview: string;
  pinned: boolean;
  updated_at: number;
  archived: boolean;
}

interface NotebookRow {
  id: Id;
  name: string;
  description: string;
  position: number;
  created_at: number;
  archived_at: number | null;
  note_count: number;
}

const NOTEBOOK_SELECT = `SELECT b.id, b.name, b.description, b.position, b.created_at, b.archived_at,
  (SELECT count(*) FROM notes n WHERE n.notebook_id = b.id AND n.archived_at IS NULL) AS note_count
  FROM notebooks b`;

function mapNotebook(r: NotebookRow): Notebook {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    position: r.position,
    created_at: r.created_at,
    archived: r.archived_at !== null,
    note_count: r.note_count,
  };
}

export function createNotebook(db: Database, name: string): Id {
  const pos = db.scalar<number>('SELECT coalesce(max(position), 0) + 1 FROM notebooks') ?? 1;
  return db.insert('INSERT INTO notebooks(name, position, created_at) VALUES (?1, ?2, ?3)', [name.trim(), pos, nowTs()]);
}

export function renameNotebook(db: Database, id: Id, name: string, description: string): void {
  db.run('UPDATE notebooks SET name = ?2, description = ?3 WHERE id = ?1', [id, name.trim(), description]);
}

export function setNotebookArchived(db: Database, id: Id, archived: boolean): void {
  db.run('UPDATE notebooks SET archived_at = ?2 WHERE id = ?1', [id, archived ? nowTs() : null]);
}

/** Borra el cuaderno y todas sus notas (irreversible; la UI pide confirmación). */
export function deleteNotebook(db: Database, id: Id): void {
  db.run('DELETE FROM notebooks WHERE id = ?1', [id]);
}

export function listNotebooks(db: Database, includeArchived: boolean): Notebook[] {
  const where = includeArchived ? '' : 'WHERE b.archived_at IS NULL';
  return db
    .all<NotebookRow>(`${NOTEBOOK_SELECT} ${where} ORDER BY b.archived_at IS NOT NULL, b.position, b.id`)
    .map(mapNotebook);
}

export function getNotebook(db: Database, id: Id): Notebook | null {
  const r = db.get<NotebookRow>(`${NOTEBOOK_SELECT} WHERE b.id = ?1`, [id]);
  return r ? mapNotebook(r) : null;
}

export function createNote(db: Database, notebookId: Id, title: string): Id {
  const now = nowTs();
  return db.insert("INSERT INTO notes(notebook_id, title, body, created_at, updated_at) VALUES (?1, ?2, '', ?3, ?3)", [
    notebookId,
    title.trim(),
    now,
  ]);
}

interface NoteRow {
  id: Id;
  notebook_id: Id;
  title: string;
  body: string;
  pinned: number;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

export function getNote(db: Database, id: Id): Note | null {
  const r = db.get<NoteRow>(
    'SELECT id, notebook_id, title, body, pinned, created_at, updated_at, archived_at FROM notes WHERE id = ?1',
    [id],
  );
  if (!r) return null;
  return {
    id: r.id,
    notebook_id: r.notebook_id,
    title: r.title,
    body: r.body,
    pinned: r.pinned !== 0,
    created_at: r.created_at,
    updated_at: r.updated_at,
    archived: r.archived_at !== null,
  };
}

export function saveNote(db: Database, id: Id, title: string, body: string): void {
  db.run('UPDATE notes SET title = ?2, body = ?3, updated_at = ?4 WHERE id = ?1', [id, title.trim(), body, nowTs()]);
}

export function setNotePinned(db: Database, id: Id, pinned: boolean): void {
  db.run('UPDATE notes SET pinned = ?2 WHERE id = ?1', [id, pinned ? 1 : 0]);
}

export function setNoteArchived(db: Database, id: Id, archived: boolean): void {
  db.run('UPDATE notes SET archived_at = ?2 WHERE id = ?1', [id, archived ? nowTs() : null]);
}

export function moveNote(db: Database, id: Id, notebookId: Id): void {
  db.run('UPDATE notes SET notebook_id = ?2 WHERE id = ?1', [id, notebookId]);
}

export function deleteNote(db: Database, id: Id): void {
  db.run('DELETE FROM notes WHERE id = ?1', [id]);
}

export function isNoteEmpty(db: Database, id: Id): boolean {
  const r = db.get<{ title: string; body: string }>('SELECT title, body FROM notes WHERE id = ?1', [id]);
  if (!r) throw new Error(`nota ${id} inexistente`);
  return r.title.trim() === '' && r.body.trim() === '';
}

interface NoteSummaryRow {
  id: Id;
  notebook_id: Id;
  title: string;
  head: string;
  pinned: number;
  updated_at: number;
  archived_at: number | null;
}

export function listNotes(db: Database, notebookId: Id, includeArchived: boolean): NoteSummary[] {
  const where = includeArchived ? '' : 'AND archived_at IS NULL';
  return db
    .all<NoteSummaryRow>(
      `SELECT id, notebook_id, title, substr(body, 1, 200) AS head, pinned, updated_at, archived_at FROM notes
       WHERE notebook_id = ?1 ${where} ORDER BY archived_at IS NOT NULL, pinned DESC, updated_at DESC`,
      [notebookId],
    )
    .map((r) => ({
      id: r.id,
      notebook_id: r.notebook_id,
      title: r.title,
      preview: previewOf(r.head),
      pinned: r.pinned !== 0,
      updated_at: r.updated_at,
      archived: r.archived_at !== null,
    }));
}

/**
 * Resuelve una referencia `[[Título]]` al id de nota con ese título (sin
 * distinguir mayúsculas). Devuelve la primera coincidencia no archivada.
 */
export function findNoteByTitle(db: Database, title: string): Id | null {
  return (
    db.scalar<Id>(
      'SELECT id FROM notes WHERE title = ?1 COLLATE NOCASE AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 1',
      [title.trim()],
    ) ?? null
  );
}

/** Extrae los enlaces `[[…]]` de un texto. */
export function wikiLinks(body: string): string[] {
  const out: string[] = [];
  let rest = body;
  for (;;) {
    const start = rest.indexOf('[[');
    if (start < 0) break;
    const after = rest.slice(start + 2);
    const end = after.indexOf(']]');
    if (end < 0) break;
    const t = after.slice(0, end).trim();
    if (t !== '' && !t.includes('\n')) out.push(t);
    rest = after.slice(end + 2);
  }
  return out;
}
