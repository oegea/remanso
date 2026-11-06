/** Revisión: menú y sesión de preguntas (una por pantalla, todas omisibles). */
import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { AnimatePresence, motion } from 'motion/react';
import { session } from '../app/session';
import { bumpData, useDataVersion } from '../app/useSession';
import * as prompts from '../domain/prompts';
import * as reviews from '../domain/reviews';
import * as goals from '../domain/goals';
import * as actions from '../domain/actions';
import * as metrics from '../domain/metrics';
import * as impulses from '../domain/impulses';
import * as tasks from '../domain/tasks';
import * as trend from '../domain/analysis/trend';
import { today, nowTs, addDays, weekStart, WEEKDAYS, fmtDateCompact, fmtDateLong } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Sheet, Prompt, Confirm, Choice } from '../ui/Sheet';
import { HELP } from '../text/help';
import { announce } from '../ui/Live';
import { ImpulsePrep } from './Impulse';
import { T } from '../text/texts';
import { plural } from '../text/plural';

export function ReviewMenu() {
  useDataVersion();
  const db = session.db!;
  const [, navigate] = useLocation();
  const t = today();
  const weekday = session.state.prefs.weeklyReviewDay;
  const guided = reviews.guidedToday(db, t);
  const doneKind = (k: string) => reviews.doneToday(db, k, t);
  const state = (sched: string) => (!prompts.setEnabled(db, sched) ? HELP.REVIEW_STATE_OFF : doneKind(sched) ? HELP.REVIEW_STATE_DONE : T.REVIEW_AVAILABLE);
  const weeklyState = !prompts.setEnabled(db, 'weekly') ? HELP.REVIEW_STATE_OFF : reviews.weeklyAvailable(db, t, weekday) ? T.REVIEW_AVAILABLE : (reviews.lastOfKind(db, 'weekly') ?? '') >= weekStart(t) ? T.REVIEW_DONE_THIS_WEEK : HELP.REVIEW_WEEKLY_SUGGESTED.replace('{d}', WEEKDAYS[weekday]);
  const dueGoals = goals.dueForReview(db, nowTs());
  const episodes = impulses.pattern(db, null, nowTs()).total_30;
  const past = reviews.history(db);
  const [sheet, setSheet] = useState<null | 'goal' | 'action' | 'prep' | 'help' | { force: string } | { enable: string } | { past: reviews.PastReview }>(null);
  const startGuided = (sched: string) => {
    if (!prompts.setEnabled(db, sched)) { setSheet({ enable: sched }); return; }
    // Una sesión de cada tipo al día; la semanal cuenta como la sesión de su día.
    if (doneKind(sched) || (guided && (sched === 'weekly' || guided === 'weekly'))) { setSheet({ force: sched }); return; }
    navigate(`/revision/sesion/${sched}`);
  };
  const enableAndStart = (sched: string) => {
    prompts.installSet(db, sched);
    bumpData();
    setSheet(null);
    navigate(`/revision/sesion/${sched}`);
  };
  const activeGoals = goals.list(db, false).filter((g) => g.status === 'active');
  const acts = actions.listActive(db);
  type Item = { label: string; desc: string; state: string; onClick: () => void };
  const groups: { title: string; items: Item[] }[] = [
    { title: HELP.REVIEW_GROUP_DAY, items: [
      { label: T.REVIEW_MENU_OPEN, desc: HELP.REVIEW_DESC_OPEN, state: state('open'), onClick: () => startGuided('open') },
      { label: T.REVIEW_MENU_CLOSE, desc: HELP.REVIEW_DESC_CLOSE, state: state('close'), onClick: () => startGuided('close') },
      { label: T.REVIEW_MENU_WEEKLY, desc: HELP.REVIEW_DESC_WEEKLY, state: weeklyState, onClick: () => startGuided('weekly') },
    ] },
    { title: HELP.REVIEW_GROUP_GOALS, items: [
      { label: T.REVIEW_MENU_GOAL, desc: HELP.REVIEW_DESC_GOAL, state: dueGoals.length ? `${dueGoals.length} ${T.HOME_GOAL_REVIEW_AVAILABLE}` : activeGoals.length ? '' : 'sin objetivos activos', onClick: () => (activeGoals.length ? setSheet('goal') : announce('No hay objetivos activos que revisar.')) },
      { label: T.SRBAI_TITLE, desc: HELP.REVIEW_DESC_SRBAI, state: acts.length ? '' : 'sin acciones activas', onClick: () => (acts.length ? setSheet('action') : announce('No hay acciones activas.')) },
    ] },
    { title: HELP.REVIEW_GROUP_IMPULSES, items: [
      { label: HELP.REVIEW_IMPULSES_ENTRY, desc: HELP.REVIEW_DESC_IMPULSES, state: episodes ? `${plural(episodes, 'episodio', 'episodios')} en 30 días` : '', onClick: () => navigate('/impulsos') },
      { label: T.REVIEW_MENU_PREP, desc: HELP.REVIEW_DESC_PREP, state: '', onClick: () => setSheet('prep') },
    ] },
  ];
  const kindName = (k: string) => (k === 'open' ? T.REVIEW_MENU_OPEN : k === 'close' ? T.REVIEW_MENU_CLOSE : k === 'weekly' ? T.REVIEW_MENU_WEEKLY : k.startsWith('srbai') ? T.SRBAI_TITLE : T.REVIEW_MENU_GOAL);
  const enabling = sheet && typeof sheet === 'object' && 'enable' in sheet ? sheet.enable : null;
  const viewing = sheet && typeof sheet === 'object' && 'past' in sheet ? sheet.past : null;
  return (
    <div className="screen">
      <Topbar title={T.REVIEWS} actions={<button className="btn btn-icon" aria-label={HELP.REVIEWS_HOW_Q} onClick={() => setSheet('help')}><Icon name="help" /></button>} />
      <div className="content screen-body stack-lg">
        {groups.map((g) => (
          <section key={g.title} aria-labelledby={`h-${g.title}`}>
            <h2 id={`h-${g.title}`} className="list-head" style={{ paddingTop: 0 }}>{g.title}</h2>
            <div className="list">{g.items.map((it) => (
              <button key={it.label} className="list-item" style={{ alignItems: 'flex-start' }} onClick={it.onClick}>
                <span className="grow">
                  <span>{it.label}</span>
                  <span className="meta" style={{ display: 'block' }}>{it.desc}</span>
                  {it.state && <span className="meta" style={{ display: 'block', color: 'var(--accent)', marginTop: 2 }}>{it.state}</span>}
                </span>
                <Icon name="forward" className="t-faint" style={{ marginTop: 2 }} />
              </button>
            ))}</div>
          </section>
        ))}
        <section aria-labelledby="h-past">
          <h2 id="h-past" className="list-head" style={{ paddingTop: 0 }}>{HELP.REVIEW_PAST_HEAD}</h2>
          {past.length === 0 ? <p className="t-muted">{HELP.REVIEW_PAST_EMPTY}</p> : (
            <div className="list">{past.map((r) => (
              <button key={r.id} className="list-item" onClick={() => setSheet({ past: r })}>
                <span className="t-foot t-muted num" style={{ minWidth: 72 }}>{fmtDateCompact(r.day, t)}</span>
                <span className="grow"><span>{kindName(r.kind)}{r.goal_name ? ` · ${r.goal_name}` : ''}</span><span className="meta" style={{ display: 'block' }}>{plural(r.answers.length, 'respuesta', 'respuestas')}</span></span>
                <Icon name="forward" className="t-faint" />
              </button>
            ))}</div>
          )}
        </section>
      </div>
      <Sheet open={sheet === 'help'} onClose={() => setSheet(null)} title={T.REVIEWS}>
        <div className="stack t-muted">{HELP.REVIEWS_WHAT.map((x) => <p key={x}>{x}</p>)}</div>
      </Sheet>
      <Choice open={sheet === 'goal'} onClose={() => setSheet(null)} title={T.REVIEW_GOAL_PICK} options={activeGoals.map((g) => g.name)} onPick={(i) => navigate(`/revision/sesion/goal_review?goal=${activeGoals[i].id}`)} />
      <Choice open={sheet === 'action'} onClose={() => setSheet(null)} title="¿Qué acción?" options={acts.map((a) => a.name)} onPick={(i) => navigate(`/revision/sesion/srbai?action=${acts[i].id}`)} />
      <ImpulsePrep open={sheet === 'prep'} onClose={() => setSheet(null)} />
      <Confirm open={!!(sheet && typeof sheet === 'object' && 'force' in sheet)} onClose={() => setSheet(null)} title={T.REVIEW_SECOND_SESSION} confirmLabel="Abrir" onConfirm={() => { if (sheet && typeof sheet === 'object' && 'force' in sheet) navigate(`/revision/sesion/${sheet.force}`); }} />
      <Sheet open={!!enabling} onClose={() => setSheet(null)} title={`${HELP.REVIEW_ENABLE_TITLE}: ${enabling ? kindName(enabling).toLowerCase() : ''}`} closeLabel="Cancelar" footer={<button className="btn btn-primary btn-block" onClick={() => enabling && enableAndStart(enabling)}>{HELP.REVIEW_ENABLE_BTN}</button>}>
        <div className="stack t-muted">
          <p style={{ color: 'var(--ink)' }}>{enabling === 'open' ? HELP.REVIEW_DESC_OPEN : enabling === 'close' ? HELP.REVIEW_DESC_CLOSE : HELP.REVIEW_DESC_WEEKLY}</p>
          <p>{HELP.REVIEW_ENABLE_BODY}</p>
          {enabling && <ul className="stack" style={{ gap: 4 }}>{prompts.templates(enabling).map((q) => <li key={q.text}>· {q.text}</li>)}</ul>}
        </div>
      </Sheet>
      <Sheet open={!!viewing} onClose={() => setSheet(null)} title={viewing ? `${kindName(viewing.kind)} · ${fmtDateLong(viewing.day)}` : ''}>
        {viewing && <Answers answers={viewing.answers} />}
      </Sheet>
    </div>
  );
}

/** Lista pregunta → respuesta, tal cual se escribió. */
export function Answers({ answers }: { answers: reviews.PastAnswer[] }) {
  return (
    <dl className="stack" style={{ margin: 0 }}>
      {answers.map((a, i) => (
        <div key={i}>
          <dt className="t-foot t-muted">{a.question}</dt>
          <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.text || (a.value != null ? String(a.value).replace('.', ',') : '')}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Q { id: number; text: string; kind: prompts.PromptKind; options: string[]; }

export function ReviewSession() {
  const { kind } = useParams<{ kind: string }>();
  const db = session.db!;
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const goalId = params.get('goal') ? Number(params.get('goal')) : null;
  const actionId = params.get('action') ? Number(params.get('action')) : null;
  const t = today();
  const setup = useMemo(() => {
    const goal = goalId != null ? goals.get(db, goalId) : undefined;
    const action = actionId != null ? actions.get(db, actionId) : undefined;
    const reviewKind = kind === 'goal_review' ? 'goal' : kind === 'srbai' ? 'srbai' : kind;
    const reviewId = reviews.start(db, reviewKind as reviews.ReviewKind, goal?.id ?? null);
    let qs: Q[] = [];
    if (kind === 'goal_review' && goal) {
      const n = (db.scalar<number>('SELECT count(*) FROM measurements m JOIN metrics x ON x.id = m.metric_id WHERE x.goal_id = ?1 AND m.measured_at >= ?2', [goal.id, nowTs() - 28 * 86_400]) ?? 0) + (db.scalar<number>('SELECT count(*) FROM action_log l JOIN actions a ON a.id = l.action_id WHERE a.goal_id = ?1 AND l.done = 1 AND l.logged_at >= ?2', [goal.id, nowTs() - 28 * 86_400]) ?? 0);
      qs = prompts.templates('goal_review').map((tpl, i) => ({ id: -(i + 1), text: tpl.text.replace('{why}', goal.why || '(sin motivo escrito)').replace('{n}', String(n)), kind: tpl.kind, options: (tpl.options ?? '').split('|').filter(Boolean) }));
    } else if (kind === 'srbai' && action) {
      qs = prompts.ensureSrbai(db, action.id, action.name).map((p) => ({ id: p.id, text: p.text, kind: p.kind, options: prompts.choices(p) }));
    } else {
      qs = prompts.list(db, kind).slice(0, kind === 'open' ? 2 : kind === 'close' ? 3 : 6).map((p) => ({ id: p.id, text: p.text, kind: p.kind, options: prompts.choices(p) }));
    }
    const data: string[] = [];
    if (kind === 'weekly' || kind === 'goal_review') {
      for (const a of actions.listActive(db)) {
        if (goal && a.goal_id !== goal.id) continue;
        const s = actions.summary(db, a, t);
        data.push(`${a.name}: ${s.this_week} de ${s.per_week} esta semana; la anterior ${s.last_week}.`);
      }
      const ms = goal ? metrics.listForGoal(db, goal.id, false) : goals.list(db, false).flatMap((g) => metrics.listForGoal(db, g.id, false));
      for (const m of ms.filter((x) => metrics.isNumeric(x.kind))) {
        const series = metrics.dailySeries(db, m, 60);
        if (!series.length) continue;
        const sum = m.kind === 'count' || m.kind === 'duration';
        const [c, p] = trend.weekOverWeek(series, t, sum);
        const ch = trend.describeChange(c, p, m.unit, m.kind === 'number' ? 1 : 0);
        const cur = trend.currentLevel(series, m.kind);
        data.push(`${m.name}: ${cur != null ? metrics.formatValue(m.kind, cur, null, m.unit) : ''}${ch ? ` (${ch})` : ''}`);
      }
      const p = impulses.pattern(db, goal?.id ?? null, nowTs());
      if (p.total_30 > 0) data.push(T.PATTERN_NOT_ACTED.replace('{x}', String(p.not_acted_30)).replace('{y}', String(p.known_30)));
      if (!data.length) data.push('Sin datos de acciones ni métricas esta semana.');
    }
    return { goal, action, reviewId, qs, data };
  }, [db, kind, goalId, actionId, t]);

  const [stage, setStage] = useState<'data' | 'q' | 'done'>(setup.data.length ? 'data' : 'q');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<{ i: number; text: string; value: number | null }[]>([]);
  const [ask, setAsk] = useState<null | 'free' | { task: string }>(null);
  const [summary, setSummary] = useState<string[]>([]);
  const q = setup.qs[idx];

  const record = (text: string, value: number | null) => {
    if (q.id > 0) prompts.answer(db, q.id, text, value, setup.reviewId);
    setAnswers((a) => [...a, { i: idx, text, value }]);
  };
  const advance = (extra?: { i: number; text: string; value: number | null }) => {
    const all = extra ? [...answers, extra] : answers;
    if (idx + 1 >= setup.qs.length) finish(all); else setIdx(idx + 1);
  };
  const finish = (all: { i: number; text: string; value: number | null }[]) => {
    const out: string[] = [];
    if (kind === 'close') {
      const third = all.find((a) => a.i === 2);
      if (third) {
        let n = 0;
        for (const line of third.text.split(';').map((s) => s.trim()).filter(Boolean)) { tasks.create(db, { title: line, scheduled_day: addDays(t, 1) }); n++; }
        if (n) out.push(T.REVIEW_TASKS_CREATED.replace('{n}', String(n)));
      }
    }
    if (kind === 'srbai' && setup.action) {
      const vals = all.map((a) => a.value).filter((v): v is number => v != null);
      if (vals.length) {
        const now = vals.reduce((a, b) => a + b, 0) / vals.length;
        out.push(T.SRBAI_RESULT.replace('{now}', now.toFixed(1).replace('.', ',')));
        const hist = prompts.srbaiHistory(db, setup.action.id);
        if (hist[1]) out.push(T.SRBAI_PREVIOUS.replace('{day}', hist[1][0]).replace('{v}', hist[1][1].toFixed(1).replace('.', ','))); else out.push(T.SRBAI_FIRST);
      }
    }
    if (kind === 'goal_review' && setup.goal) {
      goals.markReviewed(db, setup.goal.id);
      const d = all.find((a) => a.i === 4)?.value;
      if (d === 2) { goals.setStatus(db, setup.goal.id, 'paused'); out.push('Objetivo pausado. El historial se conserva.'); }
      else if (d === 3) out.push('Para cerrarlo con su motivo, usa «Cerrar» en la ficha del objetivo.');
      else if (d === 1) out.push('Ajusta la frecuencia en la pestaña Acciones de la ficha.');
    }
    reviews.complete(db, setup.reviewId, '');
    if (kind === 'weekly' && all.length === 0 && reviews.emptyWeeklyStreak(db) >= 3) out.push(T.REVIEW_OFFER_DISABLE);
    bumpData();
    setSummary(out);
    setStage('done');
  };
  const title = kind === 'open' ? T.REVIEW_MENU_OPEN : kind === 'close' ? T.REVIEW_MENU_CLOSE : kind === 'weekly' ? T.REVIEW_MENU_WEEKLY : kind === 'goal_review' ? `${T.REVIEW_MENU_GOAL} · ${setup.goal?.name ?? ''}` : `${T.SRBAI_TITLE} · ${setup.action?.name ?? ''}`;
  const scaleBounds = (): [number, number] => { const p = q?.options.map(Number) ?? []; return p.length === 2 && p.every((x) => !Number.isNaN(x)) ? [p[0], p[1]] : [0, 10]; };
  const [lo, hi] = q?.kind === 'scale' ? scaleBounds() : [0, 10];
  const back = () => navigate('/revision');
  return (
    <div className="editor-shell">
      <header className="topbar">
        <div className="content row" style={{ minHeight: 52 }}>
          <button className="btn btn-text" style={{ marginLeft: -8 }} onClick={stage === 'q' ? () => finish(answers) : back}><Icon name="close" /> {stage === 'q' ? 'Terminar aquí' : 'Volver'}</button>
          <div className="grow ellipsis" style={{ fontWeight: 600 }}>{title}</div>
          {stage === 'q' && <span className="t-foot t-muted num">{idx + 1} de {setup.qs.length}</span>}
        </div>
      </header>
      <div className="editor-body stack-lg" style={{ maxWidth: 560 }}>
        <AnimatePresence mode="wait">
          <motion.div key={stage + idx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }} className="stack-lg">
            {stage === 'data' && (
              <div className="stack">
                <h1 className="t-title">{T.REVIEW_WEEK_HEADER}</h1>
                <ul className="stack">{setup.data.map((d) => <li key={d}>· {d}</li>)}</ul>
                <p className="t-muted">{T.REVIEW_INTRO_WEEKLY}</p>
                <button className="btn btn-primary" onClick={() => (setup.qs.length ? setStage('q') : finish([]))}>Continuar</button>
              </div>
            )}
            {stage === 'q' && q && (
              <div className="stack">
                <h1 className="t-title" style={{ fontWeight: 500 }}>{q.text}</h1>
                {q.kind === 'free' && <div className="row"><button className="btn btn-primary" onClick={() => setAsk('free')}>Responder</button><button className="btn btn-text" onClick={() => advance()}>{T.REVIEW_SKIP}</button></div>}
                {q.kind === 'choice' && <div className="stack">{q.options.map((o, i) => <button key={o} className="btn btn-secondary btn-block" style={{ justifyContent: 'flex-start', whiteSpace: 'normal' }} onClick={() => { record(o, i); advance({ i: idx, text: o, value: i }); }}>{o}</button>)}<button className="btn btn-text" onClick={() => advance()}>{T.REVIEW_SKIP}</button></div>}
                {q.kind === 'scale' && <ScaleQ lo={lo} hi={hi} onPick={(v) => { record('', v); advance({ i: idx, text: '', value: v }); }} onSkip={() => advance()} />}
                {answers.length > 0 && <div className="stack" style={{ marginTop: 16 }}>{answers.slice(-3).map((a) => <p key={a.i} className="t-foot t-muted">✓ {setup.qs[a.i].text.slice(0, 40)}… → {a.text || a.value}</p>)}</div>}
              </div>
            )}
            {stage === 'done' && (
              <div className="stack">
                <h1 className="t-title">{T.REVIEW_SAVED}</h1>
                <p className="t-muted">{plural(answers.length, 'respuesta guardada', 'respuestas guardadas')}.{answers.length > 0 ? ` ${HELP.REVIEW_PAST_HINT}` : ''}</p>
                {summary.map((s) => <p key={s}>{s}</p>)}
                {summary.includes(T.REVIEW_OFFER_DISABLE) && <button className="btn btn-secondary" onClick={() => { prompts.disableSet(db, 'weekly'); bumpData(); back(); }}>Dejar de ofrecer la revisión semanal</button>}
                <button className="btn btn-primary" onClick={back}>Volver</button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <Prompt open={ask === 'free'} onClose={() => setAsk(null)} title={q?.text ?? ''} multiline submitLabel="Guardar" onSubmit={(v) => {
        if (!v.trim()) { advance(); return; }
        record(v.trim(), null);
        if (kind === 'weekly' && idx === 3) { setTimeout(() => setAsk({ task: v.trim() }), 0); return; }
        advance({ i: idx, text: v.trim(), value: null });
      }} />
      <Confirm open={!!(ask && typeof ask === 'object' && 'task' in ask)} onClose={() => { setAsk(null); advance({ i: idx, text: ask && typeof ask === 'object' && 'task' in ask ? ask.task : '', value: null }); }} title="¿Guardarlo como tarea para la semana que viene?" body={ask && typeof ask === 'object' && 'task' in ask ? ask.task : ''} confirmLabel="Guardar tarea" onConfirm={() => { if (ask && typeof ask === 'object' && 'task' in ask) { tasks.create(db, { title: ask.task, scheduled_day: addDays(weekStart(t), 7) }); bumpData(); announce('Tarea creada para el lunes.'); } }} />
    </div>
  );
}

function ScaleQ({ lo, hi, onPick, onSkip }: { lo: number; hi: number; onPick: (v: number) => void; onSkip: () => void }) {
  const [v, setV] = useState(Math.round((lo + hi) / 2));
  return (
    <div className="stack">
      <div className="slider-value" aria-hidden="true">{v}</div>
      <input type="range" min={lo} max={hi} step={1} value={v} onChange={(e) => setV(Number(e.target.value))} className="slider" aria-label={`De ${lo} a ${hi}`} aria-valuetext={String(v)} />
      {hi === 5 && <p className="t-foot t-muted">{T.SRBAI_SCALE}</p>}
      <div className="row"><button className="btn btn-primary" onClick={() => onPick(v)}>Continuar</button><button className="btn btn-text" onClick={onSkip}>{T.REVIEW_SKIP}</button></div>
    </div>
  );
}
