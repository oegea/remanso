/**
 * Episodios de impulso (interventions.md §c) y configuración por objetivo de
 * las vías disponibles. Nunca «racha», nunca porcentaje de «éxito».
 */
import type { Database } from '../db/sqlite';
import { nowTs } from './dates';

export type Id = number;

/** Vías de afrontamiento del paso P3. Las claves coinciden con el catálogo. */
export type Pathway = 'surf' | 'breathe' | 'distract' | 'long_term' | 'competing';

export const PATHWAYS: readonly Pathway[] = ['surf', 'breathe', 'distract', 'long_term', 'competing'];

const PATHWAY_KEYS: Record<Pathway, string> = {
  surf: 'surfear_impulso',
  breathe: 'respiracion_lenta',
  distract: 'distraccion_concreta',
  long_term: 'espera_activa',
  competing: 'respuesta_competidora',
};

export function pathwayKey(p: Pathway): string {
  return PATHWAY_KEYS[p];
}

export function parsePathway(s: string | null | undefined): Pathway | null {
  if (s == null) return null;
  return PATHWAYS.find((p) => PATHWAY_KEYS[p] === s) ?? null;
}

/**
 * Configuración P0 de un objetivo (o general, `goal_id = null`), guardada como
 * filas de `strategies` con `technique` = clave.
 */
export interface ImpulseConfig {
  goal_id: Id | null;
  wait_seconds: number;
  future_image: string;
  distractions: string[];
  competing_response: string;
  env_changes: string[];
  last_pathway: Pathway | null;
  serious: boolean | null;
}

export const DEFAULT_WAIT = 600;

export function defaultConfig(goalId: Id | null): ImpulseConfig {
  return {
    goal_id: goalId,
    wait_seconds: DEFAULT_WAIT,
    future_image: '',
    distractions: [],
    competing_response: '',
    env_changes: [],
    last_pathway: null,
    serious: null,
  };
}

const splitLines = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter((x) => x !== '');

export function loadConfig(db: Database, goalId: Id | null): ImpulseConfig {
  const cfg = defaultConfig(goalId);
  const rows = db.all<{ technique: string; instructions: string; wait_seconds: number | null; alternative: string }>(
    'SELECT technique, instructions, wait_seconds, alternative FROM strategies WHERE goal_id IS ?1 AND archived_at IS NULL',
    [goalId],
  );
  for (const r of rows) {
    switch (r.technique) {
      case 'espera_activa':
        cfg.wait_seconds = r.wait_seconds ?? DEFAULT_WAIT;
        cfg.last_pathway = parsePathway(r.alternative);
        break;
      case 'imagen_futura':
        cfg.future_image = r.instructions;
        break;
      case 'distraccion_concreta':
        cfg.distractions = splitLines(r.alternative);
        break;
      case 'respuesta_competidora':
        cfg.competing_response = r.alternative;
        break;
      case 'entorno_checklist':
        cfg.env_changes = splitLines(r.alternative);
        break;
      case 'seguridad':
        cfg.serious = r.instructions === 'yes' ? true : r.instructions === 'no' ? false : null;
        break;
      default:
        break;
    }
  }
  return cfg;
}

function upsert(db: Database, goalId: Id | null, technique: string, instructions: string, wait: number | null, alternative: string): void {
  const existing = db.scalar<number>('SELECT id FROM strategies WHERE goal_id IS ?1 AND technique = ?2 AND archived_at IS NULL', [goalId, technique]);
  if (existing !== undefined) {
    db.run('UPDATE strategies SET instructions = ?2, wait_seconds = ?3, alternative = ?4 WHERE id = ?1', [existing, instructions, wait, alternative]);
  } else {
    db.run(
      'INSERT INTO strategies(goal_id, technique, name, instructions, wait_seconds, alternative, created_at) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6)',
      [goalId, technique, instructions, wait, alternative, nowTs()],
    );
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function saveConfig(db: Database, cfg: ImpulseConfig): void {
  const g = cfg.goal_id;
  upsert(db, g, 'espera_activa', '', clamp(cfg.wait_seconds, 300, 1200), cfg.last_pathway ? pathwayKey(cfg.last_pathway) : '');
  upsert(db, g, 'imagen_futura', cfg.future_image, null, '');
  upsert(db, g, 'distraccion_concreta', '', null, cfg.distractions.join('\n'));
  upsert(db, g, 'respuesta_competidora', '', null, cfg.competing_response);
  upsert(db, g, 'entorno_checklist', '', null, cfg.env_changes.join('\n'));
  const s = cfg.serious === true ? 'yes' : cfg.serious === false ? 'no' : '';
  upsert(db, g, 'seguridad', s, null, '');
}

export interface Episode {
  id: Id;
  started_at: number;
  ended_at: number | null;
  goal_id: Id | null;
  pathway: Pathway | null;
  context: string;
  trigger_text: string;
  intensity_before: number | null;
  intensity_after: number | null;
  waited_seconds: number | null;
  outcome: string | null;
  reflection: string;
}

export type Outcome = 'changed' | 'partly' | 'acted' | 'unknown' | 'unsaid';
export const OUTCOMES: readonly (readonly [Outcome, string])[] = [
  ['changed', 'No lo hice'],
  ['partly', 'En parte'],
  ['acted', 'Lo hice'],
  ['unknown', 'No lo sé'],
  ['unsaid', 'Prefiero no decirlo'],
];

export function outcomeLabel(key: string): string {
  return OUTCOMES.find(([k]) => k === key)?.[1] ?? '';
}

export function start(db: Database, goalId: Id | null): Id {
  return db.insert('INSERT INTO impulse_episodes(started_at, goal_id) VALUES (?1, ?2)', [nowTs(), goalId]);
}

export function setBefore(db: Database, id: Id, intensity: number | null, trigger: string): void {
  db.run('UPDATE impulse_episodes SET intensity_before = ?2, trigger_text = ?3 WHERE id = ?1', [id, intensity, trigger]);
}

export function setContext(db: Database, id: Id, context: string): void {
  db.run('UPDATE impulse_episodes SET context = ?2 WHERE id = ?1', [id, context]);
}

/**
 * Guarda la vía como referencia a la fila de `strategies` de esa técnica (se
 * crea si no existe) para conservar la trazabilidad con el catálogo.
 */
export function setPathway(db: Database, id: Id, goalId: Id | null, p: Pathway): void {
  upsertPathwayRow(db, goalId, p);
  const sid = db.scalar<number>('SELECT id FROM strategies WHERE goal_id IS ?1 AND technique = ?2 AND archived_at IS NULL', [goalId, pathwayKey(p)]);
  if (sid === undefined) throw new Error('no se encontró la estrategia de la vía');
  db.run('UPDATE impulse_episodes SET strategy_id = ?2 WHERE id = ?1', [id, sid]);
  // Recordar la última vía elegida.
  const cfg = loadConfig(db, goalId);
  upsert(db, goalId, 'espera_activa', '', cfg.wait_seconds, pathwayKey(p));
}

function upsertPathwayRow(db: Database, goalId: Id | null, p: Pathway): void {
  const exists = db.scalar<number>('SELECT id FROM strategies WHERE goal_id IS ?1 AND technique = ?2 AND archived_at IS NULL', [goalId, pathwayKey(p)]);
  if (exists === undefined) {
    db.run('INSERT INTO strategies(goal_id, technique, name, created_at) VALUES (?1, ?2, ?2, ?3)', [goalId, pathwayKey(p), nowTs()]);
  }
}

export function setAfter(db: Database, id: Id, waited: number | null, intensityAfter: number | null): void {
  db.run('UPDATE impulse_episodes SET waited_seconds = ?2, intensity_after = ?3 WHERE id = ?1', [id, waited, intensityAfter]);
}

export function finish(db: Database, id: Id, outcome: Outcome | string | null, reflection: string): void {
  db.run('UPDATE impulse_episodes SET outcome = coalesce(?2, outcome), reflection = ?3, ended_at = ?4 WHERE id = ?1', [id, outcome, reflection, nowTs()]);
}

/** Cierra el episodio si el usuario sale sin terminar: se guarda lo que haya. */
export function closeIfOpen(db: Database, id: Id): void {
  db.run('UPDATE impulse_episodes SET ended_at = coalesce(ended_at, ?2) WHERE id = ?1', [id, nowTs()]);
}

interface EpisodeRow {
  id: number;
  started_at: number;
  ended_at: number | null;
  goal_id: number | null;
  technique: string | null;
  context: string;
  trigger_text: string;
  intensity_before: number | null;
  intensity_after: number | null;
  waited_seconds: number | null;
  outcome: string | null;
  reflection: string;
}

const SELECT = `SELECT e.id, e.started_at, e.ended_at, e.goal_id, s.technique, e.context, e.trigger_text, e.intensity_before,
    e.intensity_after, e.waited_seconds, e.outcome, e.reflection FROM impulse_episodes e LEFT JOIN strategies s ON s.id = e.strategy_id`;

function map(r: EpisodeRow): Episode {
  return {
    id: r.id,
    started_at: r.started_at,
    ended_at: r.ended_at,
    goal_id: r.goal_id,
    pathway: parsePathway(r.technique),
    context: r.context,
    trigger_text: r.trigger_text,
    intensity_before: r.intensity_before,
    intensity_after: r.intensity_after,
    waited_seconds: r.waited_seconds,
    outcome: r.outcome,
    reflection: r.reflection,
  };
}

export function get(db: Database, id: Id): Episode | undefined {
  const r = db.get<EpisodeRow>(`${SELECT} WHERE e.id = ?1`, [id]);
  return r ? map(r) : undefined;
}

export function recent(db: Database, since: number, goalId: Id | null, until = Number.MAX_SAFE_INTEGER): Episode[] {
  const rows =
    goalId !== null
      ? db.all<EpisodeRow>(`${SELECT} WHERE e.started_at >= ?1 AND e.started_at < ?3 AND e.goal_id = ?2 ORDER BY e.started_at DESC`, [since, goalId, until])
      : db.all<EpisodeRow>(`${SELECT} WHERE e.started_at >= ?1 AND e.started_at < ?2 ORDER BY e.started_at DESC`, [since, until]);
  return rows.map(map);
}

/** Recuentos descriptivos para la revisión del patrón (P6). */
export interface Pattern {
  total_7: number;
  total_30: number;
  known_30: number;
  not_acted_30: number;
  /** mañana, mediodía, tarde, noche */
  by_slot: [number, number, number, number];
  triggers: [string, number][];
  contexts: [string, number][];
  pathways: [Pathway, number][];
  mean_before: number | null;
  mean_after: number | null;
  /** Episodios con resultado `acted` en cada una de las últimas 4 semanas (la más antigua primero). */
  acted_weekly: [number, number, number, number];
}

export function emptyPattern(): Pattern {
  return {
    total_7: 0,
    total_30: 0,
    known_30: 0,
    not_acted_30: 0,
    by_slot: [0, 0, 0, 0],
    triggers: [],
    contexts: [],
    pathways: [],
    mean_before: null,
    mean_after: null,
    acted_weekly: [0, 0, 0, 0],
  };
}

/** Regla aritmética de seguridad: crecimiento en cada una de las 4 semanas. */
export function risingFourWeeks(p: Pattern): boolean {
  const w = p.acted_weekly;
  return w[0] > 0 && w[1] > w[0] && w[2] > w[1] && w[3] > w[2];
}

/** Entradas ordenadas por clave (como BTreeMap) y, si se pide, por recuento descendente (orden estable). */
function sortedCounts(m: Map<string, number>, byCountDesc: boolean): [string, number][] {
  const out = [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (byCountDesc) out.sort((a, b) => b[1] - a[1]);
  return out;
}

export function pattern(db: Database, goalId: Id | null, now: number): Pattern {
  // Ventana [now − 30 d, now + 1 s): con `now` en el pasado sirve para comparar con el periodo anterior.
  const eps = recent(db, now - 30 * 86_400, goalId, now + 1);
  const p = emptyPattern();
  const trig = new Map<string, number>();
  const ctx = new Map<string, number>();
  const paths = new Map<string, number>();
  let sb = 0, nb = 0, sa = 0, na = 0;
  for (const e of eps) {
    p.total_30 += 1;
    if (e.started_at >= now - 7 * 86_400) p.total_7 += 1;
    const hour = new Date(e.started_at * 1000).getHours();
    const slot = hour >= 5 && hour <= 11 ? 0 : hour >= 12 && hour <= 15 ? 1 : hour >= 16 && hour <= 20 ? 2 : 3;
    p.by_slot[slot] += 1;
    if (e.trigger_text !== '') trig.set(e.trigger_text, (trig.get(e.trigger_text) ?? 0) + 1);
    for (const c of e.context.split(',').map((s) => s.trim()).filter((s) => s !== '')) {
      ctx.set(c, (ctx.get(c) ?? 0) + 1);
    }
    if (e.pathway) {
      const k = pathwayKey(e.pathway);
      paths.set(k, (paths.get(k) ?? 0) + 1);
    }
    if (e.intensity_before !== null) {
      sb += e.intensity_before;
      nb += 1;
    }
    if (e.intensity_after !== null) {
      sa += e.intensity_after;
      na += 1;
    }
    switch (e.outcome) {
      case 'changed':
      case 'partly':
        p.known_30 += 1;
        p.not_acted_30 += 1;
        break;
      case 'acted': {
        p.known_30 += 1;
        const weeksAgo = Math.floor((now - e.started_at) / (7 * 86_400));
        if (weeksAgo >= 0 && weeksAgo < 4) p.acted_weekly[3 - weeksAgo] += 1;
        break;
      }
      default:
        break;
    }
  }
  p.triggers = sortedCounts(trig, true);
  p.contexts = sortedCounts(ctx, true);
  p.pathways = sortedCounts(paths, false).flatMap(([k, n]) => {
    const pw = parsePathway(k);
    return pw ? [[pw, n] as [Pathway, number]] : [];
  });
  p.mean_before = nb > 0 ? sb / nb : null;
  p.mean_after = na > 0 ? sa / na : null;
  return p;
}
