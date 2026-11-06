import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { session } from '../app/session';
import * as search from '../domain/search';
import { fmtDateCompact } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { T } from '../text/texts';

export function Search() {
  const db = session.db!;
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'diary' | 'notes'>('all');
  const hits = useMemo(() => {
    if (!q.trim()) return [];
    return scope === 'all' ? search.searchAll(db, q, 60) : scope === 'diary' ? search.searchDiary(db, q, 60) : search.searchNotes(db, q, 60);
  }, [db, q, scope]);
  return (
    <div className="screen">
      <Topbar title={T.SEARCH} />
      <div className="content screen-body stack">
        <div className="field">
          <label htmlFor="q" className="sr-only">{T.SEARCH_PROMPT}</label>
          <input id="q" className="input" type="search" autoFocus placeholder="Buscar en el diario y en los cuadernos" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="segments" role="tablist">
          {(['all', 'diary', 'notes'] as const).map((sc) => (
            <button key={sc} role="tab" aria-selected={scope === sc} className="segment" onClick={() => setScope(sc)}>{sc === 'all' ? 'Todo' : sc === 'diary' ? 'Diario' : 'Cuadernos'}</button>
          ))}
        </div>
        {q.trim() && hits.length === 0 && <p className="t-muted">{T.SEARCH_NONE}</p>}
        <div className="list">
          {hits.map((h) =>
            h.kind === 'diary' ? (
              <Link key={'d' + h.id} href={`/diario/${h.id}`} className="entry-row">
                <div className="row"><span className="t-foot t-muted">diario</span><span className="title">{fmtDateCompact(h.day)}{h.title ? ' · ' + h.title : ''}</span></div>
                <div className="preview">{h.snippet}</div>
              </Link>
            ) : (
              <Link key={'n' + h.id} href={`/cuadernos/${h.notebook_id}/${h.id}`} className="entry-row">
                <div className="row"><span className="t-foot t-muted">nota</span><span className="title">{h.notebook} · {h.title}</span></div>
                <div className="preview">{h.snippet}</div>
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
