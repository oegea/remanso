/**
 * Preguntas de reflexión recurrentes (interventions.md §d). Nada se instala por
 * defecto: cada conjunto se activa desde Ajustes y se puede editar o archivar.
 * Regla: una sesión guiada al día como máximo y ≤ 3 preguntas por pantalla.
 */
import type { Database } from '../db/sqlite';
import { nowTs, tsToDay } from './dates';

export type Id = number;

export type PromptKind = 'free' | 'scale' | 'choice';

function parseKind(s: string): PromptKind {
  return s === 'scale' || s === 'choice' ? s : 'free';
}

export interface Prompt {
  id: Id;
  text: string;
  kind: PromptKind;
  /** Para `choice`: opciones separadas por «|». Para `scale`: «min|max». */
  options: string | null;
  schedule: string;
  goal_id: Id | null;
  source_ref: string;
  position: number;
  archived: boolean;
}

export function choices(p: Prompt): string[] {
  return (p.options ?? '').split('|').map((s) => s.trim()).filter((s) => s !== '');
}

interface Row {
  id: number;
  text: string;
  kind: string;
  options: string | null;
  schedule: string;
  goal_id: number | null;
  source_ref: string;
  position: number;
  archived_at: number | null;
}

const SELECT = 'SELECT id, text, kind, options, schedule, goal_id, source_ref, position, archived_at FROM prompts';

function map(r: Row): Prompt {
  return {
    id: r.id,
    text: r.text,
    kind: parseKind(r.kind),
    options: r.options,
    schedule: r.schedule,
    goal_id: r.goal_id,
    source_ref: r.source_ref,
    position: r.position,
    archived: r.archived_at !== null,
  };
}

export interface Template {
  text: string;
  kind: PromptKind;
  options: string | null;
  source_ref: string;
}

const TEMPLATES: Record<string, readonly Template[]> = {
  open: [
    { text: '¿Qué es lo único que, si lo haces hoy, hará que el día valga la pena?', kind: 'free', options: null, source_ref: 'apertura_del_dia' },
    { text: '¿Qué puede complicarse hoy y qué harás si pasa?', kind: 'free', options: null, source_ref: 'plan_si_entonces' },
  ],
  close: [
    { text: '¿Qué pasó hoy que quieras recordar?', kind: 'free', options: null, source_ref: 'cierre_del_dia' },
    { text: 'Una cosa que fue bien hoy, y qué hizo que fuera bien.', kind: 'free', options: null, source_ref: 'tres_cosas_buenas' },
    { text: '¿Qué queda pendiente para mañana? Escríbelo con detalle (separa con «;» para crear tareas).', kind: 'free', options: null, source_ref: 'cierre_del_dia' },
  ],
  weekly: [
    { text: 'Leyendo la semana, ¿qué se repite?', kind: 'free', options: null, source_ref: 'revision_semanal' },
    { text: '¿Qué funcionó esta semana?', kind: 'free', options: null, source_ref: 'revision_semanal' },
    { text: '¿Qué lo impidió, cuando no salió?', kind: 'free', options: null, source_ref: 'plan_afrontamiento' },
    { text: '¿Qué cambio concreto pruebas la semana que viene?', kind: 'free', options: null, source_ref: 'revision_semanal' },
    { text: 'Los cambios en tu entorno, ¿siguen en pie?', kind: 'choice', options: 'Sí|Algunos|No|No tengo', source_ref: 'entorno_checklist' },
    { text: '¿Siguen mereciendo la pena tus objetivos activos?', kind: 'choice', options: 'Sí|Lo dudo|Alguno ya no', source_ref: 'revision_objetivo' },
  ],
  goal_review: [
    { text: 'Escribiste que te importaba porque: «{why}». ¿Sigue siendo así?', kind: 'choice', options: 'Sigue importando|Menos que antes|Ya no', source_ref: 'revision_objetivo' },
    { text: 'Registros en las últimas cuatro semanas: {n}. ¿Quieres seguir registrándolo así?', kind: 'choice', options: 'Sí|Menos|Más|De otra forma', source_ref: 'registro_conducta' },
    { text: '¿Tienes ahora el tiempo y la energía que esto pide?', kind: 'choice', options: 'Sí|A ratos|No', source_ref: 'revision_objetivo' },
    { text: '¿Ha cambiado algo en tu rutina o tu entorno que afecte a esto?', kind: 'free', options: null, source_ref: 'senal_contexto' },
    { text: 'Decisión', kind: 'choice', options: 'Mantener|Ajustar frecuencia|Pausar|Cerrar', source_ref: 'revision_objetivo' },
  ],
  srbai: [
    { text: '«{accion}» es algo que hago automáticamente.', kind: 'scale', options: '1|5', source_ref: 'automaticidad_srbai' },
    { text: '«{accion}» es algo que hago sin tener que recordarlo.', kind: 'scale', options: '1|5', source_ref: 'automaticidad_srbai' },
    { text: '«{accion}» es algo que hago sin pensar.', kind: 'scale', options: '1|5', source_ref: 'automaticidad_srbai' },
    { text: '«{accion}» es algo que empiezo a hacer antes de darme cuenta.', kind: 'scale', options: '1|5', source_ref: 'automaticidad_srbai' },
  ],
};

/** Conjuntos por defecto (texto literal de interventions.md §d). */
export function templates(schedule: string): readonly Template[] {
  return TEMPLATES[schedule] ?? [];
}

export const SCHEDULES: readonly (readonly [string, string])[] = [
  ['open', 'Apertura del día'],
  ['close', 'Cierre del día'],
  ['weekly', 'Revisión semanal'],
];

/**
 * Instala el conjunto por defecto de un `schedule` si no hay ninguna pregunta
 * (activa o archivada) de ese tipo. Devuelve cuántas creó.
 */
export function installSet(db: Database, schedule: string): number {
  const existing = db.scalar<number>('SELECT count(*) FROM prompts WHERE schedule = ?1 AND goal_id IS NULL', [schedule]) ?? 0;
  if (existing > 0) {
    db.run('UPDATE prompts SET archived_at = NULL WHERE schedule = ?1 AND goal_id IS NULL', [schedule]);
    return 0;
  }
  let n = 0;
  templates(schedule).forEach((t, i) => {
    db.run(
      'INSERT INTO prompts(text, kind, options, schedule, source_ref, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
      [t.text, t.kind, t.options, schedule, t.source_ref, i, nowTs()],
    );
    n += 1;
  });
  return n;
}

/** Desactiva el conjunto (archiva; las respuestas se conservan). */
export function disableSet(db: Database, schedule: string): void {
  db.run('UPDATE prompts SET archived_at = ?2 WHERE schedule = ?1 AND goal_id IS NULL AND archived_at IS NULL', [schedule, nowTs()]);
}

export function setEnabled(db: Database, schedule: string): boolean {
  return (db.scalar<number>('SELECT count(*) FROM prompts WHERE schedule = ?1 AND archived_at IS NULL', [schedule]) ?? 0) > 0;
}

export function list(db: Database, schedule: string): Prompt[] {
  return db.all<Row>(`${SELECT} WHERE schedule = ?1 AND archived_at IS NULL ORDER BY position, id`, [schedule]).map(map);
}

export function create(db: Database, text: string, kind: PromptKind, options: string | null, schedule: string, goalId: Id | null): Id {
  const pos = db.scalar<number>('SELECT coalesce(max(position), 0) + 1 FROM prompts WHERE schedule = ?1', [schedule]) ?? 1;
  return db.insert(
    "INSERT INTO prompts(text, kind, options, schedule, goal_id, source_ref, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'usuario', ?6, ?7)",
    [text.trim(), kind, options, schedule, goalId, pos, nowTs()],
  );
}

export function setText(db: Database, id: Id, text: string): void {
  db.run('UPDATE prompts SET text = ?2 WHERE id = ?1', [id, text.trim()]);
}

export function archive(db: Database, id: Id): void {
  db.run('UPDATE prompts SET archived_at = ?2 WHERE id = ?1', [id, nowTs()]);
}

export function answer(db: Database, promptId: Id, text: string, value: number | null, reviewId: Id | null): Id {
  const now = nowTs();
  return db.insert(
    'INSERT INTO prompt_answers(prompt_id, answered_at, day, text, value, review_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
    [promptId, now, tsToDay(now), text, value, reviewId],
  );
}

export interface Answer {
  day: string;
  text: string;
  value: number | null;
}

/** Respuestas anteriores de una pregunta (para releer en la revisión semanal). */
export function answers(db: Database, promptId: Id, limit: number): Answer[] {
  return db.all<Answer>('SELECT day, text, value FROM prompt_answers WHERE prompt_id = ?1 ORDER BY answered_at DESC LIMIT ?2', [promptId, limit]);
}

/** Media SRBAI (1–5) por día de sesión de una acción, las 6 últimas (la más reciente primero). */
export function srbaiHistory(db: Database, actionId: Id): [string, number][] {
  const rows = db.all<{ day: string; avg: number }>(
    `SELECT a.day AS day, avg(a.value) AS avg FROM prompt_answers a JOIN prompts p ON p.id = a.prompt_id
     WHERE p.schedule = ?1 AND a.value IS NOT NULL GROUP BY a.day ORDER BY a.day DESC LIMIT 6`,
    [`srbai:${actionId}`],
  );
  return rows.map((r) => [r.day, r.avg]);
}

/** Instala (si no existen) las 4 preguntas SRBAI de una acción, con su nombre. */
export function ensureSrbai(db: Database, actionId: Id, actionName: string): Prompt[] {
  const sched = `srbai:${actionId}`;
  const existing = list(db, sched);
  if (existing.length > 0) return existing;
  templates('srbai').forEach((t, i) => {
    db.run(
      "INSERT INTO prompts(text, kind, options, schedule, source_ref, position, created_at) VALUES (?1, 'scale', '1|5', ?2, ?3, ?4, ?5)",
      [t.text.replace('{accion}', actionName), sched, t.source_ref, i, nowTs()],
    );
  });
  return list(db, sched);
}

export function lastSrbaiDay(db: Database, actionId: Id): string | null {
  return db.scalar<string | null>('SELECT max(a.day) FROM prompt_answers a JOIN prompts p ON p.id = a.prompt_id WHERE p.schedule = ?1', [`srbai:${actionId}`]) ?? null;
}
