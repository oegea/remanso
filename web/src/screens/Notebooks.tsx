import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { session } from '../app/session';
import { bumpData, useDataVersion } from '../app/useSession';
import * as nb from '../domain/notebooks';
import { fmtDateCompact, tsToDay } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Prompt, Confirm, Choice } from '../ui/Sheet';
import { announce } from '../ui/Live';
import { T } from '../text/texts';

export function NotebookList() {
  const dataVersion = useDataVersion();
  const db = session.db!;
  const [showArchived, setShowArchived] = useState(false);
  const books = useMemo(() => nb.listNotebooks(db, showArchived), [db, dataVersion, showArchived]);
  const [sheet, setSheet] = useState<null | 'new' | { rename: nb.Notebook } | { del: nb.Notebook } | { menu: nb.Notebook }>(null);
  const [, navigate] = useLocation();
  const menuFor = sheet && typeof sheet === 'object' && 'menu' in sheet ? sheet.menu : null;
  return (
    <div className="screen">
      <Topbar title={T.NOTEBOOKS} actions={<button className="btn btn-primary" onClick={() => setSheet('new')}><Icon name="plus" /> Nuevo</button>} />
      <div className="content screen-body">
        {books.length === 0 ? (
          <div className="empty"><p>{T.NOTEBOOKS_EMPTY[0]}</p><p>Un cuaderno agrupa notas: ideas, un proyecto, listas, lo que quieras.</p></div>
        ) : (
          <div className="list">
            {books.map((b) => (
              <div key={b.id} className="list-item">
                <Link href={`/cuadernos/${b.id}`} className="grow" style={{ color: b.archived ? 'var(--ink-2)' : 'var(--ink)' }}>
                  <div>{b.name}</div>
                  <div className="meta">{b.archived ? T.NOTEBOOK_ARCHIVED + ' · ' : ''}{b.note_count} {T.NOTES_COUNT}</div>
                </Link>
                <button className="btn btn-icon" aria-label={`Opciones de ${b.name}`} onClick={() => setSheet({ menu: b })}><Icon name="more" /></button>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-text" style={{ marginTop: 16 }} onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Ocultar archivados' : 'Mostrar archivados'}</button>
      </div>
      <Prompt open={sheet === 'new'} onClose={() => setSheet(null)} title={T.NOTEBOOK_NAME_PROMPT} submitLabel="Crear"
        onSubmit={(v) => { if (v.trim()) { const id = nb.createNotebook(db, v); bumpData(); navigate(`/cuadernos/${id}`); } }} />
      <Choice open={!!menuFor} onClose={() => setSheet(null)} title={menuFor?.name ?? ''} options={['Renombrar', menuFor?.archived ? T.UNARCHIVE : T.ARCHIVE, 'Borrar cuaderno y notas']}
        onPick={(i) => {
          if (!menuFor) return;
          if (i === 0) setSheet({ rename: menuFor });
          else if (i === 1) { nb.setNotebookArchived(db, menuFor.id, !menuFor.archived); bumpData(); }
          else setSheet({ del: menuFor });
        }} />
      <Prompt open={!!(sheet && typeof sheet === 'object' && 'rename' in sheet)} onClose={() => setSheet(null)} title={T.NOTEBOOK_NAME_PROMPT}
        initial={sheet && typeof sheet === 'object' && 'rename' in sheet ? sheet.rename.name : ''}
        onSubmit={(v) => { if (sheet && typeof sheet === 'object' && 'rename' in sheet && v.trim()) { nb.renameNotebook(db, sheet.rename.id, v, sheet.rename.description); bumpData(); } }} />
      <Confirm open={!!(sheet && typeof sheet === 'object' && 'del' in sheet)} onClose={() => setSheet(null)} destructive title="¿Borrar el cuaderno?" body={T.NOTEBOOK_DELETE_CONFIRM} confirmLabel="Borrar"
        onConfirm={() => { if (sheet && typeof sheet === 'object' && 'del' in sheet) { nb.deleteNotebook(db, sheet.del.id); bumpData(); announce('Cuaderno borrado.'); } }} />
    </div>
  );
}

export function NoteList() {
  const dataVersion = useDataVersion();
  const { nb: nbStr } = useParams<{ nb: string }>();
  const nbId = Number(nbStr);
  const db = session.db!;
  const [, navigate] = useLocation();
  const [showArchived, setShowArchived] = useState(false);
  const book = useMemo(() => nb.getNotebook(db, nbId), [db, dataVersion, nbId]);
  const notes = useMemo(() => nb.listNotes(db, nbId, showArchived), [db, dataVersion, nbId, showArchived]);
  const [sheet, setSheet] = useState<null | 'new'>(null);
  if (!book) return null;
  return (
    <div className="screen">
      <Topbar title={book.name} back="/cuadernos" actions={<button className="btn btn-primary" onClick={() => setSheet('new')}><Icon name="plus" /> Nota</button>} />
      <div className="content screen-body">
        {notes.length === 0 ? (
          <div className="empty"><p>{T.NOTES_EMPTY[0]}</p><p>Toca «Nota» para escribir la primera.</p></div>
        ) : (
          <div className="list">
            {notes.map((n) => (
              <Link key={n.id} href={`/cuadernos/${nbId}/${n.id}`} className="entry-row">
                <div className="row">
                  {n.pinned && <Icon name="pin" size={14} className="t-muted" aria-label={T.NOTE_PINNED} />}
                  <span className="title ellipsis" style={{ color: n.archived ? 'var(--ink-2)' : undefined }}>{n.title || '(sin título)'}</span>
                  <span className="grow" />
                  <span className="t-foot t-faint">{fmtDateCompact(tsToDay(n.updated_at))}</span>
                </div>
                {n.preview && <div className="preview">{n.preview}</div>}
              </Link>
            ))}
          </div>
        )}
        <button className="btn btn-text" style={{ marginTop: 16 }} onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Ocultar archivadas' : 'Mostrar archivadas'}</button>
      </div>
      <Prompt open={sheet === 'new'} onClose={() => setSheet(null)} title={T.NOTE_TITLE_PROMPT} submitLabel="Crear"
        onSubmit={(v) => { const id = nb.createNote(db, nbId, v); bumpData(); navigate(`/cuadernos/${nbId}/${id}?nueva=1`); }} />
    </div>
  );
}
