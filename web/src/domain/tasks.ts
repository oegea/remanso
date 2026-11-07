/**
 * Tareas y proyectos. Una tarea aplazada nunca se marca «fallida»: sólo
 * «pendiente» con su fecha original y un contador neutro de aplazamientos.
 */
import type { Database } from '../db/sqlite';
import { addDays, nowTs, today } from './dates';
import { type Rule, nextAfter, parse as parseRule, toStorage } from './recurrence';

export type Id = number;

export const POSTPONE_REVIEW_THRESHOLD = 3;

export type Status = 'open' | 'done' | 'dropped';

export interface Task {
  id: Id;
  project_id: Id | null;
  parent_id: Id | null;
  goal_id: Id | null;
  title: string;
  notes: string;
  status: Status;
  priority: number;
  due_day: string | null;
  scheduled_day: string | null;
  recurrence: Rule | null;
  postpone_count: number;
  created_at: number;
  completed_at: number | null;
  subtasks_total: number;
  subtasks_done: number;
}

export interface Project {
  id: Id;
  name: string;
  description: string;
  goal_id: Id | null;
  archived: boolean;
  open_tasks: number;
  done_tasks: number;
}

export interface NewTask {
  title: string;
  scheduled_day?: string | null;
  due_day?: string | null;
  project_id?: Id | null;
  parent_id?: Id | null;
  goal_id?: Id | null;
}

const SELECT = `SELECT t.id, t.project_id, t.parent_id, t.goal_id, t.title, t.notes, t.status, t.priority, t.due_day,
    t.scheduled_day, t.recurrence, t.postpone_count, t.created_at, t.completed_at,
    (SELECT count(*) FROM tasks c WHERE c.parent_id = t.id AND c.status != 'dropped') AS subtasks_total,
    (SELECT count(*) FROM tasks c WHERE c.parent_id = t.id AND c.status = 'done') AS subtasks_done
    FROM tasks t`;

type Row = Omit<Task, 'status' | 'recurrence'> & { status: string; recurrence: string | null };

function parseStatus(s: string): Status {
  return s === 'done' ? 'done' : s === 'dropped' ? 'dropped' : 'open';
}

function map(r: Row): Task {
  return { ...r, status: parseStatus(r.status), recurrence: r.recurrence !== null ? parseRule(r.recurrence) : null };
}

export function create(db: Database, t: NewTask): Id {
  const now = nowTs();
  return db.insert(
    `INSERT INTO tasks(project_id, parent_id, goal_id, title, scheduled_day, due_day, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`,
    [t.project_id ?? null, t.parent_id ?? null, t.goal_id ?? null, t.title.trim(), t.scheduled_day ?? null, t.due_day ?? null, now],
  );
}

export function get(db: Database, id: Id): Task | null {
  const r = db.get<Row>(`${SELECT} WHERE t.id = ?1`, [id]);
  return r ? map(r) : null;
}

type Field = 'title' | 'notes' | 'priority' | 'scheduled_day' | 'due_day' | 'recurrence' | 'project_id' | 'goal_id';

function touch(db: Database, id: Id, field: Field, value: string | number | null): void {
  db.run(`UPDATE tasks SET ${field} = ?2, updated_at = ?3 WHERE id = ?1`, [id, value, nowTs()]);
}

export function setTitle(db: Database, id: Id, title: string): void {
  touch(db, id, 'title', title.trim());
}
export function setNotes(db: Database, id: Id, notes: string): void {
  touch(db, id, 'notes', notes);
}
export function setPriority(db: Database, id: Id, priority: number): void {
  touch(db, id, 'priority', Math.max(-1, Math.min(1, priority)));
}
export function setScheduled(db: Database, id: Id, day: string | null): void {
  touch(db, id, 'scheduled_day', day);
}
export function setDue(db: Database, id: Id, day: string | null): void {
  touch(db, id, 'due_day', day);
}
export function setRecurrence(db: Database, id: Id, rule: Rule | null): void {
  touch(db, id, 'recurrence', rule ? toStorage(rule) : null);
}
export function setProject(db: Database, id: Id, projectId: Id | null): void {
  touch(db, id, 'project_id', projectId);
}
export function setGoal(db: Database, id: Id, goalId: Id | null): void {
  touch(db, id, 'goal_id', goalId);
}

/**
 * Aplazar: cambia el día previsto y cuenta el aplazamiento. Devuelve el nuevo
 * contador para que la interfaz ofrezca la revisión al llegar al umbral.
 */
export function postpone(db: Database, id: Id, to: string): number {
  db.run(
    'UPDATE tasks SET scheduled_day = ?2, postpone_count = postpone_count + 1, last_postponed_at = ?3, updated_at = ?3 WHERE id = ?1',
    [id, to, nowTs()],
  );
  return db.scalar<number>('SELECT postpone_count FROM tasks WHERE id = ?1', [id]) ?? 0;
}

/** Completa la tarea. Si es recurrente, crea la siguiente aparición y devuelve su id. */
export function complete(db: Database, id: Id): Id | null {
  const t = get(db, id);
  if (!t) return null;
  const now = nowTs();
  db.run("UPDATE tasks SET status = 'done', completed_at = ?2, updated_at = ?2 WHERE id = ?1", [id, now]);
  if (t.recurrence) {
    const td = today();
    let base = t.scheduled_day ?? t.due_day ?? td;
    // Si la base quedó en el pasado, la siguiente se calcula desde hoy para no
    // generar una cola de apariciones «vencidas».
    if (base < td) base = td;
    const next = nextAfter(t.recurrence, base);
    return db.insert(
      `INSERT INTO tasks(project_id, parent_id, goal_id, title, notes, priority, scheduled_day, due_day, recurrence, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
      [t.project_id, t.parent_id, t.goal_id, t.title, t.notes, t.priority, next, t.due_day !== null ? next : null, toStorage(t.recurrence), now],
    );
  }
  return null;
}

export function reopen(db: Database, id: Id): void {
  db.run("UPDATE tasks SET status = 'open', completed_at = NULL, updated_at = ?2 WHERE id = ?1", [id, nowTs()]);
}

/** Cerrar sin hacer («ya no importa»): decisión del usuario, no un fallo. */
export function dropTask(db: Database, id: Id, closingNote: string): void {
  const now = nowTs();
  if (closingNote.trim() === '') {
    db.run("UPDATE tasks SET status = 'dropped', completed_at = ?2, updated_at = ?2 WHERE id = ?1", [id, now]);
  } else {
    db.run(
      `UPDATE tasks SET status = 'dropped', completed_at = ?2, updated_at = ?2,
       notes = CASE WHEN notes = '' THEN ?3 ELSE notes || char(10) || char(10) || ?3 END WHERE id = ?1`,
      [id, now, `Cerrada: ${closingNote.trim()}`],
    );
  }
}

export function deleteTask(db: Database, id: Id): void {
  db.run('DELETE FROM tasks WHERE id = ?1', [id]);
}
export { deleteTask as delete };

/**
 * Lo abierto en una sola lista, agrupado por cercanía. El día que manda es el más
 * cercano entre el previsto y el límite: una tarea con sólo fecha límite se ordena
 * por ella y nunca queda «en ningún sitio». Sin fecha va al final, visible.
 */
export type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday';
export const BUCKETS: readonly Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'someday'];

/** El más cercano entre día previsto y fecha límite; null si no tiene ninguno. */
export function effectiveDay(t: Pick<Task, 'scheduled_day' | 'due_day'>): string | null {
  if (t.scheduled_day && t.due_day) return t.scheduled_day < t.due_day ? t.scheduled_day : t.due_day;
  return t.scheduled_day ?? t.due_day ?? null;
}

export function bucketOf(t: Pick<Task, 'scheduled_day' | 'due_day'>, todayDay: string): Bucket {
  const d = effectiveDay(t);
  if (d === null) return 'someday';
  if (d < todayDay) return 'overdue';
  if (d === todayDay) return 'today';
  if (d === addDays(todayDay, 1)) return 'tomorrow';
  if (d <= addDays(todayDay, 7)) return 'week';
  return 'later';
}

const SOONEST = "coalesce(min(t.scheduled_day, t.due_day), t.scheduled_day, t.due_day)";

/** Abiertas de primer nivel: prioridad alta primero, luego el día que manda, luego la más antigua. */
export function listOpen(db: Database, project: Id | null = null): Task[] {
  const proj = project !== null ? `AND t.project_id = ${Number(project)}` : '';
  return db
    .all<Row>(`${SELECT} WHERE t.status = 'open' AND t.parent_id IS NULL ${proj}
       ORDER BY t.priority DESC, coalesce(${SOONEST}, '9999'), t.created_at`)
    .map(map);
}

export interface Group { bucket: Bucket; tasks: Task[] }

/** Las abiertas por grupos, en orden de cercanía y sin grupos vacíos. */
export function grouped(db: Database, todayDay: string, project: Id | null = null): Group[] {
  const by = new Map<Bucket, Task[]>(BUCKETS.map((b) => [b, []]));
  for (const t of listOpen(db, project)) by.get(bucketOf(t, todayDay))!.push(t);
  return BUCKETS.map((bucket) => ({ bucket, tasks: by.get(bucket)! })).filter((g) => g.tasks.length > 0);
}

/** Lo de hoy: vencidas y previstas o con límite hoy, en ese orden (para la pantalla Hoy). */
export function forToday(db: Database, todayDay: string): Task[] {
  return listOpen(db).filter((t) => { const b = bucketOf(t, todayDay); return b === 'overdue' || b === 'today'; });
}

/** Lo de los próximos siete días (mañana incluido), para enseñarlo debajo de lo de hoy. */
export function forNextDays(db: Database, todayDay: string): Task[] {
  return listOpen(db)
    .filter((t) => { const b = bucketOf(t, todayDay); return b === 'tomorrow' || b === 'week'; })
    .sort((a, b) => effectiveDay(a)!.localeCompare(effectiveDay(b)!) || b.priority - a.priority || a.created_at - b.created_at);
}

/** Completadas o cerradas, las últimas primero. */
export function listDone(db: Database, project: Id | null = null, limit = 200): Task[] {
  const proj = project !== null ? `AND t.project_id = ${Number(project)}` : '';
  return db.all<Row>(`${SELECT} WHERE t.status != 'open' AND t.parent_id IS NULL ${proj} ORDER BY t.completed_at DESC LIMIT ${Number(limit)}`).map(map);
}

/**
 * Hechas o cerradas un día concreto, para dejarlas al final de la lista en vez de
 * hacerlas desaparecer al marcarlas. Nunca más de `limit`.
 */
export function doneOn(db: Database, day: string, project: Id | null = null, limit = 10): Task[] {
  const proj = project !== null ? `AND t.project_id = ${Number(project)}` : '';
  return db
    .all<Row>(
      `${SELECT} WHERE t.status != 'open' AND t.parent_id IS NULL ${proj}
       AND t.completed_at IS NOT NULL AND date(t.completed_at, 'unixepoch', 'localtime') = ?1
       ORDER BY t.completed_at DESC LIMIT ?2`,
      [day, limit],
    )
    .map(map);
}

/** Todas las tareas abiertas de un proyecto (sin fecha también), para su ficha. */
export function listForProject(db: Database, projectId: Id): Task[] {
  return db
    .all<Row>(
      `${SELECT} WHERE t.project_id = ?1 AND t.parent_id IS NULL
       ORDER BY t.status = 'open' DESC, t.priority DESC, coalesce(t.scheduled_day, t.due_day, '9999'), t.created_at`,
      [projectId],
    )
    .map(map);
}

export function listForGoal(db: Database, goalId: Id): Task[] {
  return db
    .all<Row>(
      `${SELECT} WHERE t.goal_id = ?1 AND t.parent_id IS NULL AND t.status = 'open'
       ORDER BY t.priority DESC, coalesce(t.scheduled_day, t.due_day, '9999'), t.created_at`,
      [goalId],
    )
    .map(map);
}

export function subtasks(db: Database, parentId: Id): Task[] {
  return db.all<Row>(`${SELECT} WHERE t.parent_id = ?1 ORDER BY t.status = 'open' DESC, t.created_at`, [parentId]).map(map);
}

/** Tareas de un día concreto (previstas o con fecha límite), para el calendario. */
export function onDay(db: Database, day: string): Task[] {
  return db
    .all<Row>(
      `${SELECT} WHERE t.parent_id IS NULL AND (t.scheduled_day = ?1 OR t.due_day = ?1) ORDER BY t.status = 'open' DESC, t.priority DESC`,
      [day],
    )
    .map(map);
}

/** Días con tareas abiertas en un rango (para marcar el calendario). */
export function daysWithTasks(db: Database, from: string, to: string): [string, number][] {
  return db
    .all<{ d: string; n: number }>(
      `SELECT d, count(*) AS n FROM (
         SELECT coalesce(scheduled_day, due_day) AS d FROM tasks WHERE status = 'open' AND parent_id IS NULL
       ) WHERE d BETWEEN ?1 AND ?2 GROUP BY d`,
      [from, to],
    )
    .map((r) => [r.d, r.n]);
}

export function countPending(db: Database, todayDay: string): number {
  return (
    db.scalar<number>(
      `SELECT count(*) FROM tasks WHERE status = 'open' AND parent_id IS NULL
       AND ((scheduled_day IS NOT NULL AND scheduled_day <= ?1) OR (due_day IS NOT NULL AND due_day <= ?1))`,
      [todayDay],
    ) ?? 0
  );
}

/** Tareas abiertas aplazadas al menos `threshold` veces. */
export function postponedOften(db: Database, threshold: number): Task[] {
  return db
    .all<Row>(`${SELECT} WHERE t.status = 'open' AND t.postpone_count >= ?1 ORDER BY t.postpone_count DESC`, [threshold])
    .map(map);
}

// ---- proyectos ---------------------------------------------------------------

export function createProject(db: Database, name: string, goalId: Id | null = null): Id {
  return db.insert('INSERT INTO projects(name, goal_id, created_at) VALUES (?1, ?2, ?3)', [name.trim(), goalId, nowTs()]);
}

export function renameProject(db: Database, id: Id, name: string): void {
  db.run('UPDATE projects SET name = ?2 WHERE id = ?1', [id, name.trim()]);
}

export function setProjectArchived(db: Database, id: Id, archived: boolean): void {
  db.run('UPDATE projects SET archived_at = ?2 WHERE id = ?1', [id, archived ? nowTs() : null]);
}

export function deleteProject(db: Database, id: Id): void {
  db.run('DELETE FROM projects WHERE id = ?1', [id]);
}

interface ProjectRow {
  id: Id;
  name: string;
  description: string;
  goal_id: Id | null;
  archived_at: number | null;
  open_tasks: number;
  done_tasks: number;
}

export function listProjects(db: Database, includeArchived: boolean): Project[] {
  const where = includeArchived ? '' : 'WHERE p.archived_at IS NULL';
  return db
    .all<ProjectRow>(
      `SELECT p.id, p.name, p.description, p.goal_id, p.archived_at,
         (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'open') AS open_tasks,
         (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks
       FROM projects p ${where} ORDER BY p.archived_at IS NOT NULL, p.name`,
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      goal_id: r.goal_id,
      archived: r.archived_at !== null,
      open_tasks: r.open_tasks,
      done_tasks: r.done_tasks,
    }));
}

export function projectName(db: Database, id: Id): string | null {
  return db.scalar<string>('SELECT name FROM projects WHERE id = ?1', [id]) ?? null;
}
