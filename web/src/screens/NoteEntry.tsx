import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { session } from '../app/session';
import { bumpData, useSession } from '../app/useSession';
import * as nb from '../domain/notebooks';
import { TextEditor, WordCount, ReadView, useAutosave } from '../ui/Editor';
import { Icon } from '../ui/Icon';
import { Confirm, Choice, Sheet } from '../ui/Sheet';
import { HELP } from '../text/help';
import { announce } from '../ui/Live';
import { T } from '../text/texts';

export function NoteEntry() {
  const { nb: nbStr, id: idStr } = useParams<{ nb: string; id: string }>();
  const nbId = Number(nbStr);
  const id = Number(idStr);
  const [, navigate] = useLocation();
  const s = useSession();
  const db = session.db!;
  const note = useMemo(() => nb.getNote(db, id), [db, id]);
  const [text, setText] = useState(note?.body ?? '');
  const [title, setTitle] = useState(note?.title ?? '');
  const textRef = useRef(text);
  const titleRef = useRef(title);
  const [reading, setReading] = useState(false);
  const [sheet, setSheet] = useState<null | 'options' | 'delete' | 'links' | 'move'>(null);
  const save = useCallback((t: string) => { nb.saveNote(db, id, titleRef.current, t); bumpData(); }, [db, id]);
  const { schedule, flush } = useAutosave(save);
  if (!note) { navigate(`/cuadernos/${nbId}`); return null; }
  const links = nb.wikiLinks(text);
  const books = nb.listNotebooks(db, false);
  const close = () => {
    flush();
    if (nb.isNoteEmpty(db, id)) nb.deleteNote(db, id);
    bumpData();
    navigate(`/cuadernos/${nbId}`);
  };
  const follow = (t: string) => {
    flush();
    const target = nb.findNoteByTitle(db, t);
    if (target) { const n = nb.getNote(db, target); navigate(`/cuadernos/${n?.notebook_id ?? nbId}/${target}`); }
    else announce(T.NOTE_LINK_MISSING);
  };
  const saved = s.saveState === 'saved' || s.saveState === 'idle';
  return (
    <div className="editor-shell">
      <header className="topbar">
        <div className="content editor-top">
          <button className="btn btn-text editor-back" onClick={close}><Icon name="back" /> Listo</button>
          <div className="editor-title">
            <input className="title-input is-compact" value={title} placeholder={HELP.NOTE_TITLE_PLACEHOLDER} aria-label={HELP.EDITOR_TITLE_LABEL} title={HELP.EDITOR_TITLE_HINT}
              onChange={(e) => { const v = e.target.value; setTitle(v); titleRef.current = v.trim(); schedule(textRef.current); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); flush(); (e.target as HTMLInputElement).blur(); } }} />
            <div className="editor-meta"><WordCount text={text} /><span>·</span><span aria-live="polite">{saved ? 'Guardado' : 'Guardando…'}</span>{note.pinned && <><span>·</span><span>{HELP.NOTE_PINNED}</span></>}{note.archived && <><span>·</span><span>{HELP.NOTE_ARCHIVED}</span></>}</div>
          </div>
          <div className="editor-actions">
            <button className="btn btn-icon" aria-label={reading ? 'Editar' : 'Leer'} aria-pressed={reading} onClick={() => { flush(); setReading(!reading); }}><Icon name={reading ? 'edit' : 'eye'} /></button>
            <button className="btn btn-icon" aria-label={HELP.NOTE_OPTIONS} onClick={() => setSheet('options')}><Icon name="more" /></button>
          </div>
        </div>
      </header>
      <div className="editor-body">
        {reading ? <ReadView text={text} /> : <TextEditor value={text} autoFocus placeholder="Escribe. Usa [[Título]] para enlazar otra nota." onChange={(v) => { textRef.current = v; setText(v); schedule(v); }} />}
      </div>
      <Sheet open={sheet === 'options'} onClose={() => setSheet(null)} title={HELP.NOTE_OPTIONS}>
        <div className="list">
          <button className="list-item" onClick={() => { nb.setNotePinned(db, id, !note.pinned); bumpData(); setSheet(null); announce(note.pinned ? 'Nota soltada.' : 'Nota fijada arriba.'); }}><Icon name="pin" className="t-muted" /><span className="grow"><span>{note.pinned ? HELP.NOTE_UNPIN : HELP.NOTE_PIN}</span><span className="meta" style={{ display: 'block' }}>{HELP.NOTE_PIN_HELP}</span></span></button>
          {links.length > 0 && <button className="list-item" onClick={() => setSheet('links')}><Icon name="forward" className="t-muted" /><span className="grow"><span>{HELP.NOTE_LINKS} ({links.length})</span><span className="meta" style={{ display: 'block' }}>{links.join(' · ')}</span></span><Icon name="forward" className="t-faint" /></button>}
          <button className="list-item" onClick={() => setSheet('move')}><Icon name="notebooks" className="t-muted" /><span className="grow">{HELP.NOTE_MOVE}</span><Icon name="forward" className="t-faint" /></button>
          <button className="list-item" onClick={() => { nb.setNoteArchived(db, id, !note.archived); bumpData(); setSheet(null); announce(note.archived ? 'Nota recuperada.' : 'Nota archivada.'); }}><Icon name="archive" className="t-muted" /><span className="grow"><span>{note.archived ? HELP.NOTE_UNARCHIVE : HELP.NOTE_ARCHIVE}</span><span className="meta" style={{ display: 'block' }}>{HELP.NOTE_ARCHIVE_HELP}</span></span></button>
          <button className="list-item" style={{ color: 'var(--danger)' }} onClick={() => setSheet('delete')}><Icon name="trash" /><span className="grow">{HELP.NOTE_DELETE}</span></button>
        </div>
        <p className="t-foot t-muted" style={{ marginTop: 12 }}>{HELP.EDITOR_TITLE_HINT}</p>
      </Sheet>
      <Choice open={sheet === 'links'} onClose={() => setSheet(null)} title="Abrir enlace" options={links} onPick={(i) => follow(links[i])} />
      <Choice open={sheet === 'move'} onClose={() => setSheet(null)} title="Mover a" options={books.map((b) => b.name)} onPick={(i) => { nb.moveNote(db, id, books[i].id); bumpData(); navigate(`/cuadernos/${books[i].id}/${id}`); }} />
      <Confirm open={sheet === 'delete'} onClose={() => setSheet(null)} destructive title="¿Borrar esta nota?" body={T.NOTE_DELETE_CONFIRM} confirmLabel="Borrar" onConfirm={() => { nb.deleteNote(db, id); bumpData(); navigate(`/cuadernos/${nbId}`); }} />
    </div>
  );
}
