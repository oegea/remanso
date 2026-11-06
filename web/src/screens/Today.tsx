import { useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { session } from '../app/session';
import { bumpData, useDataVersion } from '../app/useSession';
import * as diary from '../domain/diary';
import * as tk from '../domain/tasks';
import * as rm from '../domain/reminders';
import * as goals from '../domain/goals';
import * as actions from '../domain/actions';
import * as reviews from '../domain/reviews';
import * as prompts from '../domain/prompts';
import * as imp from '../domain/impulses';
import { Answers } from './Review';
import { HELP } from '../text/help';
import { fmtDateLong, fmtRelativeDays, fmtDateCompact, fmtTime, today, nowTs, tsToDay, weekStart } from '../domain/dates';
import { Icon } from '../ui/Icon';
import { WaveMark } from '../ui/Wave';
import { announce } from '../ui/Live';
import { T } from '../text/texts';

/** Hoy: la fecha y, sólo si existen, lo pendiente y lo previsto. */
export function Today() {
  const dataVersion = useDataVersion();
  const db = session.db!;
  const [, navigate] = useLocation();
  const t = today();
  const now = nowTs();
  const data = useMemo(() => {
    const lastEntry = diary.lastEntryDay(db);
    const pending = tk.countPending(db, t);
    const due = rm.due(db, now);
    const active = goals.activeCount(db);
    const acts = actions.listActive(db).filter((a) => Schedule_plannedOn(a, t)).map((a) => ({ a, st: actions.statusOn(db, a.id, t) }));
    const dueGoals = goals.dueForReview(db, now).length;
    const weekly = reviews.weeklyAvailable(db, t, session.state.prefs.weeklyReviewDay);
    const hour = new Date().getHours();
    const openOn = prompts.setEnabled(db, 'open') && !reviews.doneToday(db, 'open', t);
    const closeOn = prompts.setEnabled(db, 'close') && !reviews.doneToday(db, 'close', t);
    // La apertura se propone al abrir la aplicación; el cierre, a partir de las ocho de la tarde.
    const openAvail = openOn && hour < 20;
    const closeAvail = closeOn && hour >= 20;
    const propose: 'open' | 'close' | null = openAvail && !reviews.dismissed(db, 'open', t) ? 'open' : closeAvail && !reviews.dismissed(db, 'close', t) ? 'close' : null;
    const openAnswers = reviews.todayAnswers(db, 'open', t);
    const closeAnswers = reviews.todayAnswers(db, 'close', t);
    const impulses7 = imp.pattern(db, null, now).total_7;
    const lastOpen = Number(db.scalar<string>("SELECT value FROM settings WHERE key = 'last_open'") ?? 0);
    return { lastEntry, pending, due, active, acts, dueGoals, weekly, lastOpen, openAvail, closeAvail, propose, openAnswers, closeAnswers, impulses7 };
  }, [db, dataVersion, t, now]);

  const write = () => {
    const id = diary.create(db);
    bumpData();
    navigate(`/diario/${id}?nueva=1`);
  };
  const empty = !data.lastEntry && data.pending === 0 && data.due.length === 0 && data.active === 0 && !data.propose && data.impulses7 === 0;

  return (
    <div className="screen">
      <div className="content screen-body">
        <header className="today-date">
          <div className="brand-mobile" aria-hidden="true"><WaveMark size={26} className="t-muted" /></div>
          <h1 className="t-date">{fmtDateLong(t)}</h1>
        </header>
        <WelcomeBack lastOpen={data.lastOpen} pending={data.pending} due={data.due.length} />
        {data.propose && (
          <section className="card stack" style={{ marginBottom: 16 }} aria-labelledby="h-propose">
            <h2 id="h-propose" className="t-lead" style={{ fontWeight: 600 }}>{data.propose === 'open' ? HELP.TODAY_CARD_OPEN_TITLE : HELP.TODAY_CARD_CLOSE_TITLE}</h2>
            <p className="t-muted">{data.propose === 'open' ? HELP.TODAY_CARD_OPEN_BODY : HELP.TODAY_CARD_CLOSE_BODY}</p>
            <div className="row">
              <button className="btn btn-primary" onClick={() => navigate(`/revision/sesion/${data.propose}`)}>{HELP.TODAY_CARD_START}</button>
              <button className="btn btn-text" onClick={() => { reviews.dismiss(db, data.propose!, t); bumpData(); }}>{HELP.TODAY_CARD_LATER}</button>
            </div>
          </section>
        )}
        <section className="stack" aria-labelledby="h-escribir">
          <button className="card row" style={{ width: '100%', textAlign: 'left' }} onClick={write}>
            <Icon name="diary" className="t-muted" />
            <span className="grow">
              <span id="h-escribir" className="t-lead" style={{ fontWeight: 600, display: 'block' }}>Escribir</span>
              <span className="t-foot t-muted">{data.lastEntry ? `${T.HOME_LAST_ENTRY}: ${fmtRelativeDays(data.lastEntry, t)}` : T.HOME_NO_ENTRIES}</span>
            </span>
            <Icon name="forward" className="t-faint" />
          </button>
        </section>

        {data.openAnswers.length > 0 && (
          <section className="stack" style={{ marginTop: 24 }} aria-labelledby="h-open-ans">
            <h2 id="h-open-ans" className="list-head" style={{ padding: 0 }}>{HELP.TODAY_ANSWERS_OPEN}</h2>
            <div className="card"><Answers answers={data.openAnswers} /></div>
          </section>
        )}
        {data.closeAnswers.length > 0 && (
          <section className="stack" style={{ marginTop: 24 }} aria-labelledby="h-close-ans">
            <h2 id="h-close-ans" className="list-head" style={{ padding: 0 }}>{HELP.TODAY_ANSWERS_CLOSE}</h2>
            <div className="card"><Answers answers={data.closeAnswers} /></div>
          </section>
        )}
        {data.due.length > 0 && (
          <section className="stack" style={{ marginTop: 24 }} aria-labelledby="h-rec">
            <h2 id="h-rec" className="list-head" style={{ padding: 0 }}>{T.REMINDERS_DUE}</h2>
            <div className="card" style={{ padding: '0 16px' }}>
              {data.due.slice(0, 3).map((r) => (
                <div key={r.id} className="list-item" style={{ minHeight: 48 }}>
                  <span className="t-foot num" style={{ color: 'var(--warn)' }}>{tsToDay(rm.effectiveAt(r)) === t ? `hoy ${fmtTime(rm.effectiveAt(r))}` : fmtDateCompact(tsToDay(rm.effectiveAt(r)), t)}</span>
                  <span className="grow ellipsis">{r.title}</span>
                  <button className="btn btn-text" onClick={() => { rm.dismiss(db, r.id); bumpData(); announce('Recordatorio cerrado.'); }}>Hecho</button>
                </div>
              ))}
              {data.due.length > 3 && <Link href="/recordatorios" className="list-item t-foot">y {data.due.length - 3} más</Link>}
            </div>
          </section>
        )}

        {data.acts.length > 0 && (
          <section className="stack" style={{ marginTop: 24 }} aria-labelledby="h-hoy">
            <h2 id="h-hoy" className="list-head" style={{ padding: 0 }}>{T.HOME_TODAY}</h2>
            <div className="card" style={{ padding: '0 16px' }}>
              {data.acts.map(({ a, st }) => (
                <div key={a.id} className="list-item" style={{ minHeight: 48 }}>
                  <button className="btn btn-icon" aria-label={st === true ? 'Hecha hoy; tocar para marcar no hecha' : st === false ? 'Marcada no hecha; tocar para quitar el registro' : 'Sin registro hoy; tocar para marcar hecha'}
                    onClick={() => { const next = st === undefined ? true : st ? false : null; actions.log(db, a.id, t, next, ''); bumpData(); if (next === false) announce(`${T.LAPSE_LINE1}`); }}>
                    <span className={`dot ${st === true ? 'is-done' : st === false ? 'is-not' : 'is-blank'}`} style={{ width: 20, height: 20 }} />
                  </button>
                  <span className="grow"><span>{a.name}</span>{a.cue && <span className="meta" style={{ display: 'block' }}>{a.cue}</span>}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="stack" style={{ marginTop: 24 }}>
          {data.pending > 0 && <Link href="/tareas" className="list-item"><Icon name="tasks" className="t-muted" /><span className="grow">{data.pending} {data.pending === 1 ? 'tarea pendiente' : 'tareas pendientes'} hoy</span><Icon name="forward" className="t-faint" /></Link>}
          {data.active > 0 && <Link href="/objetivos" className="list-item"><Icon name="goals" className="t-muted" /><span className="grow">{data.active} {data.active === 1 ? 'objetivo activo' : 'objetivos activos'}{data.dueGoals ? ` · ${data.dueGoals} con revisión disponible` : ''}</span><Icon name="forward" className="t-faint" /></Link>}
          {data.openAvail && <Link href="/revision/sesion/open" className="list-item"><Icon name="review" className="t-muted" /><span className="grow">{HELP.TODAY_OPEN_LINK}</span><Icon name="forward" className="t-faint" /></Link>}
          {data.closeAvail && <Link href="/revision/sesion/close" className="list-item"><Icon name="review" className="t-muted" /><span className="grow">{HELP.TODAY_CLOSE_LINK}</span><Icon name="forward" className="t-faint" /></Link>}
          {data.impulses7 > 0 && <Link href="/impulsos" className="list-item"><Icon name="impulse" className="t-muted" /><span className="grow">{data.impulses7} {data.impulses7 === 1 ? 'episodio' : 'episodios'} {HELP.TODAY_IMPULSES}</span><Icon name="forward" className="t-faint" /></Link>}
          {data.weekly && <Link href="/revision" className="list-item"><Icon name="review" className="t-muted" /><span className="grow">Revisión semanal disponible</span><Icon name="forward" className="t-faint" /></Link>}
        </section>

        {empty && <div className="stack" style={{ marginTop: 24 }}>{HELP.TODAY_EMPTY.map((p) => <p key={p} className="t-muted">{p}</p>)}</div>}
      </div>
      <Link href="/impulso" className="fab" aria-label="Abrir Impulso"><Icon name="impulse" /> Impulso</Link>
    </div>
  );
}

function Schedule_plannedOn(a: actions.Action, day: string): boolean {
  return actions.Schedule.plannedOn(a.schedule, day);
}

/** Aviso único y neutro al volver tras ≥ 3 días (regla E §8.13). */
function WelcomeBack({ lastOpen, pending, due }: { lastOpen: number; pending: number; due: number }) {
  const db = session.db!;
  const t = today();
  const days = lastOpen ? Math.floor((Date.now() / 1000 - lastOpen) / 86_400) : 0;
  const shownKey = `welcome_shown_${weekStart(t)}_${t}`;
  const already = sessionStorage.getItem(shownKey);
  if (!lastOpen || days < 3 || already || (pending + due === 0)) {
    if (!already) { db.run("INSERT INTO settings(key, value) VALUES ('last_open', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [String(Math.floor(Date.now() / 1000))]); sessionStorage.setItem(shownKey, '1'); }
    return null;
  }
  return (
    <div className="notice stack" style={{ marginBottom: 16 }}>
      <p>{T.WELCOME_BACK_LINE1.replace('{n}', String(days))}</p>
      <p>{T.WELCOME_BACK_LINE2.replace('{t}', String(pending)).replace('{r}', String(due))}</p>
      <p className="t-muted">{T.WELCOME_BACK_LINE3}</p>
      <button className="btn btn-text" onClick={() => { sessionStorage.setItem(shownKey, '1'); db.run("INSERT INTO settings(key, value) VALUES ('last_open', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [String(Math.floor(Date.now() / 1000))]); bumpData(); }}>Entendido</button>
    </div>
  );
}
