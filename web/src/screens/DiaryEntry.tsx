import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useSearch } from 'wouter';
import { session } from '../app/session';
import { bumpData, useSession } from '../app/useSession';
import * as diary from '../domain/diary';
import * as tags from '../domain/tags';
import { fmtDateLong, fmtDateCompact, fmtTime, today } from '../domain/dates';
import { TextEditor, WordCount, ReadView, useAutosave } from '../ui/Editor';
import { Icon } from '../ui/Icon';
import { Prompt, Confirm, Sheet } from '../ui/Sheet';
import { HELP } from '../text/help';
import { announce } from '../ui/Live';
import { T } from '../text/texts';

/** Editor a pantalla completa: barra fija arriba, texto que crece abajo. */
export function DiaryEntry() {
  const { id: idStr } = useParams<{ id: string }>();
  const id = Number(idStr);
  const isNew = useSearch().includes('nueva=1');
  const [, navigate] = useLocation();
  const s = useSession();
  const db = session.db!;
  const entry = useMemo(() => diary.get(db, id), [db, id]);
  const [text, setText] = useState(entry?.body ?? '');
  const [title, setTitle] = useState(entry?.title ?? '');
  // Últimos valores, para que los diálogos y el autoguardado nunca usen un cierre viejo.
  const textRef = useRef(text);
  const titleRef = useRef(title);
  const [tagList, setTagList] = useState<string[]>(() => (entry ? tags.tagsOf(db, 'diary', id) : []));
  const [reading, setReading] = useState(false);
  const [sheet, setSheet] = useState<null | 'options' | 'tags' | 'delete'>(null);

  const save = useCallback((t: string) => {
    diary.saveBody(db, id, titleRef.current || null, t);
    bumpData();
  }, [db, id]);
  const { schedule, flush } = useAutosave(save);

  useEffect(() => {
    if (!entry) navigate('/diario');
  }, [entry, navigate]);

  const close = () => {
    flush();
    if (diary.isEmpty(db, id)) {
      diary.delete(db, id);
    }
    bumpData();
    navigate('/diario');
  };

  if (!entry) return null;
  const saved = s.saveState === 'saved' || s.saveState === 'idle';

  return (
    <div className="editor-shell">
      <header className="topbar">
        <div className="content editor-top">
          <button className="btn btn-text editor-back" onClick={close}><Icon name="back" /> Listo</button>
          <div className="editor-title">
            <input className="title-input is-compact" value={title} placeholder={fmtDateLong(entry.day)} aria-label={HELP.EDITOR_TITLE_LABEL} title={HELP.EDITOR_TITLE_HINT}
              onChange={(e) => { const v = e.target.value; setTitle(v); titleRef.current = v.trim(); schedule(textRef.current); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); flush(); (e.target as HTMLInputElement).blur(); } }} />
            <div className="editor-meta">
              {title && <><span>{fmtDateCompact(entry.day, today())}</span><span>·</span></>}
              <span>{fmtTime(entry.created_at)}</span>
              <span>·</span>
              <WordCount text={text} />
              <span>·</span>
              <span aria-live="polite">{saved ? 'Guardado' : 'Guardando…'}</span>
            </div>
          </div>
          <div className="editor-actions">
            <button className="btn btn-icon" aria-label={reading ? 'Editar' : 'Leer'} aria-pressed={reading} onClick={() => { flush(); setReading(!reading); }}><Icon name={reading ? 'edit' : 'eye'} /></button>
            <button className="btn btn-icon" aria-label={HELP.DIARY_OPTIONS} onClick={() => setSheet('options')}><Icon name="more" /></button>
          </div>
        </div>
      </header>
      <div className="editor-body">
        {reading ? <ReadView text={text} /> : (
          <TextEditor value={text} autoFocus placeholder="Escribe lo que quieras. Se guarda solo." onChange={(v) => { textRef.current = v; setText(v); schedule(v); }} />
        )}
      </div>
      <Sheet open={sheet === 'options'} onClose={() => setSheet(null)} title={HELP.DIARY_OPTIONS}>
        <div className="list">
          <button className="list-item" onClick={() => setSheet('tags')}><Icon name="tag" className="t-muted" /><span className="grow"><span>{HELP.DIARY_TAGS}</span><span className="meta" style={{ display: 'block' }}>{tagList.length ? tagList.map((t) => '#' + t).join(' ') : HELP.DIARY_TAGS_NONE}</span></span><Icon name="forward" className="t-faint" /></button>
          {!isNew && <button className="list-item" style={{ color: 'var(--danger)' }} onClick={() => setSheet('delete')}><Icon name="trash" /><span className="grow">{HELP.DIARY_DELETE}</span></button>}
        </div>
        <p className="t-foot t-muted" style={{ marginTop: 12 }}>{HELP.EDITOR_TITLE_HINT}</p>
      </Sheet>
      <Prompt open={sheet === 'tags'} onClose={() => setSheet(null)} title={T.DIARY_TAGS_PROMPT} initial={tagList.join(' ')} help="Separadas por espacios o comas." onSubmit={(v) => { const p = tags.parseTags(v); tags.setTags(db, 'diary', id, p); setTagList(p); bumpData(); }} />
      <Confirm open={sheet === 'delete'} onClose={() => setSheet(null)} destructive title="¿Borrar esta entrada?" body={T.DIARY_DELETE_CONFIRM} confirmLabel="Borrar"
        onConfirm={() => { diary.delete(db, id); bumpData(); announce('Entrada borrada.'); navigate('/diario'); }} />
    </div>
  );
}
