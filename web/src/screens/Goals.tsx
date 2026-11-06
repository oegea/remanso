import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { session } from '../app/session';
import { bumpData, useDataVersion } from '../app/useSession';
import * as goals from '../domain/goals';
import * as metrics from '../domain/metrics';
import * as milestones from '../domain/milestones';
import * as actions from '../domain/actions';
import * as plans from '../domain/plans';
import * as prompts from '../domain/prompts';
import * as safety from '../domain/safety';
import { HELP } from '../text/help';
import { Intro } from '../ui/Intro';
import * as diary from '../domain/diary';
import * as trend from '../domain/analysis/trend';
import * as spark from '../domain/analysis/spark';
import { fmtDateCompact, fmtDateLong, fmtDateShort, fmtRelativeDays, today, tsToDay, parseDayInput, nowTs, addDays, weekStart } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Prompt, Confirm, Choice, Sheet } from '../ui/Sheet';
import { announce } from '../ui/Live';
import { TrendChart, Sparkline, WeekDots, ProgressBar } from '../ui/Chart';
import { T } from '../text/texts';
import { plural } from '../text/plural';

// ---- lista y asistente ------------------------------------------------------------

export function GoalList() {
  const dataVersion = useDataVersion();
  const db = session.db!;
  const [, navigate] = useLocation();
  const [showClosed, setShowClosed] = useState(false);
  const list = useMemo(() => goals.list(db, showClosed), [db, dataVersion, showClosed]);
  const [wizard, setWizard] = useState<null | 'safety' | 'name' | { kind: string } | { cat: string; kind: goals.GoalKind }>(null);
  const t = today();
  const now = nowTs();
  const start = () => {
    const shown = db.scalar<string>("SELECT value FROM settings WHERE key = 'goals_safety_shown'");
    if (!shown) { db.run("INSERT INTO settings(key, value) VALUES ('goals_safety_shown', '1')"); setWizard('safety'); }
    else setWizard('name');
  };
  return (
    <div className="screen">
      <Topbar title={T.GOALS} actions={<button className="btn btn-primary" onClick={start}><Icon name="plus" /> Nuevo</button>} />
      <div className="content screen-body">
        {list.length === 0 ? (
          <div className="empty"><p>{T.GOALS_EMPTY[0]}</p><p>Un objetivo reúne lo que quieres cambiar, por qué, y las acciones, medidas e hitos que elijas. Puedes empezar con algo pequeño.</p></div>
        ) : (
          <div className="list">{list.map((g) => {
            const base = g.last_reviewed_at ?? g.created_at;
            const reviewDue = g.status === 'active' && g.review_every_days != null && base + g.review_every_days * 86_400 <= now;
            const meta = [goals.goalStatusLabel(g.status), reviewDue ? T.GOAL_REVIEW_DUE : null, g.close_reason ? goals.closeReasonLabel(g.close_reason) : null, `${T.GOAL_SINCE} ${fmtDateCompact(g.started_on, t)}`].filter(Boolean).join(' · ');
            return (
              <Link key={g.id} href={`/objetivos/${g.id}`} className="list-item" style={{ color: g.status === 'active' ? 'var(--ink)' : 'var(--ink-2)' }}>
                <span className="grow"><span>{g.name}</span><span className="meta" style={{ display: 'block' }}>{meta}</span></span>
                <Icon name="forward" className="t-faint" />
              </Link>
            );
          })}</div>
        )}
        <button className="btn btn-text" style={{ marginTop: 16 }} onClick={() => setShowClosed(!showClosed)}>{showClosed ? 'Ocultar cerrados' : 'Mostrar cerrados'}</button>
      </div>
      <Sheet open={wizard === 'safety'} onClose={() => setWizard(null)} title={T.GOAL_SAFETY_TITLE} footer={<button className="btn btn-primary btn-block" onClick={() => setWizard('name')}>Entendido</button>}>
        <div className="notice stack">{T.GOAL_SAFETY_TEXT.filter(Boolean).map((p) => <p key={p}>{p}</p>)}</div>
      </Sheet>
      <Prompt open={wizard === 'name'} onClose={() => setWizard(null)} title="Nuevo objetivo" label={T.GOAL_NAME_PROMPT} submitLabel="Siguiente" onSubmit={(v) => { if (v.trim()) setTimeout(() => setWizard({ kind: v.trim() }), 0); }} />
      <Choice open={!!(wizard && typeof wizard === 'object' && 'kind' in wizard)} onClose={() => setWizard(null)} title={T.GOAL_KIND_TITLE} options={goals.GOAL_KINDS.map(goals.goalKindLabel)}
        onPick={(i) => { if (wizard && typeof wizard === 'object' && 'kind' in wizard) setTimeout(() => setWizard({ cat: wizard.kind, kind: goals.GOAL_KINDS[i] }), 0); }} />
      <Choice open={!!(wizard && typeof wizard === 'object' && 'cat' in wizard)} onClose={() => setWizard(null)} title={T.GOAL_CATEGORY_TITLE} options={goals.CATEGORIES.map((c) => c.label)}
        onPick={(i) => {
          if (!(wizard && typeof wizard === 'object' && 'cat' in wizard)) return;
          const cat = goals.CATEGORIES[i];
          const id = goals.create(db, wizard.cat, wizard.kind, cat.key);
          if (cat.red_flag) goals.markSafetyShown(db, id);
          bumpData();
          navigate(`/objetivos/${id}${cat.red_flag ? `?aviso=${cat.red_flag}` : '?nuevo=1'}`);
        }} />
    </div>
  );
}

// ---- ficha --------------------------------------------------------------------------

type Tab = 'summary' | 'metrics' | 'milestones' | 'actions' | 'plans';
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: T.GOAL_TAB_SUMMARY }, { key: 'metrics', label: T.GOAL_TAB_METRICS }, { key: 'milestones', label: T.GOAL_TAB_MILESTONES }, { key: 'actions', label: T.GOAL_TAB_ACTIONS }, { key: 'plans', label: T.GOAL_TAB_PLANS },
];

export function GoalDetail() {
  useDataVersion();
  const { id: idStr } = useParams<{ id: string }>();
  const id = Number(idStr);
  const db = session.db!;
  const [, navigate] = useLocation();
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const goal = goals.get(db, id);
  const [tab, setTab] = useState<Tab>('summary');
  const [notice, setNotice] = useState<string | null>(search.get('aviso'));
  const [askWhy, setAskWhy] = useState(search.get('nuevo') === '1');
  if (!goal) { navigate('/objetivos'); return null; }
  const derivLines = notice ? safety.derivation(db, notice as goals.RedFlag) : [];
  return (
    <div className="screen">
      <Topbar title={goal.name} back="/objetivos" subtitle={goals.goalStatusLabel(goal.status)} />
      <div className="content screen-body">
        {notice && (
          <div className="notice stack" style={{ marginBottom: 16 }} role="status">
            {derivLines.map((l) => <p key={l}>{l}</p>)}
            <button className="btn btn-text" onClick={() => { setNotice(null); window.history.replaceState(null, '', `/objetivos/${id}`); }}>Entendido</button>
          </div>
        )}
        <div className="segments" role="tablist">
          {TABS.map((x) => <button key={x.key} role="tab" aria-selected={tab === x.key} className="segment" onClick={() => setTab(x.key)}>{x.label}</button>)}
        </div>
        <div className="tab-panel" role="tabpanel">
          {tab === 'summary' && <SummaryTab goal={goal} askWhy={askWhy} onWhyDone={() => { setAskWhy(false); window.history.replaceState(null, '', `/objetivos/${id}`); }} />}
          {tab === 'metrics' && <MetricsTab goal={goal} />}
          {tab === 'milestones' && <MilestonesTab goal={goal} />}
          {tab === 'actions' && <ActionsTab goal={goal} />}
          {tab === 'plans' && <PlansTab goal={goal} />}
        </div>
      </div>
    </div>
  );
}

function SummaryTab({ goal, askWhy, onWhyDone }: { goal: goals.Goal; askWhy: boolean; onWhyDone: () => void }) {
  const db = session.db!;
  const [, navigate] = useLocation();
  const [ask, setAsk] = useState<null | 'name' | 'why' | 'context' | 'criteria' | 'horizon' | 'review' | 'close' | 'learned' | 'delete'>(askWhy ? 'why' : null);
  const t = today();
  const closeAsk = () => { setAsk(null); if (askWhy) onWhyDone(); };
  const field = (label: string, value: string, key: typeof ask, empty: string) => (
    <button className="list-item" style={{ alignItems: 'flex-start' }} onClick={() => setAsk(key)}>
      <span className="grow"><span className="meta">{label}</span><span style={{ display: 'block', color: value ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'pre-wrap' }}>{value || empty}</span></span>
      <Icon name="edit" className="t-faint" />
    </button>
  );
  const reviewTxt = goal.review_every_days != null ? `cada ${goal.review_every_days} días · ${goal.last_reviewed_at ? `${T.GOAL_LAST_REVIEW} ${fmtRelativeDays(tsToDay(goal.last_reviewed_at), t)}` : T.GOAL_NO_REVIEW}` : 'sin revisión programada';
  return (
    <div className="stack">
      <div className="card" style={{ padding: '0 16px' }}>
        {field('Objetivo', goal.name, 'name', '')}
        {field(T.GOAL_WHY, goal.why, 'why', 'Añadir por qué te importa')}
        {field(T.GOAL_CONTEXT, goal.context, 'context', 'Cuándo y dónde sueles hacerlo')}
        {field(T.GOAL_CRITERIA, goal.success_criteria, 'criteria', 'Cómo sabrás que va bien')}
        {field('Horizonte', goal.horizon_on ? fmtDateLong(goal.horizon_on) : '', 'horizon', 'Sin fecha límite')}
        {field('Revisión', reviewTxt, 'review', '')}
      </div>
      <p className="t-foot t-muted">{goals.goalKindLabel(goal.kind).split(' (')[0]} · {goals.category(goal.category).label} · {T.GOAL_SINCE} {fmtDateCompact(goal.started_on, t)}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {goal.status !== 'closed' && goal.status !== 'achieved' && <button className="btn btn-secondary" onClick={() => { goals.setStatus(db, goal.id, goal.status === 'paused' ? 'active' : 'paused'); bumpData(); }}>{goal.status === 'paused' ? 'Reanudar' : 'Pausar'}</button>}
        {goal.status !== 'closed' && goal.status !== 'achieved' && <button className="btn btn-secondary" onClick={() => setAsk('close')}>Cerrar</button>}
        {goal.status === 'active' && <button className="btn btn-secondary" onClick={() => { goals.markReviewed(db, goal.id); bumpData(); announce('Marcado como revisado.'); }}>Marcar revisado</button>}
        <button className="btn btn-text btn-danger" onClick={() => setAsk('delete')}>Borrar</button>
      </div>
      <Prompt open={ask === 'name'} onClose={closeAsk} title={T.GOAL_NAME_PROMPT} initial={goal.name} onSubmit={(v) => { if (v.trim()) { goals.setName(db, goal.id, v); bumpData(); } }} />
      <Prompt open={ask === 'why'} onClose={closeAsk} title={T.GOAL_WHY_PROMPT} initial={goal.why} multiline onSubmit={(v) => { goals.setWhy(db, goal.id, v); bumpData(); }} />
      <Prompt open={ask === 'context'} onClose={closeAsk} title={T.GOAL_CONTEXT_PROMPT} initial={goal.context} onSubmit={(v) => { goals.setContext(db, goal.id, v); bumpData(); }} />
      <Prompt open={ask === 'criteria'} onClose={closeAsk} title={T.GOAL_CRITERIA_PROMPT} initial={goal.success_criteria} multiline onSubmit={(v) => { goals.setSuccessCriteria(db, goal.id, v); bumpData(); }} />
      <Prompt open={ask === 'horizon'} onClose={closeAsk} title={T.GOAL_HORIZON_PROMPT} initial={goal.horizon_on ?? ''} help="15/12, 2027-03-01, +90, vacío" onSubmit={(v) => { const r = parseDayInput(v, t); if (!r) { announce(T.TASK_DATE_UNKNOWN); return; } goals.setHorizon(db, goal.id, r.day); bumpData(); }} />
      <Prompt open={ask === 'review'} onClose={closeAsk} title={T.GOAL_REVIEW_PROMPT} initial={goal.review_every_days?.toString() ?? ''} inputMode="numeric" onSubmit={(v) => { const n = v.trim() ? Number(v) : null; if (v.trim() && (!Number.isInteger(n) || (n as number) <= 0)) { announce('Escribe un número de días, o déjalo vacío.'); return; } goals.setReviewEvery(db, goal.id, n); bumpData(); }} />
      <Choice open={ask === 'close'} onClose={closeAsk} title={T.GOAL_CLOSE_INTRO} options={goals.CLOSE_REASONS.map(([, l]) => l)} onPick={(i) => { const [key] = goals.CLOSE_REASONS[i]; goals.setStatus(db, goal.id, key === 'achieved' ? 'achieved' : 'closed', key); bumpData(); setTimeout(() => setAsk('learned'), 0); }} />
      <Prompt open={ask === 'learned'} onClose={closeAsk} title={T.GOAL_LEARNED_PROMPT} multiline submitLabel="Guardar en el diario" onSubmit={(v) => { if (v.trim()) { const e = diary.create(db); diary.saveBody(db, e, `Cierre de «${goal.name}»`, v); diary.setGoal(db, e, goal.id); bumpData(); announce('Guardado en el diario.'); } }} />
      <Confirm open={ask === 'delete'} onClose={closeAsk} destructive title="¿Borrar el objetivo?" body={T.GOAL_DELETE_CONFIRM} confirmLabel="Borrar" onConfirm={() => { goals.delete(db, goal.id); bumpData(); navigate('/objetivos'); }} />
    </div>
  );
}

// ---- métricas ------------------------------------------------------------------------

function MetricsTab({ goal }: { goal: goals.Goal }) {
  const db = session.db!;
  const [, navigate] = useLocation();
  const list = metrics.listForGoal(db, goal.id, true);
  const [wiz, setWiz] = useState<null | 'name' | { kind: string } | { sens: string; kind: metrics.MetricKind } | { unit: string; kind: metrics.MetricKind; sensitive: boolean } | { warn: number }>(null);
  const [record, setRecord] = useState<null | { m: metrics.Metric; day: string } | { pickDay: metrics.Metric }>(null);
  const [tooMany, setTooMany] = useState(false);
  const t = today();
  const finishCreate = (name: string, kind: metrics.MetricKind, sensitive: boolean, unit: string) => {
    const id = metrics.create(db, { goal_id: goal.id, name, kind, unit, sensitive });
    bumpData();
    if (sensitive && !db.scalar<string>("SELECT value FROM settings WHERE key = 'sensitive_warning_shown'")) {
      db.run("INSERT INTO settings(key, value) VALUES ('sensitive_warning_shown', '1')");
      setTimeout(() => setWiz({ warn: id }), 0);
    } else setWiz(null);
  };
  const doRecord = (m: metrics.Metric, day: string, v: string) => {
    const parsed = metrics.parseValue(m.kind, v, m.scale_min, m.scale_max);
    if (!parsed) { announce(T.METRIC_VALUE_UNKNOWN); return; }
    metrics.record(db, m.id, day, parsed.value ?? null, parsed.text ?? null, '');
    const reached = milestones.evaluate(db, goal.id, t);
    bumpData();
    announce(reached.length ? `${T.MILESTONE_REACHED_MSG} ${reached[0].title}` : 'Registrado.');
  };
  return (
    <div className="stack">
      <Intro text={HELP.METRICS_INTRO} question="¿Qué es una métrica?" open={list.length === 0} />
      {list.length === 0 ? null : list.map((m) => {
        const last = metrics.measurements(db, m.id, 1)[0];
        const series = m.kind !== 'text' ? metrics.dailySeries(db, m, 60) : [];
        return (
          <div key={m.id} className="card metric-card" style={{ opacity: m.archived ? 0.7 : 1 }}>
            <div className="row">
              <button className="grow" style={{ textAlign: 'left' }} onClick={() => navigate(`/objetivos/${goal.id}/metrica/${m.id}`)}>
                <div style={{ fontWeight: 600 }}>{m.name}{m.archived ? ' · pausada' : ''}</div>
                <div className="t-foot t-muted">{plural(m.count, 'registro', 'registros')}{last ? ` · ${T.METRIC_LAST} ${fmtDateCompact(last.day, t)}` : ''} · {metrics.frequencyLabel(m.frequency)}</div>
              </button>
              {series.length > 1 && <Sparkline values={series.map((p) => p.value)} />}
            </div>
            <div className="row">
              {last && <span className="big">{metrics.formatValue(m.kind, last.value, last.text_value, m.unit)}</span>}
              <span className="grow" />
              {!m.archived && <button className="btn btn-secondary" onClick={() => setRecord({ m, day: t })}>Registrar</button>}
              <button className="btn btn-text" onClick={() => navigate(`/objetivos/${goal.id}/metrica/${m.id}`)}>Ver</button>
            </div>
          </div>
        );
      })}
      {tooMany && <p className="notice" role="status">{T.METRIC_TOO_MANY}</p>}
      <button className="btn btn-secondary btn-block" onClick={() => { if (metrics.countActive(db) >= 6) setTooMany(true); setWiz('name'); }}><Icon name="plus" /> Nueva métrica</button>
      <Prompt open={wiz === 'name'} onClose={() => setWiz(null)} title={T.METRIC_NAME_PROMPT} submitLabel="Siguiente" onSubmit={(v) => { if (v.trim()) setTimeout(() => setWiz({ kind: v.trim() }), 0); }} />
      <Choice open={!!(wiz && typeof wiz === 'object' && 'kind' in wiz)} onClose={() => setWiz(null)} title={T.METRIC_KIND_TITLE} options={metrics.METRIC_KINDS.map(metrics.metricKindLabel)} onPick={(i) => { if (wiz && typeof wiz === 'object' && 'kind' in wiz) setTimeout(() => setWiz({ sens: wiz.kind, kind: metrics.METRIC_KINDS[i] }), 0); }} />
      <Choice open={!!(wiz && typeof wiz === 'object' && 'sens' in wiz)} onClose={() => setWiz(null)} title={T.METRIC_SENSITIVE_ASK} options={['No', 'Sí']} onPick={(i) => {
        if (!(wiz && typeof wiz === 'object' && 'sens' in wiz)) return;
        const sensitive = i === 1;
        if (wiz.kind === 'number' || wiz.kind === 'count') setTimeout(() => setWiz({ unit: wiz.sens, kind: wiz.kind, sensitive }), 0);
        else finishCreate(wiz.sens, wiz.kind, sensitive, '');
      }} />
      <Prompt open={!!(wiz && typeof wiz === 'object' && 'unit' in wiz)} onClose={() => setWiz(null)} title={T.METRIC_UNIT_PROMPT} onSubmit={(v) => { if (wiz && typeof wiz === 'object' && 'unit' in wiz) finishCreate(wiz.unit, wiz.kind, wiz.sensitive, v); }} />
      <Sheet open={!!(wiz && typeof wiz === 'object' && 'warn' in wiz)} onClose={() => setWiz(null)} title={T.METRIC_SENSITIVE_TITLE} footer={<button className="btn btn-primary btn-block" onClick={() => setWiz(null)}>Entendido</button>}>
        <div className="notice"><p>{safety.sensitiveMetricText(db)}</p></div>
      </Sheet>
      <Prompt open={!!(record && 'm' in record)} onClose={() => setRecord(null)} title={record && 'm' in record ? `${record.m.name} · ${fmtDateCompact(record.day, t)}` : ''} label={record && 'm' in record ? `${T.METRIC_VALUE_PROMPT} (${valueHint(record.m)})` : ''} inputMode={record && 'm' in record && ['number', 'count', 'scale', 'duration'].includes(record.m.kind) ? 'decimal' : 'text'} submitLabel="Registrar" onSubmit={(v) => { if (record && 'm' in record) doRecord(record.m, record.day, v); }} />
    </div>
  );
}

export function valueHint(m: metrics.Metric): string {
  return { number: 'número, p. ej. 72,4', yes_no: 'sí / no', scale: `${m.scale_min} a ${m.scale_max}`, duration: 'minutos: 45 o 1:30', count: 'entero', time: 'hora: 23:15', text: 'texto' }[m.kind];
}

export function MetricView() {
  useDataVersion();
  const { id: gid, mid } = useParams<{ id: string; mid: string }>();
  const db = session.db!;
  const [, navigate] = useLocation();
  const goalId = Number(gid);
  const m = metrics.get(db, Number(mid));
  const [ask, setAsk] = useState<null | 'value' | 'day' | 'dir' | 'target' | 'freq' | 'archive' | 'delete' | { day: string } | { delM: number }>(null);
  const t = today();
  if (!m) { navigate(`/objetivos/${goalId}`); return null; }
  const series = m.kind !== 'text' ? metrics.dailySeries(db, m, 365) : [];
  const recent = metrics.measurements(db, m.id, 100);
  const weekly = m.frequency === 'weekly';
  const enough = series.length ? trend.enoughForTrend(series, m.kind, weekly) : { ok: false as const, message: T.METRIC_NO_DATA };
  const smooth = m.kind === 'number' || m.kind === 'scale' ? trend.movingAverage(series, 7) : series;
  const sum = m.kind === 'count' || m.kind === 'duration';
  const [cur, prev] = trend.weekOverWeek(series, t, sum);
  const change = trend.describeChange(cur, prev, m.unit, m.kind === 'number' ? 1 : 0);
  const level = trend.currentLevel(series, m.kind);
  const reg = m.kind === 'time' ? trend.timeRegularityMinutes(series.slice(-14).map((p) => p.value)) : undefined;
  const record = (day: string, v: string) => {
    const parsed = metrics.parseValue(m.kind, v, m.scale_min, m.scale_max);
    if (!parsed) { announce(T.METRIC_VALUE_UNKNOWN); return; }
    metrics.record(db, m.id, day, parsed.value ?? null, parsed.text ?? null, '');
    const reached = milestones.evaluate(db, goalId, t);
    bumpData();
    announce(reached.length ? `${T.MILESTONE_REACHED_MSG} ${reached[0].title}` : 'Registrado.');
  };
  const head = [metrics.metricKindLabel(m.kind).split(' ')[0], metrics.directionLabel(m.direction), m.direction === 'range' && m.target_low != null && m.target_high != null ? `${metrics.formatValue(m.kind, m.target_low, null, m.unit)}–${metrics.formatValue(m.kind, m.target_high, null, m.unit)}` : (m.direction === 'up' || m.direction === 'down' || m.direction === 'maintain') && m.target_low != null ? `referencia ${metrics.formatValue(m.kind, m.target_low, null, m.unit)}` : null, metrics.frequencyLabel(m.frequency)].filter(Boolean).join(' · ');
  return (
    <div className="screen">
      <Topbar title={m.name} back={`/objetivos/${goalId}`} subtitle={plural(m.count, 'registro', 'registros')} actions={<button className="btn btn-primary" onClick={() => setAsk('value')}>Registrar</button>} />
      <div className="content screen-body stack">
        <p className="t-foot t-muted">{head}</p>
        {series.length > 0 && m.kind !== 'text' && (
          <div className="card stack">
            {enough.ok ? (
              <>
                <TrendChart series={series} smooth={smooth} />
                <div className="row t-foot t-muted" style={{ justifyContent: 'space-between' }}><span>{fmtDateCompact(series[0].day, t)}</span><span>{fmtDateCompact(series[series.length - 1].day, t)}</span></div>
                {level != null && <p><strong>{m.kind === 'number' || m.kind === 'scale' ? T.METRIC_TREND_7 : T.METRIC_LAST}:</strong> {metrics.formatValue(m.kind, level, null, m.unit)}</p>}
                {reg != null ? <p>{T.METRIC_REGULARITY}: ±{Math.round(reg)} min (últimos 14 registros)</p> : change && <p>{change}</p>}
                {m.sensitive && <p className="t-muted">{T.METRIC_WEIGHT_NOTE}</p>}
              </>
            ) : (
              <>
                <Sparkline values={series.map((p) => p.value)} width={320} height={48} />
                <p className="t-muted">{enough.message}</p>
              </>
            )}
          </div>
        )}
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="chip" onClick={() => setAsk('day')}>Registrar otro día</button>
          <button className="chip" onClick={() => setAsk('dir')}>Dirección</button>
          <button className="chip" onClick={() => setAsk('freq')}>Frecuencia</button>
          <button className="chip" onClick={() => m.archived ? (metrics.setArchived(db, m.id, false), bumpData()) : setAsk('archive')}>{m.archived ? 'Reanudar' : 'Pausar'}</button>
          <button className="chip" style={{ color: 'var(--danger)' }} onClick={() => setAsk('delete')}>Borrar métrica</button>
        </div>
        <section>
          <h2 className="list-head">Registros</h2>
          <div className="list">{recent.map((r) => (
            <div key={r.id} className="list-item" style={{ minHeight: 44 }}>
              <span className="t-foot t-muted num" style={{ minWidth: 96 }}>{fmtDateShort(r.day)}</span>
              <span className="grow num">{metrics.formatValue(m.kind, r.value, r.text_value, m.unit)}{r.note && <span className="meta"> · {r.note}</span>}</span>
              <button className="btn btn-icon" aria-label="Borrar registro" onClick={() => setAsk({ delM: r.id })}><Icon name="close" size={16} /></button>
            </div>
          ))}</div>
          {recent.length === 0 && <p className="t-muted">{T.METRIC_NO_DATA}</p>}
        </section>
      </div>
      <Prompt open={ask === 'value'} onClose={() => setAsk(null)} title={`${m.name} · hoy`} label={`${T.METRIC_VALUE_PROMPT} (${valueHint(m)})`} inputMode={['number', 'count', 'scale', 'duration'].includes(m.kind) ? 'decimal' : 'text'} submitLabel="Registrar" onSubmit={(v) => record(t, v)} />
      <Prompt open={ask === 'day'} onClose={() => setAsk(null)} title={T.METRIC_DAY_PROMPT} submitLabel="Siguiente" onSubmit={(v) => { const r = parseDayInput(v, t); if (!r?.day) { announce(T.TASK_DATE_UNKNOWN); return; } setTimeout(() => setAsk({ day: r.day! }), 0); }} />
      <Prompt open={!!(ask && typeof ask === 'object' && 'day' in ask)} onClose={() => setAsk(null)} title={ask && typeof ask === 'object' && 'day' in ask ? `${m.name} · ${fmtDateCompact(ask.day, t)}` : ''} label={`${T.METRIC_VALUE_PROMPT} (${valueHint(m)})`} submitLabel="Registrar" onSubmit={(v) => { if (ask && typeof ask === 'object' && 'day' in ask) record(ask.day, v); }} />
      <Choice open={ask === 'dir'} onClose={() => setAsk(null)} title={T.METRIC_DIRECTION_TITLE} options={metrics.DIRECTIONS.map(metrics.directionLabel)} onPick={(i) => { const d = metrics.DIRECTIONS[i]; metrics.setDirection(db, m.id, d); if (d === 'observe') metrics.setTargets(db, m.id, null, null); bumpData(); if (d !== 'observe') setTimeout(() => setAsk('target'), 0); }} />
      <Prompt open={ask === 'target'} onClose={() => setAsk(null)} title={m.direction === 'range' ? T.METRIC_RANGE_PROMPT : T.METRIC_TARGET_PROMPT} inputMode="decimal" onSubmit={(v) => {
        const cur = metrics.get(db, m.id)!;
        if (cur.direction === 'range') { const p = v.split(/[-–]/).map((x) => Number(x.trim().replace(',', '.'))).filter((x) => !Number.isNaN(x)); if (p.length !== 2) { announce(T.METRIC_VALUE_UNKNOWN); return; } metrics.setTargets(db, m.id, Math.min(...p), Math.max(...p)); }
        else { const n = v.trim() ? Number(v.replace(',', '.')) : null; if (v.trim() && Number.isNaN(n)) { announce(T.METRIC_VALUE_UNKNOWN); return; } metrics.setTargets(db, m.id, n, cur.direction === 'maintain' ? n : null); }
        bumpData();
      }} />
      <Choice open={ask === 'freq'} onClose={() => setAsk(null)} title={T.METRIC_FREQ_TITLE} options={metrics.FREQUENCIES.map(metrics.frequencyLabel)} onPick={(i) => { metrics.setFrequency(db, m.id, metrics.FREQUENCIES[i]); bumpData(); }} />
      <Confirm open={ask === 'archive'} onClose={() => setAsk(null)} title="¿Pausar esta métrica?" body={T.METRIC_ARCHIVE_CONFIRM} confirmLabel="Pausar" onConfirm={() => { metrics.setArchived(db, m.id, true); bumpData(); }} />
      <Confirm open={ask === 'delete'} onClose={() => setAsk(null)} destructive title={`¿Borrar «${m.name}»?`} body="Se borrarán todos sus registros. Pausarla los conserva." confirmLabel="Borrar" onConfirm={() => { metrics.delete(db, m.id); bumpData(); navigate(`/objetivos/${goalId}`); }} />
      <Confirm open={!!(ask && typeof ask === 'object' && 'delM' in ask)} onClose={() => setAsk(null)} destructive title={T.METRIC_DELETE_MEASUREMENT} confirmLabel="Borrar" onConfirm={() => { if (ask && typeof ask === 'object' && 'delM' in ask) { metrics.deleteMeasurement(db, ask.delM); bumpData(); } }} />
    </div>
  );
}

// ---- hitos -------------------------------------------------------------------------------

function MilestonesTab({ goal }: { goal: goals.Goal }) {
  const db = session.db!;
  const t = today();
  milestones.evaluate(db, goal.id, t);
  const list = milestones.listForGoal(db, goal.id);
  const [wiz, setWiz] = useState<null | 'title' | { kind: string } | { pick: string; kind: milestones.MilestoneKind; ids: number[]; names: string[] } | { target: string; kind: milestones.MilestoneKind; ref: number | null } | { day: string }>(null);
  const [ask, setAsk] = useState<null | { resched: milestones.Milestone } | { note: milestones.Milestone; day: string | null } | { del: milestones.Milestone } | { menu: milestones.Milestone }>(null);
  const create = (title: string, kind: milestones.MilestoneKind, ref: number | null, target: number | null, day: string | null) => {
    milestones.create(db, { goal_id: goal.id, title, kind, metric_id: kind === 'metric_value' ? ref : null, action_id: kind === 'action_count' || kind === 'sustain_weeks' ? ref : null, target_value: target, target_day: day });
    bumpData(); setWiz(null);
  };
  const menu = ask && 'menu' in ask ? ask.menu : null;
  return (
    <div className="stack">
      <Intro text={HELP.MILESTONES_INTRO} question="¿Qué es un hito?" open={list.length === 0} />
      {list.length === 0 ? null : (
        <div className="list">{list.map((ms) => {
          const prog = milestones.progress(db, ms, t);
          const bar = prog ? spark.progressBar(prog[0], prog[1], 10, '') : null;
          return (
            <div key={ms.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <button className="btn btn-icon" aria-label={ms.status === 'reached' ? 'Alcanzado; tocar para volver a pendiente' : 'Marcar alcanzado'} onClick={() => { if (ms.status === 'reached') milestones.markPending(db, ms.id); else milestones.markReached(db, ms.id); bumpData(); }}>
                <span className={`dot ${ms.status === 'reached' ? 'is-done' : ms.status === 'dropped' ? 'is-not' : 'is-blank'}`} style={{ width: 20, height: 20 }} />
              </button>
              <span className="grow stack" style={{ gap: 4 }}>
                <span style={{ color: ms.status === 'pending' ? 'var(--ink)' : 'var(--ink-2)' }}>{ms.title}</span>
                {bar && <><ProgressBar ratio={bar.ratio} /><span className="meta">{bar.text}</span></>}
                <span className="meta">{[milestones.milestoneKindLabel(ms.kind), ms.target_day ? fmtDateCompact(ms.target_day, t) : null, ms.status === 'reached' ? `${T.MILESTONE_REACHED} ${ms.reached_at ? fmtDateCompact(tsToDay(ms.reached_at), t) : ''}` : ms.status === 'dropped' ? T.MILESTONE_DROPPED : null].filter(Boolean).join(' · ')}</span>
              </span>
              <button className="btn btn-icon" aria-label={`Opciones de ${ms.title}`} onClick={() => setAsk({ menu: ms })}><Icon name="more" /></button>
            </div>
          );
        })}</div>
      )}
      <button className="btn btn-secondary btn-block" onClick={() => setWiz('title')}><Icon name="plus" /> Nuevo hito</button>
      <Prompt open={wiz === 'title'} onClose={() => setWiz(null)} title={T.MILESTONE_TITLE_PROMPT} submitLabel="Siguiente" onSubmit={(v) => { if (v.trim()) setTimeout(() => setWiz({ kind: v.trim() }), 0); }} />
      <Choice open={!!(wiz && typeof wiz === 'object' && 'kind' in wiz)} onClose={() => setWiz(null)} title={T.MILESTONE_KIND_TITLE} options={milestones.MILESTONE_KINDS.map(milestones.milestoneKindLabel)} onPick={(i) => {
        if (!(wiz && typeof wiz === 'object' && 'kind' in wiz)) return;
        const kind = milestones.MILESTONE_KINDS[i];
        if (kind === 'manual') create(wiz.kind, kind, null, null, null);
        else if (kind === 'date') setTimeout(() => setWiz({ day: wiz.kind }), 0);
        else if (kind === 'metric_value') { const ms = metrics.listForGoal(db, goal.id, false); if (!ms.length) { announce('Primero define una métrica en la pestaña Métricas.'); setWiz(null); return; } setTimeout(() => setWiz({ pick: wiz.kind, kind, ids: ms.map((x) => x.id), names: ms.map((x) => x.name) }), 0); }
        else { const as = actions.listForGoal(db, goal.id, false); if (!as.length) { announce('Primero define una acción en la pestaña Acciones.'); setWiz(null); return; } setTimeout(() => setWiz({ pick: wiz.kind, kind, ids: as.map((x) => x.id), names: as.map((x) => x.name) }), 0); }
      }} />
      <Choice open={!!(wiz && typeof wiz === 'object' && 'pick' in wiz)} onClose={() => setWiz(null)} title={wiz && typeof wiz === 'object' && 'pick' in wiz && wiz.kind === 'metric_value' ? T.MILESTONE_PICK_METRIC : T.MILESTONE_PICK_ACTION} options={wiz && typeof wiz === 'object' && 'pick' in wiz ? wiz.names : []} onPick={(i) => { if (wiz && typeof wiz === 'object' && 'pick' in wiz) setTimeout(() => setWiz({ target: wiz.pick, kind: wiz.kind, ref: wiz.ids[i] }), 0); }} />
      <Prompt open={!!(wiz && typeof wiz === 'object' && 'target' in wiz)} onClose={() => setWiz(null)} title={T.MILESTONE_TARGET_PROMPT} inputMode="decimal" onSubmit={(v) => { const n = Number(v.replace(',', '.')); if (Number.isNaN(n)) { announce(T.METRIC_VALUE_UNKNOWN); return; } if (wiz && typeof wiz === 'object' && 'target' in wiz) create(wiz.target, wiz.kind, wiz.ref, n, null); }} />
      <Prompt open={!!(wiz && typeof wiz === 'object' && 'day' in wiz)} onClose={() => setWiz(null)} title={T.MILESTONE_DAY_PROMPT} onSubmit={(v) => { const r = parseDayInput(v, t); if (!r?.day) { announce(T.TASK_DATE_UNKNOWN); return; } if (wiz && typeof wiz === 'object' && 'day' in wiz) create(wiz.day, 'date', null, null, r.day); }} />
      <Choice open={!!menu} onClose={() => setAsk(null)} title={menu?.title ?? ''} options={['Reprogramar la fecha', menu?.status === 'dropped' ? 'Volver a pendiente' : 'Descartar', 'Borrar']} onPick={(i) => { if (!menu) return; if (i === 0) setTimeout(() => setAsk({ resched: menu }), 0); else if (i === 1) { if (menu.status === 'dropped') milestones.markPending(db, menu.id); else milestones.markDropped(db, menu.id); bumpData(); } else setTimeout(() => setAsk({ del: menu }), 0); }} />
      <Prompt open={!!(ask && 'resched' in ask)} onClose={() => setAsk(null)} title={T.MILESTONE_RESCHEDULE_PROMPT} initial={ask && 'resched' in ask ? ask.resched.target_day ?? '' : ''} submitLabel="Siguiente" onSubmit={(v) => { const r = parseDayInput(v, t); if (!r) { announce(T.TASK_DATE_UNKNOWN); return; } if (ask && 'resched' in ask) setTimeout(() => setAsk({ note: ask.resched, day: r.day }), 0); }} />
      <Prompt open={!!(ask && 'note' in ask)} onClose={() => setAsk(null)} title={T.MILESTONE_RESCHEDULE_NOTE} onSubmit={(v) => { if (ask && 'note' in ask) { milestones.reschedule(db, ask.note.id, ask.day, v); bumpData(); } }} />
      <Confirm open={!!(ask && 'del' in ask)} onClose={() => setAsk(null)} destructive title={T.MILESTONE_DELETE_CONFIRM} confirmLabel="Borrar" onConfirm={() => { if (ask && 'del' in ask) { milestones.delete(db, ask.del.id); bumpData(); } }} />
    </div>
  );
}

// ---- acciones ------------------------------------------------------------------------

function ActionsTab({ goal }: { goal: goals.Goal }) {
  const db = session.db!;
  const t = today();
  const list = actions.listForGoal(db, goal.id, true);
  const [wiz, setWiz] = useState<null | 'name' | { sched: string } | { avoid: string; schedule: actions.Schedule } | { cue: number }>(null);
  const [ask, setAsk] = useState<null | { menu: actions.Action } | { rename: actions.Action } | { resched: actions.Action } | { cue: actions.Action } | { note: actions.Action } | { del: actions.Action }>(null);
  const menu = ask && 'menu' in ask ? ask.menu : null;
  return (
    <div className="stack">
      <Intro text={HELP.ACTIONS_INTRO} question="¿Qué es una acción?" open={list.length === 0} />
      {list.length === 0 ? null : list.map((a) => {
        const st = actions.statusOn(db, a.id, t);
        const s = actions.summary(db, a, t);
        const done = new Set(actions.doneDays(db, a.id, weekStart(t), t));
        const rows = spark.activityRows(done, new Set(), t, 1);
        const parts = [st === true ? T.ACTION_TODAY_DONE : st === false ? T.ACTION_TODAY_NOT : T.ACTION_TODAY_BLANK, `${s.this_week} de ${s.per_week} ${T.ACTION_THIS_WEEK}`, `${s.last30} ${T.ACTION_LAST30}`];
        if (s.weeks_meeting_target >= 2) parts.push(`${s.weeks_meeting_target} ${T.ACTION_WEEKS_OK}`);
        const srbai = prompts.srbaiHistory(db, a.id)[0];
        if (srbai) parts.push(`${T.SRBAI_TITLE.toLowerCase()} ${srbai[1].toFixed(1).replace('.', ',')} de 5 (${fmtDateCompact(srbai[0], t)})`);
        return (
          <div key={a.id} className="card stack" style={{ opacity: a.paused || a.archived ? 0.7 : 1 }}>
            <div className="row">
              <button className="btn btn-icon" aria-label={st === true ? 'Hecha hoy; tocar para marcar no hecha' : st === false ? 'Marcada no hecha; tocar para quitar el registro' : 'Sin registro hoy; tocar para marcar hecha'} onClick={() => { const next = st === undefined ? true : st ? false : null; actions.log(db, a.id, t, next, ''); bumpData(); if (next === false) announce(`${T.LAPSE_LINE1} ${a.name}: ${s.last30} de los últimos 30 días.`); }}>
                <span className={`dot ${st === true ? 'is-done' : st === false ? 'is-not' : 'is-blank'}`} style={{ width: 22, height: 22 }} />
              </button>
              <span className="grow"><span style={{ fontWeight: 600 }}>{a.avoid ? 'evitar: ' : ''}{a.name}</span><span className="meta" style={{ display: 'block' }}>{[a.paused ? 'pausada' : null, actions.Schedule.describe(a.schedule), a.cue || null].filter(Boolean).join(' · ')}</span></span>
              <button className="btn btn-icon" aria-label={`Opciones de ${a.name}`} onClick={() => setAsk({ menu: a })}><Icon name="more" /></button>
            </div>
            <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
              <WeekDots days={rows[0]?.days ?? []} />
              <span className="t-foot t-muted">{parts.join(' · ')}</span>
            </div>
          </div>
        );
      })}
      <button className="btn btn-secondary btn-block" onClick={() => setWiz('name')}><Icon name="plus" /> Nueva acción</button>
      <Prompt open={wiz === 'name'} onClose={() => setWiz(null)} title={T.ACTION_NAME_PROMPT} submitLabel="Siguiente" onSubmit={(v) => { if (v.trim()) setTimeout(() => setWiz({ sched: v.trim() }), 0); }} />
      <Prompt open={!!(wiz && typeof wiz === 'object' && 'sched' in wiz)} onClose={() => setWiz(null)} title={T.ACTION_SCHEDULE_PROMPT} initial="3 veces por semana" submitLabel="Siguiente" onSubmit={(v) => { const s = actions.Schedule.parseHuman(v); if (!s) { announce(T.ACTION_SCHEDULE_UNKNOWN); return; } if (wiz && typeof wiz === 'object' && 'sched' in wiz) setTimeout(() => setWiz({ avoid: wiz.sched, schedule: s }), 0); }} />
      <Choice open={!!(wiz && typeof wiz === 'object' && 'avoid' in wiz)} onClose={() => setWiz(null)} title={T.ACTION_AVOID_ASK} options={['No, es algo que quiero hacer', 'Sí, quiero dejar de hacerlo']} onPick={(i) => { if (wiz && typeof wiz === 'object' && 'avoid' in wiz) { const id = actions.create(db, goal.id, wiz.avoid, wiz.schedule, i === 1); bumpData(); setTimeout(() => setWiz({ cue: id }), 0); } }} />
      <Prompt open={!!(wiz && typeof wiz === 'object' && 'cue' in wiz)} onClose={() => setWiz(null)} title={T.ACTION_CUE_PROMPT} onSubmit={(v) => { if (wiz && typeof wiz === 'object' && 'cue' in wiz) { actions.setCue(db, wiz.cue, v); bumpData(); } }} />
      <Choice open={!!menu} onClose={() => setAsk(null)} title={menu?.name ?? ''} options={['Nota de hoy', 'Renombrar', 'Frecuencia', 'Señal o momento', menu?.paused ? 'Reanudar' : 'Pausar', 'Borrar con su historial']} onPick={(i) => {
        if (!menu) return;
        if (i === 0) setTimeout(() => setAsk({ note: menu }), 0); else if (i === 1) setTimeout(() => setAsk({ rename: menu }), 0); else if (i === 2) setTimeout(() => setAsk({ resched: menu }), 0); else if (i === 3) setTimeout(() => setAsk({ cue: menu }), 0);
        else if (i === 4) { actions.setPaused(db, menu.id, !menu.paused); bumpData(); } else setTimeout(() => setAsk({ del: menu }), 0);
      }} />
      <Prompt open={!!(ask && 'note' in ask)} onClose={() => setAsk(null)} title={T.ACTION_NOTE_PROMPT} onSubmit={(v) => { if (ask && 'note' in ask) { const st = actions.statusOn(db, ask.note.id, t); actions.log(db, ask.note.id, t, st ?? true, v); bumpData(); } }} />
      <Prompt open={!!(ask && 'rename' in ask)} onClose={() => setAsk(null)} title={T.ACTION_NAME_PROMPT} initial={ask && 'rename' in ask ? ask.rename.name : ''} onSubmit={(v) => { if (ask && 'rename' in ask && v.trim()) { actions.setName(db, ask.rename.id, v); bumpData(); } }} />
      <Prompt open={!!(ask && 'resched' in ask)} onClose={() => setAsk(null)} title={T.ACTION_SCHEDULE_PROMPT} initial={ask && 'resched' in ask ? actions.Schedule.describe(ask.resched.schedule) : ''} onSubmit={(v) => { const s = actions.Schedule.parseHuman(v); if (!s) { announce(T.ACTION_SCHEDULE_UNKNOWN); return; } if (ask && 'resched' in ask) { actions.setSchedule(db, ask.resched.id, s); bumpData(); } }} />
      <Prompt open={!!(ask && 'cue' in ask)} onClose={() => setAsk(null)} title={T.ACTION_CUE_PROMPT} initial={ask && 'cue' in ask ? ask.cue.cue : ''} onSubmit={(v) => { if (ask && 'cue' in ask) { actions.setCue(db, ask.cue.id, v); bumpData(); } }} />
      <Confirm open={!!(ask && 'del' in ask)} onClose={() => setAsk(null)} destructive title={T.ACTION_DELETE_CONFIRM} confirmLabel="Borrar" onConfirm={() => { if (ask && 'del' in ask) { actions.delete(db, ask.del.id); bumpData(); } }} />
    </div>
  );
}

// ---- planes si-entonces -------------------------------------------------------------------

function PlansTab({ goal }: { goal: goals.Goal }) {
  const db = session.db!;
  const list = plans.listForGoal(db, goal.id, true);
  const [wiz, setWiz] = useState<null | 'sit' | { resp: string; vague: boolean }>(null);
  const [ask, setAsk] = useState<null | { menu: plans.Plan } | { review: plans.Plan } | { editSit: plans.Plan } | { editResp: plans.Plan; sit: string } | { del: plans.Plan } | { offerArchive: plans.Plan }>(null);
  const [saved, setSaved] = useState(false);
  const menu = ask && 'menu' in ask ? ask.menu : null;
  return (
    <div className="stack">
      <Intro text={HELP.PLANS_INTRO} question="¿Qué es un plan si–entonces?" open={list.length === 0} />
      {list.length === 0 ? null : (
        <div className="list">{list.map((p) => {
          const total = p.helpful_yes + p.helpful_partly + p.helpful_no + p.not_used;
          return (
            <div key={p.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <span className="grow" style={{ color: p.archived ? 'var(--ink-2)' : undefined }}>
                <span><span className="t-muted">Si </span>{p.situation}</span>
                <span style={{ display: 'block' }}><span className="t-muted">→ </span>{p.response}</span>
                <span className="meta" style={{ display: 'block' }}>{[p.archived ? 'archivado' : null, total ? `${total} ${T.PLAN_REVIEWS}: ${p.helpful_yes} sí, ${p.helpful_partly} en parte, ${p.helpful_no} no, ${p.not_used} sin darse` : null].filter(Boolean).join(' · ')}</span>
              </span>
              <button className="btn btn-icon" aria-label="Opciones del plan" onClick={() => setAsk({ menu: p })}><Icon name="more" /></button>
            </div>
          );
        })}</div>
      )}
      {saved && <div className="notice stack" role="status"><p>{T.PLAN_SAVED}</p><p>{T.PLAN_BOOSTERS}</p></div>}
      <button className="btn btn-secondary btn-block" onClick={() => { setSaved(false); setWiz('sit'); }}><Icon name="plus" /> Nuevo plan</button>
      <Prompt open={wiz === 'sit'} onClose={() => setWiz(null)} title={T.PLAN_SITUATION_PROMPT} submitLabel="Siguiente" onSubmit={(v) => { if (!v.trim()) return; setTimeout(() => setWiz({ resp: v.trim(), vague: plans.isVague(v) }), 0); }} />
      <Prompt open={!!(wiz && typeof wiz === 'object' && 'resp' in wiz)} onClose={() => setWiz(null)} title={T.PLAN_RESPONSE_PROMPT} help={wiz && typeof wiz === 'object' && 'resp' in wiz && wiz.vague ? T.PLAN_VAGUE : undefined} submitLabel="Guardar" onSubmit={(v) => { if (wiz && typeof wiz === 'object' && 'resp' in wiz && v.trim()) { plans.create(db, goal.id, null, wiz.resp, v, true); bumpData(); setSaved(true); } }} />
      <Choice open={!!menu} onClose={() => setAsk(null)} title={menu ? `Si ${menu.situation}` : ''} options={['¿Te sirvió este plan?', 'Editar', menu?.archived ? 'Recuperar' : 'Archivar', 'Borrar']} onPick={(i) => { if (!menu) return; if (i === 0) setTimeout(() => setAsk({ review: menu }), 0); else if (i === 1) setTimeout(() => setAsk({ editSit: menu }), 0); else if (i === 2) { plans.setArchived(db, menu.id, !menu.archived); bumpData(); } else setTimeout(() => setAsk({ del: menu }), 0); }} />
      <Choice open={!!(ask && 'review' in ask)} onClose={() => setAsk(null)} title={T.PLAN_REVIEW_ASK} options={plans.HELPFUL.map(([, l]) => l)} onPick={(i) => { if (ask && 'review' in ask) { const offer = plans.review(db, ask.review.id, plans.HELPFUL[i][0], ''); bumpData(); if (offer) setTimeout(() => setAsk({ offerArchive: ask.review }), 0); } }} />
      <Confirm open={!!(ask && 'offerArchive' in ask)} onClose={() => setAsk(null)} title={T.PLAN_OFFER_ARCHIVE} confirmLabel="Archivar" onConfirm={() => { if (ask && 'offerArchive' in ask) { plans.setArchived(db, ask.offerArchive.id, true); bumpData(); } }} />
      <Prompt open={!!(ask && 'editSit' in ask)} onClose={() => setAsk(null)} title={T.PLAN_SITUATION_PROMPT} initial={ask && 'editSit' in ask ? ask.editSit.situation : ''} submitLabel="Siguiente" onSubmit={(v) => { if (ask && 'editSit' in ask && v.trim()) setTimeout(() => setAsk({ editResp: ask.editSit, sit: v.trim() }), 0); }} />
      <Prompt open={!!(ask && 'editResp' in ask)} onClose={() => setAsk(null)} title={T.PLAN_RESPONSE_PROMPT} initial={ask && 'editResp' in ask ? ask.editResp.response : ''} onSubmit={(v) => { if (ask && 'editResp' in ask && v.trim()) { plans.update(db, ask.editResp.id, ask.sit, v); bumpData(); } }} />
      <Confirm open={!!(ask && 'del' in ask)} onClose={() => setAsk(null)} destructive title={T.PLAN_DELETE_CONFIRM} confirmLabel="Borrar" onConfirm={() => { if (ask && 'del' in ask) { plans.delete(db, ask.del.id); bumpData(); } }} />
    </div>
  );
}

export { addDays };

