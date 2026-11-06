import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { session } from '../app/session';
import { bumpData, useDataVersion } from '../app/useSession';
import * as diary from '../domain/diary';
import { fmtDateShort, fmtTime } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { T } from '../text/texts';
import { plural } from '../text/plural';

export function DiaryList() {
  const dataVersion = useDataVersion();
  const [, navigate] = useLocation();
  const [limit, setLimit] = useState(60);
  const db = session.db!;
  const entries = useMemo(() => diary.list(db, 0, limit), [db, dataVersion, limit]);
  const total = diary.count(db);

  const create = () => {
    const id = diary.create(db);
    bumpData();
    navigate(`/diario/${id}?nueva=1`);
  };

  let lastDay = '';
  return (
    <div className="screen">
      <Topbar title={T.DIARY} subtitle={total ? plural(total, 'entrada', 'entradas') : undefined}
        actions={<button className="btn btn-primary" onClick={create}><Icon name="plus" /> Escribir</button>} />
      <div className="content screen-body">
        {entries.length === 0 ? (
          <div className="empty">
            <p>{T.DIARY_EMPTY[0]}</p>
            <p>Toca «Escribir» para empezar. No hay plantilla ni preguntas: escribe lo que quieras.</p>
          </div>
        ) : (
          <div className="list" role="list">
            {entries.map((e) => {
              const head = e.day !== lastDay ? fmtDateShort(e.day) : null;
              lastDay = e.day;
              return (
                <div key={e.id} role="listitem">
                  {head && <div className="list-head">{head}</div>}
                  <Link href={`/diario/${e.id}`} className="entry-row">
                    <div className="row">
                      <span className="t-foot t-muted num">{fmtTime(e.created_at)}</span>
                      {e.title && <span className="title ellipsis">{e.title}</span>}
                      <span className="grow" />
                      <span className="t-foot t-faint num">{plural(e.words, 'palabra', 'palabras')}</span>
                    </div>
                    {e.preview && <div className="preview">{e.preview}</div>}
                  </Link>
                </div>
              );
            })}
            {entries.length >= limit && entries.length < total && (
              <button className="btn btn-text" onClick={() => setLimit(limit + 100)}>Ver más</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
