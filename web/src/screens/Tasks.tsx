import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { session } from '../app/session';
import { bumpData, useDataVersion } from '../app/useSession';
import * as tk from '../domain/tasks';
import * as rec from '../domain/recurrence';
import { addDays, fmtDateCompact, fmtDateLong, fmtRelativeDays, parseDayInput, today, daysInMonth, parseDay, weekdayIndex, MONTHS, WEEKDAYS_INITIAL, WEEKDAYS_SHORT } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Prompt, Confirm, Choice, Sheet } from '../ui/Sheet';
import { announce } from '../ui/Live';
import { TextEditor, useAutosave } from '../ui/Editor';
import { T } from '../text/texts';
import { HELP } from '../text/help';

type Tab = 'list' | 'calendar' | 'projects' | 'done';
const TABS: { key: Tab; label: string; slug: string }[] = [
  { key: 'list', label: T.TASKS_LIST, slug: 'pendientes' }, { key: 'calendar', label: T.TASKS_CALENDAR, slug: 'calendario' },
  { key: 'projects', label: T.TASKS_PROJECTS, slug: 'proyectos' }, { key: 'done', label: T.TASKS_DONE, slug: 'hechas' },
];
/** Rutas antiguas (/tareas/hoy, /tareas/proximas, /tareas/sin-fecha) llevan a la lista única. */
const tabFromSlug = (slug?: string): Tab | undefined => TABS.find((x) => x.slug === slug)?.key ?? (slug && ['hoy', 'proximas', 'sin-fecha'].includes(slug) ? 'list' : undefined);

const BUCKET_LABEL: Record<tk.Bucket, string> = { overdue: T.TASKS_OVERDUE, today: T.TASKS_TODAY, tomorrow: T.TASKS_TOMORROW, week: T.TASKS_WEEK, later: T.TASKS_LATER, someday: T.TASKS_SOMEDAY };

/**
 * Tareas: una sola lista de lo pendiente agrupada por cercanía (vencidas, hoy, mañana,
 * próximos siete días, más adelante, sin fecha). El día que manda es el más cercano entre
 * el previsto y el límite, así ninguna tarea «desaparece» por tener sólo fecha límite.
 * Calendario, Proyectos y Hechas son otras maneras de mirar lo mismo.
 */
export function Tasks() {
  const dataVersion = useDataVersion();
  const db = session.db!;
  const { tab: slug } = useParams<{ tab?: string }>();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>(tabFromSlug(slug) ?? 'list');
  useEffect(() => { const k = tabFromSlug(slug); if (k) setTab(k); }, [slug]);
  const [calDay, setCalDay] = useState(today());
  const [open, setOpen] = useState<tk.Task | null>(null);
  const [sheet, setSheet] = useState<null | 'new' | 'newProject'>(null);
  const t = today();
  const groups = useMemo(() => (tab === 'list' ? tk.grouped(db, t) : []), [db, dataVersion, tab, t]);
  const dayTasks = useMemo(() => (tab === 'calendar' ? tk.onDay(db, calDay) : []), [db, dataVersion, tab, calDay]);
  const done = useMemo(() => (tab === 'done' ? tk.listDone(db) : []), [db, dataVersion, tab]);
  const projects = useMemo(() => (tab === 'projects' ? tk.listProjects(db, true) : []), [db, dataVersion, tab]);
  // Las hechas hoy se quedan al final de la lista (máximo 10) en vez de desaparecer al marcarlas.
  const doneToday = useMemo(() => (tab === 'list' ? tk.doneOn(db, t) : []), [db, dataVersion, tab, t]);
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);

  return (
    <div className="screen">
      <Topbar title={T.TASKS} actions={<button className="btn btn-primary" onClick={() => setSheet(tab === 'projects' ? 'newProject' : 'new')}><Icon name="plus" /> {tab === 'projects' ? 'Proyecto' : 'Tarea'}</button>} />
      <div className="content screen-body">
        <div className="segments" role="tablist">
          {TABS.map((x) => <button key={x.key} role="tab" aria-selected={tab === x.key} className="segment" onClick={() => setTab(x.key)}>{x.label}</button>)}
        </div>
        {tab === 'list' && (
          total === 0 ? (
            <div className="empty"><p>{T.TASKS_EMPTY_LIST[0]}</p><p>{T.TASKS_EMPTY_LIST[1]}</p></div>
          ) : (
            <div className="stack-lg">
              {groups.map((g) => (
                <section key={g.bucket} aria-labelledby={`h-${g.bucket}`}>
                  <h2 id={`h-${g.bucket}`} className={`list-head ${g.bucket === 'overdue' ? 'is-warn' : ''}`}>{BUCKET_LABEL[g.bucket]} <span className="t-faint num" aria-hidden="true">{g.tasks.length}</span></h2>
                  {g.bucket === 'overdue' && <p className="t-foot t-muted" style={{ marginTop: -4, marginBottom: 6 }}>{HELP.TASKS_OVERDUE_HELP}</p>}
                  <TaskList tasks={g.tasks} today={t} onOpen={setOpen} bucket={g.bucket} />
                </section>
              ))}
            </div>
          )
        )}
        {tab === 'calendar' && (
          <>
            <Calendar day={calDay} onPick={setCalDay} marks={tk.daysWithTasks(db, calDay.slice(0, 8) + '01', calDay.slice(0, 8) + daysInMonth(Number(calDay.slice(0, 4)), Number(calDay.slice(5, 7))))} />
            {dayTasks.length === 0 ? <div className="empty"><p>Nada previsto ese día.</p></div> : <TaskList tasks={dayTasks} today={t} onOpen={setOpen} />}
          </>
        )}
        {tab === 'projects' && (
          projects.length === 0 ? <div className="empty"><p>{T.TASKS_EMPTY_PROJECTS[0]}</p><p>{HELP.PROJECT_WHAT}</p></div> : (
            <div className="list">{projects.map((p) => (
              <button key={p.id} className="list-item" onClick={() => navigate(`/tareas/proyecto/${p.id}`)}>
                <span className="grow"><span style={{ color: p.archived ? 'var(--ink-2)' : undefined }}>{p.name}</span><span className="meta" style={{ display: 'block' }}>{p.open_tasks} abiertas · {p.done_tasks} hechas{p.archived ? ' · archivado' : ''}</span></span>
                <Icon name="forward" className="t-faint" />
              </button>
            ))}</div>
          )
        )}
        {tab === 'done' && (
          done.length === 0 ? <div className="empty"><p>{T.TASKS_EMPTY_DONE[0]}</p></div> : <TaskList tasks={done} today={t} onOpen={setOpen} />
        )}
        {tab === 'list' && <DoneSection tasks={doneToday} today={t} onOpen={setOpen} />}
      </div>
      <NewTaskSheet open={sheet === 'new'} onClose={() => setSheet(null)} today={t} initialDay={tab === 'calendar' ? calDay : t} onCreate={(title, day) => { tk.create(db, { title, scheduled_day: day, project_id: null }); bumpData(); }} />
      <Prompt open={sheet === 'newProject'} onClose={() => setSheet(null)} title={T.PROJECT_NAME_PROMPT} submitLabel="Crear" onSubmit={(v) => { if (v.trim()) { tk.createProject(db, v, null); bumpData(); } }} />
      {open && <TaskDetail task={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/**
 * Nueva tarea: el título y, debajo, «¿cuándo?» con fichas (hoy, mañana, sin fecha, otro
 * día). Elegir un día es una invitación, no una exigencia: decidir cuándo descarga la
 * cabeza (Masicampo y Baumeister, 2011) y hace más probable hacerlo (Gollwitzer, 1999).
 */
export function NewTaskSheet({ open, onClose, today: t, initialDay, onCreate, help }: { open: boolean; onClose: () => void; today: string; initialDay: string | null; onCreate: (title: string, day: string | null) => void; help?: string }) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<string | null>(initialDay);
  const [other, setOther] = useState('');
  const [otherOn, setOtherOn] = useState(false);
  useEffect(() => { if (open) { setTitle(''); setDay(initialDay); setOther(''); setOtherOn(false); } }, [open, initialDay]);
  const tomorrow = addDays(t, 1);
  const chips: [string, string | null][] = [['Hoy', t], ['Mañana', tomorrow], ['Sin fecha', null]];
  const otherDay = otherOn ? (parseDayInput(other, t)?.day ?? null) : null;
  const chosen = otherOn ? otherDay : day;
  const submit = () => {
    const v = title.trim();
    if (!v) return;
    if (otherOn && other.trim() && parseDayInput(other, t) === undefined) { announce(T.TASK_DATE_UNKNOWN); return; }
    onCreate(v, chosen);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={T.TASK_TITLE_PROMPT} closeLabel="Cancelar" footer={<button className="btn btn-primary btn-block" disabled={!title.trim()} onClick={submit}>Añadir</button>}>
      <div className="stack">
        <input className="input prompt-input" aria-label={T.TASK_TITLE_LABEL_NEW} value={title} autoFocus onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        <div className="field">
          <label>{T.TASK_WHEN}</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {chips.map(([label, d]) => <button key={label} type="button" className="chip" aria-pressed={!otherOn && day === d} onClick={() => { setOtherOn(false); setDay(d); }}>{label}</button>)}
            <button type="button" className="chip" aria-pressed={otherOn} onClick={() => setOtherOn(true)}>Otro día</button>
          </div>
          {otherOn && <input className="input" style={{ marginTop: 8 }} aria-label="Qué día" placeholder="lun, +3, 20, 15/12" value={other} autoFocus onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />}
          <span className="help">{help ?? (chosen ? `${T.TASK_WHEN_HELP_DAY} ${fmtDateCompact(chosen, t)}. ${T.TASK_WHEN_HELP_TAIL}` : `${T.TASK_WHEN_HELP_NONE} ${T.TASK_WHEN_HELP_TAIL}`)}</span>
        </div>
      </div>
    </Sheet>
  );
}

/** Un proyecto como pantalla propia: sus tareas abiertas, las hechas al final, y sus opciones. */
export function ProjectTasks() {
  const dataVersion = useDataVersion();
  const db = session.db!;
  const { id: idStr } = useParams<{ id: string }>();
  const id = Number(idStr);
  const [, navigate] = useLocation();
  const [open, setOpen] = useState<tk.Task | null>(null);
  const [sheet, setSheet] = useState<null | 'new' | 'options' | 'rename' | 'delete'>(null);
  const t = today();
  const project = useMemo(() => tk.listProjects(db, true).find((p) => p.id === id) ?? null, [db, dataVersion, id]);
  const { openTasks, done } = useMemo(() => {
    const all = project ? tk.listForProject(db, project.id) : [];
    return { openTasks: all.filter((x) => x.status === 'open'), done: all.filter((x) => x.status !== 'open').slice(0, 10) };
  }, [db, dataVersion, project]);
  if (!project) return <div className="screen"><Topbar title={T.TASKS_PROJECTS} back="/tareas/proyectos" /><div className="content screen-body"><p className="t-muted">{HELP.PROJECT_MISSING}</p></div></div>;
  return (
    <div className="screen">
      <Topbar title={project.name} subtitle={`${project.open_tasks} abiertas · ${project.done_tasks} hechas${project.archived ? ' · archivado' : ''}`} back="/tareas/proyectos"
        actions={<>
          <button className="btn btn-icon" aria-label={HELP.PROJECT_OPTIONS} onClick={() => setSheet('options')}><Icon name="more" /></button>
          <button className="btn btn-primary" onClick={() => setSheet('new')}><Icon name="plus" /> Tarea</button>
        </>} />
      <div className="content screen-body">
        {openTasks.length === 0 ? (
          <div className="empty"><p>{HELP.PROJECT_EMPTY[0]}</p><p>{HELP.PROJECT_EMPTY[1]}</p></div>
        ) : (
          <TaskList tasks={openTasks} today={t} onOpen={setOpen} />
        )}
        <DoneSection tasks={done} today={t} onOpen={setOpen} title={HELP.PROJECT_DONE_HEAD} />
      </div>
      <NewTaskSheet open={sheet === 'new'} onClose={() => setSheet(null)} today={t} initialDay={null} help={HELP.PROJECT_NEW_TASK_HELP.replace('{p}', project.name)} onCreate={(title, day) => { tk.create(db, { title, scheduled_day: day, project_id: project.id }); bumpData(); }} />
      <Sheet open={sheet === 'options'} onClose={() => setSheet(null)} title={HELP.PROJECT_OPTIONS}>
        <div className="list">
          <button className="list-item" onClick={() => setSheet('rename')}><Icon name="edit" className="t-muted" /><span className="grow">{HELP.PROJECT_RENAME}</span><Icon name="forward" className="t-faint" /></button>
          <button className="list-item" onClick={() => { tk.setProjectArchived(db, project.id, !project.archived); bumpData(); setSheet(null); announce(project.archived ? HELP.PROJECT_UNARCHIVED : HELP.PROJECT_ARCHIVED); }}>
            <Icon name="archive" className="t-muted" /><span className="grow"><span>{project.archived ? HELP.PROJECT_UNARCHIVE : HELP.PROJECT_ARCHIVE}</span><span className="meta" style={{ display: 'block' }}>{HELP.PROJECT_ARCHIVE_HELP}</span></span>
          </button>
          <button className="list-item" style={{ color: 'var(--danger)' }} onClick={() => setSheet('delete')}><Icon name="trash" /><span className="grow"><span>{HELP.PROJECT_DELETE}</span><span className="meta" style={{ display: 'block' }}>{T.PROJECT_DELETE_CONFIRM.replace('¿Borrar el proyecto? ', '')}</span></span></button>
        </div>
      </Sheet>
      <Prompt open={sheet === 'rename'} onClose={() => setSheet(null)} title={T.PROJECT_NAME_PROMPT} initial={project.name} submitLabel="Guardar" onSubmit={(v) => { if (v.trim()) { tk.renameProject(db, project.id, v.trim()); bumpData(); } }} />
      <Confirm open={sheet === 'delete'} onClose={() => setSheet(null)} destructive title="¿Borrar este proyecto?" body={T.PROJECT_DELETE_CONFIRM.replace('¿Borrar el proyecto? ', '')} confirmLabel="Borrar" onConfirm={() => { tk.deleteProject(db, project.id); bumpData(); navigate('/tareas/proyectos'); }} />
      {open && <TaskDetail task={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function TaskList({ tasks, today: t, onOpen, bucket, muted }: { tasks: tk.Task[]; today: string; onOpen: (task: tk.Task) => void; bucket?: tk.Bucket; muted?: boolean }) {
  return <div className={`list ${muted ? 'list-done' : ''}`} style={muted ? { opacity: 0.8 } : undefined}>{tasks.map((task) => <TaskRow key={task.id} task={task} today={t} onOpen={() => onOpen(task)} bucket={bucket} />)}</div>;
}

function DoneSection({ tasks, today: t, onOpen, title = HELP.TASKS_DONE_TODAY }: { tasks: tk.Task[]; today: string; onOpen: (task: tk.Task) => void; title?: string }) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="h-done-today" style={{ marginTop: 8 }}>
      <h2 id="h-done-today" className="list-head">{title}</h2>
      <div className="list list-done" style={{ opacity: 0.75 }}>{tasks.map((task) => <TaskRow key={task.id} task={task} today={t} onOpen={() => onOpen(task)} />)}</div>
    </section>
  );
}

/** Día de la semana y número: «jue 12». */
const fmtWeekday = (day: string) => `${WEEKDAYS_SHORT[weekdayIndex(day)]} ${fmtDateCompact(day)}`;

/**
 * Lo que se lee bajo el título: el día previsto cuando no es hoy, la fecha límite como
 * aviso (en ámbar si es hoy, mañana o ya pasó), la repetición, las subtareas y los
 * aplazamientos. La fecha límite nunca cambia de grupo a la tarea: sólo avisa.
 */
export function taskMeta(task: tk.Task, t: string, bucket?: tk.Bucket): { text: string; warn?: boolean }[] {
  const out: { text: string; warn?: boolean }[] = [];
  const rel = (d: string) => (d === t ? 'hoy' : d === addDays(t, 1) ? 'mañana' : d < t ? `${fmtDateCompact(d, t)} (${fmtRelativeDays(d, t)})` : d <= addDays(t, 7) ? fmtWeekday(d) : fmtDateCompact(d, t));
  if (task.scheduled_day && task.scheduled_day !== t && !(bucket === 'tomorrow' && task.scheduled_day === addDays(t, 1))) out.push({ text: task.scheduled_day < t ? `${T.TASK_PLANNED} ${rel(task.scheduled_day)}` : rel(task.scheduled_day) });
  if (task.due_day) out.push({ text: `${T.TASK_DUE_LABEL} ${rel(task.due_day)}`, warn: task.status === 'open' && task.due_day <= addDays(t, 1) });
  if (task.recurrence) out.push({ text: rec.describe(task.recurrence) });
  if (task.subtasks_total > 0) out.push({ text: `${task.subtasks_done}/${task.subtasks_total}` });
  if (task.postpone_count >= tk.POSTPONE_REVIEW_THRESHOLD) out.push({ text: `${T.TASK_POSTPONED_TIMES} ${task.postpone_count}×` });
  return out;
}

/**
 * Fila de tarea. Al marcarla, el cambio se guarda al momento pero la fila se queda en su
 * sitio un instante: se tacha, se atenúa y se pliega; sólo entonces se refresca la lista y
 * reaparece al final, bajo «Hechas hoy». Así no «se esfuma» (DESIGN.md §3.4). En el grupo
 * de vencidas hay un atajo «A hoy» para replanificar con un toque, sin pasar por la ficha.
 */
export function TaskRow({ task, today: t, onOpen, bucket }: { task: tk.Task; today: string; onOpen: () => void; bucket?: tk.Bucket }) {
  const db = session.db!;
  const [phase, setPhase] = useState<null | 'struck' | 'leaving'>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { if (timers.current.length) { timers.current.forEach(clearTimeout); bumpData(); } }, []);
  const toggle = () => {
    if (phase) return;
    if (task.status === 'open') tk.complete(db, task.id); else tk.reopen(db, task.id);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPhase('struck');
    timers.current = [
      window.setTimeout(() => setPhase('leaving'), reduce ? 200 : 520),
      window.setTimeout(() => { timers.current = []; bumpData(); }, reduce ? 340 : 780),
    ];
  };
  // Mientras la fila se despide, muestra ya el estado nuevo.
  const done = phase ? task.status === 'open' : task.status !== 'open';
  const meta = taskMeta(task, t, bucket);
  return (
    <div className={`task-wrap ${phase === 'leaving' ? 'is-leaving' : ''}`}>
      <div>
        <div className="list-item task-row" style={{ color: done ? 'var(--ink-2)' : undefined }}>
          <button className="btn btn-icon" aria-label={task.status === 'open' ? 'Marcar hecha' : 'Marcar pendiente'} aria-pressed={done} onClick={toggle}>
            <span className={`dot ${done ? (task.status === 'dropped' ? 'is-not' : 'is-done') : 'is-blank'}`} style={{ width: 20, height: 20 }} />
          </button>
          <button className="grow row" style={{ textAlign: 'left', minHeight: 44, color: 'inherit' }} onClick={onOpen} aria-label={`Abrir ${task.title}`}>
            <span className="grow">
              <span className={`task-title ${done ? 'is-struck' : ''}`}>{task.priority === 1 && <Icon name="forward" size={12} style={{ transform: 'rotate(-90deg)', color: 'var(--warn)' }} aria-label="prioridad alta" />} {task.title}</span>
              {meta.length > 0 && <span className="meta" style={{ display: 'block' }}>{meta.map((m, i) => <span key={m.text} style={m.warn ? { color: 'var(--warn)' } : undefined}>{i > 0 ? ' · ' : ''}{m.text}</span>)}</span>}
            </span>
            <Icon name="forward" className="t-faint" />
          </button>
          {bucket === 'overdue' && task.status === 'open' && !phase && (
            <button className="btn btn-text" style={{ flexShrink: 0 }} aria-label={`${task.title}: ${T.TASK_TO_TODAY_LABEL}`} onClick={() => { tk.postpone(db, task.id, t); bumpData(); announce(T.TASK_MOVED_TODAY); }}>{T.TASK_TO_TODAY}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Calendar({ day, onPick, marks }: { day: string; onPick: (d: string) => void; marks: [string, number][] }) {
  const d = parseDay(day)!;
  const y = d.getFullYear(), m = d.getMonth() + 1;
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const offset = weekdayIndex(first);
  const n = daysInMonth(y, m);
  const markSet = new Map(marks);
  const t = today();
  const move = (dm: number) => {
    const nd = new Date(y, m - 1 + dm, 1);
    onPick(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-01`);
  };
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <button className="btn btn-icon" aria-label="Mes anterior" onClick={() => move(-1)}><Icon name="back" /></button>
        <strong>{MONTHS[m - 1]} {y}</strong>
        <button className="btn btn-icon" aria-label="Mes siguiente" onClick={() => move(1)}><Icon name="forward" /></button>
      </div>
      <div className="cal-grid" role="grid" aria-label="Calendario">
        {WEEKDAYS_INITIAL.map((w) => <div key={w} className="t-foot t-muted" style={{ textAlign: 'center' }}>{w}</div>)}
        {Array.from({ length: offset }).map((_, i) => <div key={'e' + i} />)}
        {Array.from({ length: n }).map((_, i) => {
          const dd = `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const cnt = markSet.get(dd) ?? 0;
          return (
            <button key={dd} className={`cal-day ${dd === day ? 'is-sel' : ''} ${dd === t ? 'is-today' : ''}`} aria-pressed={dd === day} aria-label={`${fmtDateLong(dd)}${cnt ? `, ${cnt} tareas` : ''}`} onClick={() => onPick(dd)}>
              <span>{i + 1}</span>{cnt > 0 && <span className="cal-mark" />}
            </button>
          );
        })}
      </div>
      <div className="t-foot t-muted" style={{ marginTop: 8 }}>{fmtDateLong(day)}</div>
    </div>
  );
}

/** Fila «etiqueta · valor ›» de la ficha: cada dato de la tarea, dónde está y cómo se cambia. */
function FieldRow({ label, value, onClick, icon }: { label: string; value: string; onClick: () => void; icon: 'calendar' | 'pin' | 'tag' | 'repeat' | 'edit' }) {
  return (
    <button className="list-item" style={{ minHeight: 48, paddingTop: 8, paddingBottom: 8 }} onClick={onClick}>
      <Icon name={icon} className="t-muted" size={18} />
      <span className="grow">{label}</span>
      <span className="t-muted ellipsis" style={{ maxWidth: '55%' }}>{value}</span>
      <Icon name="forward" className="t-faint" />
    </button>
  );
}

/**
 * Ficha de tarea en una hoja. El título se edita tocándolo; debajo, una fila por dato
 * (día, límite, repetición, proyecto, prioridad), las notas, las subtareas y, al final,
 * cerrar sin hacer o borrar. Las acciones del día a día (Hecha, Aplazar) van en el pie.
 */
export function TaskDetail({ task: initial, onClose }: { task: tk.Task; onClose: () => void }) {
  useDataVersion();
  const db = session.db!;
  const task = tk.get(db, initial.id) ?? initial;
  const subtasks = tk.subtasks(db, task.id);
  const [notes, setNotes] = useState(task.notes);
  const [title, setTitle] = useState(task.title);
  const [dirty, setDirty] = useState(false);
  const { schedule, flush } = useAutosave((t) => { tk.setNotes(db, task.id, t); bumpData(); setDirty(false); });
  const [ask, setAsk] = useState<null | 'postpone' | 'schedule' | 'due' | 'recur' | 'project' | 'priority' | 'sub' | 'drop' | 'delete' | 'review'>(null);
  const t = today();
  const saveTitle = () => { const v = title.trim(); if (v && v !== task.title) { tk.setTitle(db, task.id, v); bumpData(); } else setTitle(task.title); };
  const close = () => { flush(); saveTitle(); onClose(); };
  const projects = tk.listProjects(db, false);
  const dayPrompt = (title: string, cb: (day: string | null) => void) => ({
    title, help: 'hoy, mañana, lun, +3, 20, 15/12, ninguna',
    onSubmit: (v: string) => { const r = parseDayInput(v, t); if (!r) { announce(T.TASK_DATE_UNKNOWN); return; } cb(r.day); bumpData(); },
  });
  const priorityLabel = task.priority === 1 ? 'alta' : task.priority === -1 ? 'baja' : 'normal';
  return (
    <Sheet open onClose={close} title={
      <input className="title-input" value={title} aria-label={HELP.TASK_TITLE_LABEL} title={HELP.TASK_TITLE_HINT} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    } footer={
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => { if (task.status === 'open') tk.complete(db, task.id); else tk.reopen(db, task.id); bumpData(); announce(task.status === 'open' ? 'Hecha.' : 'Pendiente de nuevo.'); }}><Icon name="check" size={16} /> {task.status === 'open' ? 'Hecha' : 'Reabrir'}</button>
        <button className="btn btn-secondary" onClick={() => setAsk('postpone')}>Aplazar</button>
        {task.postpone_count >= tk.POSTPONE_REVIEW_THRESHOLD && <button className="btn btn-secondary" onClick={() => setAsk('review')}>Revisar con calma</button>}
      </div>
    }>
      <div className="stack-lg">
        <p className="t-foot t-muted" style={{ marginTop: -8 }}>{task.status === 'open' ? HELP.TASK_TITLE_HINT : `${task.status === 'done' ? 'Hecha' : 'Cerrada sin hacer'}. ${HELP.TASK_TITLE_HINT}`}</p>
        <div className="list">
          <FieldRow icon="calendar" label={HELP.TASK_FIELD_DAY} value={task.scheduled_day ? fmtDateCompact(task.scheduled_day, t) : 'sin día'} onClick={() => setAsk('schedule')} />
          <FieldRow icon="pin" label={HELP.TASK_FIELD_DUE} value={task.due_day ? fmtDateCompact(task.due_day, t) : 'ninguna'} onClick={() => setAsk('due')} />
          <FieldRow icon="repeat" label={HELP.TASK_FIELD_RECUR} value={task.recurrence ? rec.describe(task.recurrence) : 'no se repite'} onClick={() => setAsk('recur')} />
          <FieldRow icon="tag" label={HELP.TASK_FIELD_PROJECT} value={task.project_id ? tk.projectName(db, task.project_id) ?? 'proyecto' : 'ninguno'} onClick={() => setAsk('project')} />
          <FieldRow icon="edit" label={HELP.TASK_FIELD_PRIORITY} value={priorityLabel} onClick={() => setAsk('priority')} />
        </div>
        {task.postpone_count > 0 && <p className="t-foot t-muted">{T.TASK_POSTPONED_TIMES} {task.postpone_count} {task.postpone_count === 1 ? 'vez' : 'veces'}{task.postpone_count >= tk.POSTPONE_REVIEW_THRESHOLD ? '. ' + T.TASK_REVIEW_OFFER.replace(' Pulsa R para revisarla con calma (un minuto).', '') : ''}</p>}
        <div className="field">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <label>Notas</label>
            <span className="t-foot t-muted" aria-live="polite">{dirty ? 'Guardando…' : 'Guardado'}</span>
          </div>
          <TextEditor value={notes} minHeight={96} placeholder={T.TASK_NOTES_HINT} onChange={(v) => { setNotes(v); setDirty(true); schedule(v); }} />
          <span className="help">Todo lo que cambies aquí se guarda solo; «Cerrar» no deshace nada.</span>
        </div>
        <div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="list-head" style={{ paddingTop: 0 }}>{T.TASK_SUBTASKS} {task.subtasks_total > 0 ? `${task.subtasks_done}/${task.subtasks_total}` : ''}</span>
            <button className="btn btn-text" onClick={() => setAsk('sub')}><Icon name="plus" size={16} /> Añadir</button>
          </div>
          {subtasks.length === 0 && <p className="t-foot t-muted">{HELP.TASK_SUBTASKS_EMPTY}</p>}
          <div className="list">{subtasks.map((s) => (
            <div key={s.id} className="list-item" style={{ minHeight: 44, paddingTop: 6, paddingBottom: 6 }}>
              <button className="btn btn-icon" aria-label={s.status === 'open' ? 'Marcar hecha' : 'Marcar pendiente'} onClick={() => { if (s.status === 'open') tk.complete(db, s.id); else tk.reopen(db, s.id); bumpData(); }}>
                <span className={`dot ${s.status === 'done' ? 'is-done' : 'is-blank'}`} style={{ width: 18, height: 18 }} />
              </button>
              <span className={`grow task-title ${s.status !== 'open' ? 'is-struck' : ''}`} style={{ color: s.status !== 'open' ? 'var(--ink-2)' : undefined }}>{s.title}</span>
              <button className="btn btn-icon" aria-label="Borrar subtarea" onClick={() => { tk.delete(db, s.id); bumpData(); }}><Icon name="close" size={16} /></button>
            </div>
          ))}</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-text" onClick={() => setAsk('drop')}>Cerrar sin hacer</button>
          <button className="btn btn-text btn-danger" onClick={() => setAsk('delete')}>Borrar</button>
        </div>
      </div>
      <Prompt open={ask === 'postpone'} onClose={() => setAsk(null)} {...dayPrompt(T.TASK_POSTPONE_PROMPT, (d) => { if (d) { const n = tk.postpone(db, task.id, d); if (n >= tk.POSTPONE_REVIEW_THRESHOLD) announce(T.TASK_REVIEW_OFFER.replace(' Pulsa R para revisarla con calma (un minuto).', '')); } })} />
      <Prompt open={ask === 'schedule'} onClose={() => setAsk(null)} initial={task.scheduled_day ?? ''} {...dayPrompt(T.TASK_DAY_PROMPT, (d) => tk.setScheduled(db, task.id, d))} />
      <Prompt open={ask === 'due'} onClose={() => setAsk(null)} initial={task.due_day ?? ''} {...dayPrompt(T.TASK_DUE_PROMPT, (d) => tk.setDue(db, task.id, d))} />
      <Prompt open={ask === 'recur'} onClose={() => setAsk(null)} title={T.TASK_RECUR_PROMPT} initial={task.recurrence ? rec.describe(task.recurrence) : ''} onSubmit={(v) => {
        const r = rec.parseHuman(v); const none = ['', 'no', 'nunca', '-'].includes(v.trim().toLowerCase());
        if (!r && !none) { announce(T.TASK_RECUR_UNKNOWN); return; } tk.setRecurrence(db, task.id, r ?? null); bumpData(); }} />
      <Choice open={ask === 'project'} onClose={() => setAsk(null)} title={HELP.TASK_FIELD_PROJECT} options={['Sin proyecto', ...projects.map((p) => p.name)]} onPick={(i) => { tk.setProject(db, task.id, i === 0 ? null : projects[i - 1].id); bumpData(); }} />
      <Choice open={ask === 'priority'} onClose={() => setAsk(null)} title={HELP.TASK_FIELD_PRIORITY} help={HELP.TASK_PRIORITY_HELP} options={['Alta', 'Normal', 'Baja']} onPick={(i) => { tk.setPriority(db, task.id, i === 0 ? 1 : i === 1 ? 0 : -1); bumpData(); }} />
      <Prompt open={ask === 'sub'} onClose={() => setAsk(null)} title={T.TASK_SUBTASK_PROMPT} onSubmit={(v) => { if (v.trim()) { tk.create(db, { title: v, parent_id: task.id, project_id: task.project_id }); bumpData(); } }} />
      <Prompt open={ask === 'drop'} onClose={() => setAsk(null)} title={T.TASK_CLOSE_PROMPT} submitLabel="Cerrar" onSubmit={(v) => { tk.dropTask(db, task.id, v); bumpData(); announce(T.REVIEW_CLOSED_TASK); close(); }} />
      <Confirm open={ask === 'delete'} onClose={() => setAsk(null)} destructive title="¿Borrar esta tarea?" body={T.TASK_DELETE_CONFIRM} confirmLabel="Borrar" onConfirm={() => { tk.delete(db, task.id); bumpData(); close(); }} />
      {ask === 'review' && <PostponeReview task={task} onClose={() => setAsk(null)} onDone={close} />}
    </Sheet>
  );
}
/** Revisión no culpabilizadora de una tarea aplazada (nota E §9). */
function PostponeReview({ task, onClose, onDone }: { task: tk.Task; onClose: () => void; onDone: () => void }) {
  const db = session.db!;
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<string[]>([]);
  const [tip, setTip] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | 'close' | 'step' | 'obstacle' | 'day' | 'diff'>(null);
  const [finished, setFinished] = useState(false);
  const t = today();
  const add = (s: string) => setSummary((x) => [...x, s]);
  const questions: { q: string; opts: readonly (readonly [string, string])[] }[] = [
    { q: T.REVIEW_Q1, opts: T.REVIEW_Q1_OPTS }, { q: T.REVIEW_Q2, opts: T.REVIEW_Q2_OPTS }, { q: T.REVIEW_Q3, opts: T.REVIEW_Q3_OPTS }, { q: T.REVIEW_Q4, opts: T.REVIEW_Q4_OPTS },
  ];
  const answer = (key: string) => {
    if (step === 0) { if (key === 's') { add('Sigue importando.'); setStep(1); } else if (key === 'n') setAsk('close'); else { add('No está claro si sigue importando: lo revisaré de nuevo.'); setStep(1); } }
    else if (step === 1) { if (key === 's') setStep(2); else setAsk('step'); }
    else if (step === 2) { if (key === 's') setAsk('obstacle'); else setStep(3); }
    else if (step === 3) { setTip(key === 'a' ? T.REVIEW_Q4_BORING : key === 'i' ? T.REVIEW_Q4_UNCOMFORTABLE : key === 'm' ? T.REVIEW_Q4_FEAR : null); setStep(4); }
  };
  return (
    <Sheet open onClose={onClose} title={T.REVIEW_TITLE} footer={finished ? <button className="btn btn-primary btn-block" onClick={onDone}>Volver</button> : step === 4 ? <div className="row"><button className="btn btn-primary" onClick={() => setAsk('day')}>Elegir día</button><button className="btn btn-secondary" onClick={() => setFinished(true)}>Dejarla como está</button></div> : undefined}>
      <div className="stack">
        <p className="t-muted">{T.REVIEW_INTRO.replace('{n}', String(task.postpone_count))}</p>
        {summary.map((s) => <p key={s} className="t-foot t-muted">✓ {s}</p>)}
        {finished ? (
          <div className="stack">
            <p>{T.REVIEW_CLOSE}</p>
            <p className="t-muted">{T.REVIEW_FORGIVE}</p>
            {T.REVIEW_FORGIVE_OPTS.slice(0, 2).map(([, phrase]) => <button key={phrase} className="btn btn-secondary btn-block" style={{ whiteSpace: 'normal', textAlign: 'left' }} onClick={() => { tk.setNotes(db, task.id, `${task.notes}\n\n${phrase}`.trim()); bumpData(); add(phrase); setFinished(true); }}>{phrase}</button>)}
          </div>
        ) : step <= 3 ? (
          <div className="stack">
            {tip && <p className="notice">{tip}</p>}
            <p className="t-lead">{step + 1}. {questions[step].q}</p>
            {questions[step].opts.map(([k, label]) => <button key={k} className="btn btn-secondary btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => answer(k)}>{label}</button>)}
          </div>
        ) : (
          <div className="stack">{tip && <p className="notice">{tip}</p>}<p className="t-lead">5. {T.REVIEW_Q5}</p></div>
        )}
      </div>
      <Prompt open={ask === 'close'} onClose={() => setAsk(null)} title={T.TASK_CLOSE_PROMPT} submitLabel="Cerrar" onSubmit={(v) => { tk.dropTask(db, task.id, v); bumpData(); add(T.REVIEW_CLOSED_TASK); setFinished(true); }} />
      <Prompt open={ask === 'step'} onClose={() => setAsk(null)} title={T.REVIEW_Q2_PROMPT} onSubmit={(v) => { if (v.trim()) { tk.create(db, { title: v, parent_id: task.id, project_id: task.project_id, scheduled_day: t }); bumpData(); add(`Primer paso: ${v}`); } setStep(2); }} />
      <Prompt open={ask === 'obstacle'} onClose={() => setAsk(null)} title={T.REVIEW_Q3_PROMPT} onSubmit={(v) => { if (v.trim()) { tk.create(db, { title: `Resolver: ${v}`, project_id: task.project_id, scheduled_day: t }); bumpData(); add(`Obstáculo a resolver: ${v}`); } setStep(3); }} />
      <Prompt open={ask === 'day'} onClose={() => setAsk(null)} title={T.REVIEW_Q5_DAY} help="mañana, lun, +3, 20" onSubmit={(v) => { const r = parseDayInput(v, t); if (r?.day) { tk.setScheduled(db, task.id, r.day); bumpData(); add(`Nuevo día: ${fmtDateCompact(r.day, t)}`); setAsk('diff'); } else announce(T.TASK_DATE_UNKNOWN); }} />
      <Prompt open={ask === 'diff'} onClose={() => { setAsk(null); setFinished(true); }} title={T.REVIEW_Q5_DIFF} onSubmit={(v) => { if (v.trim()) { tk.setNotes(db, task.id, `${task.notes}\n\nLa próxima vez será distinto: ${v}`.trim()); bumpData(); add(`Será distinto: ${v}`); } setFinished(true); }} />
    </Sheet>
  );
}
