/**
 * Episodios de impulso: lista descriptiva de lo registrado y comparación con el propio
 * pasado (Harkin et al., 2016: comparar con la referencia pasada d+ = 0,43; nunca con
 * otros, nunca con una puntuación). Sin porcentajes de «éxito» ni colores de fallo.
 */
import { useMemo, useState } from 'react';
import { session } from '../app/session';
import { useDataVersion } from '../app/useSession';
import * as imp from '../domain/impulses';
import * as goals from '../domain/goals';
import { fmtDateCompact, fmtTime, nowTs, today, tsToDay } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { ImpulsePrep, PatternCard, pathwayName } from './Impulse';
import { HBars } from '../ui/Chart';
import { HELP } from '../text/help';
import { T } from '../text/texts';

const fmt1 = (x: number) => x.toFixed(1).replace('.', ',');

export function ImpulseHistory() {
  const dataVersion = useDataVersion();
  const db = session.db!;
  const t = today();
  const now = nowTs();
  const [open, setOpen] = useState<imp.Episode | null>(null);
  const [prep, setPrep] = useState(false);
  const { eps, cur, prev, names } = useMemo(() => {
    const eps = imp.recent(db, 0, null);
    const cur = imp.pattern(db, null, now);
    const prev = imp.pattern(db, null, now - 30 * 86_400);
    const names = new Map<number, string>(goals.list(db, true).map((g) => [g.id, g.name]));
    return { eps, cur, prev, names };
  }, [db, dataVersion, now]);

  const label = (e: imp.Episode) => {
    const parts = [pathwayName(e.pathway), e.outcome ? imp.outcomeLabel(e.outcome) : e.ended_at ? '' : T.IMPULSE_HISTORY_INCOMPLETE].filter(Boolean);
    return parts.join(' · ');
  };
  const intensity = (e: imp.Episode) => (e.intensity_before != null ? `${e.intensity_before}${e.intensity_after != null ? ` → ${e.intensity_after}` : ''}` : '');

  return (
    <div className="screen">
      <Topbar title={T.IMPULSE_HISTORY} back="/revision" actions={<button className="btn btn-secondary" onClick={() => setPrep(true)}>{HELP.IMPULSES_PREP}</button>} />
      <div className="content screen-body stack-lg">
        <p className="t-muted">{T.IMPULSE_HISTORY_INTRO}</p>
        {eps.length === 0 && <p className="t-muted">{T.IMPULSE_HISTORY_EMPTY}</p>}
        {cur.total_30 > 0 && (
          <section className="card stack" aria-labelledby="h-pat">
            <h2 id="h-pat" className="t-lead" style={{ fontWeight: 600 }}>{T.PATTERN_TITLE} · {HELP.IMPULSES_PATTERN_HEAD.toLowerCase()}</h2>
            <PatternCard link={false} />
          </section>
        )}
        {prev.total_30 > 0 && (
          <section className="card stack" aria-labelledby="h-comp">
            <h2 id="h-comp" className="t-lead" style={{ fontWeight: 600 }}>{T.IMPULSE_HISTORY_COMPARE}</h2>
            <p className="t-foot t-muted">La barra gris es el periodo anterior. Sólo te comparas contigo.</p>
            <Compare label="Episodios" now={cur.total_30} before={prev.total_30} />
            {(cur.known_30 > 0 || prev.known_30 > 0) && <Compare label="Sin actuar" now={cur.not_acted_30} before={prev.not_acted_30} nowOf={cur.known_30} beforeOf={prev.known_30} />}
            {cur.mean_before != null && cur.mean_after != null && prev.mean_before != null && prev.mean_after != null && (
              <>
                <Compare label="Intensidad antes" now={cur.mean_before} before={prev.mean_before} max={10} format={fmt1} />
                <Compare label="Intensidad después" now={cur.mean_after} before={prev.mean_after} max={10} format={fmt1} />
                <p className="t-foot t-muted">{T.PATTERN_INTENSITY_NOTE}</p>
              </>
            )}
          </section>
        )}
        {eps.length > 0 && (
          <div className="list" role="list">
            {eps.map((e) => (
              <button key={e.id} className="list-item" role="listitem" onClick={() => setOpen(e)}>
                <span className="grow episode">
                  <span>{fmtDateCompact(tsToDay(e.started_at), t)} · {fmtTime(e.started_at)}{e.goal_id != null && names.get(e.goal_id) ? ` · ${names.get(e.goal_id)}` : ''}</span>
                  <span className="meta">{[label(e), intensity(e)].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                <Icon name="forward" className="t-faint" />
              </button>
            ))}
          </div>
        )}
      </div>
      <ImpulsePrep open={prep} onClose={() => setPrep(false)} />
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${fmtDateCompact(tsToDay(open.started_at), t)} · ${fmtTime(open.started_at)}` : ''}>
        {open && (
          <dl className="stack t-muted" style={{ margin: 0 }}>
            {open.goal_id != null && names.get(open.goal_id) && <Row k="Objetivo" v={names.get(open.goal_id)!} />}
            {open.trigger_text && <Row k="Antes del impulso" v={open.trigger_text} />}
            {open.context && <Row k="Contexto" v={open.context} />}
            {open.pathway && <Row k="Vía" v={pathwayName(open.pathway)} />}
            {intensity(open) && <Row k="Intensidad (0–10)" v={intensity(open)} />}
            {open.waited_seconds != null && <Row k="Tiempo" v={`${Math.floor(open.waited_seconds / 60)} min ${open.waited_seconds % 60} s`} />}
            <Row k="Resultado" v={open.outcome ? imp.outcomeLabel(open.outcome) : open.ended_at ? 'Sin indicar' : T.IMPULSE_HISTORY_INCOMPLETE} />
            {open.reflection && <Row k="Notas" v={open.reflection} pre />}
          </dl>
        )}
      </Sheet>
    </div>
  );
}

/** Dos barras, ahora y antes, a la misma escala; «de n» cuando la cifra es una parte. */
function Compare({ label, now, before, nowOf, beforeOf, max, format }: { label: string; now: number; before: number; nowOf?: number; beforeOf?: number; max?: number; format?: (n: number) => string }) {
  const top = max ?? Math.max(now, before, 1);
  const f = (n: number, of?: number) => `${format ? format(n) : n}${of != null ? ` de ${of}` : ''}`;
  return (
    <div>
      <div className="t-foot" style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <HBars rows={[['ahora', now]]} max={top} format={(n) => f(n, nowOf)} />
      <div style={{ marginTop: 6 }}><HBars rows={[['antes', before]]} max={top} soft format={(n) => f(n, beforeOf)} /></div>
    </div>
  );
}

function Row({ k, v, pre }: { k: string; v: string; pre?: boolean }) {
  return (
    <div>
      <dt className="t-foot" style={{ fontWeight: 600 }}>{k}</dt>
      <dd style={{ margin: 0, color: 'var(--ink)', whiteSpace: pre ? 'pre-wrap' : 'normal' }}>{v}</dd>
    </div>
  );
}
