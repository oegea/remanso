import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import * as nb from './notebooks';

describe('cuadernos y notas', () => {
  it('cuadernos y notas', async () => {
    const db = await Database.create(() => {});
    const book = nb.createNotebook(db, ' Ideas ');
    const n1 = nb.createNote(db, book, 'Primera');
    const n2 = nb.createNote(db, book, 'Segunda');
    nb.saveNote(db, n2, 'Segunda', 'Ver [[Primera]] y [[  Primera ]] y [[Inexistente]]');
    nb.setNotePinned(db, n2, true);
    const books = nb.listNotebooks(db, false);
    expect(books[0].name).toBe('Ideas');
    expect(books[0].note_count).toBe(2);
    expect(nb.getNotebook(db, book)?.note_count).toBe(2);
    const notes = nb.listNotes(db, book, false);
    expect(notes[0].id, 'las fijadas van primero').toBe(n2);
    const links = nb.wikiLinks(nb.getNote(db, n2)!.body);
    expect(links).toEqual(['Primera', 'Primera', 'Inexistente']);
    expect(nb.findNoteByTitle(db, 'primera')).toBe(n1);
    expect(nb.findNoteByTitle(db, 'Inexistente')).toBeNull();

    nb.setNoteArchived(db, n1, true);
    expect(nb.listNotes(db, book, false).length).toBe(1);
    expect(nb.listNotes(db, book, true).length).toBe(2);
    nb.setNotebookArchived(db, book, true);
    expect(nb.listNotebooks(db, false)).toEqual([]);
    expect(nb.listNotebooks(db, true).length).toBe(1);
    nb.deleteNotebook(db, book);
    expect(nb.getNote(db, n1), 'borrado en cascada').toBeNull();
  });

  it('vacía, mover, renombrar', async () => {
    const db = await Database.create(() => {});
    const a = nb.createNotebook(db, 'A');
    const b = nb.createNotebook(db, 'B');
    const n = nb.createNote(db, a, '');
    expect(nb.isNoteEmpty(db, n)).toBe(true);
    nb.moveNote(db, n, b);
    expect(nb.getNote(db, n)!.notebook_id).toBe(b);
    nb.renameNotebook(db, a, ' Alfa ', 'desc');
    expect(nb.getNotebook(db, a)!.name).toBe('Alfa');
    nb.deleteNote(db, n);
    expect(nb.getNote(db, n)).toBeNull();
    expect(nb.wikiLinks('[[ ]] [[a\nb]] [[sin cierre')).toEqual([]);
  });
});
