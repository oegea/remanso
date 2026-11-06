/**
 * Reglas de repetición compactas, legibles y sin dependencias.
 *
 * Formato almacenado:
 *   `daily`            cada día
 *   `weekdays:LMXJVSD` los días de la semana indicados (L lunes … D domingo)
 *   `every:N:d|w|m`    cada N días / semanas / meses
 *   `monthly:D`        el día D de cada mes (se recorta al último día si no existe)
 */
import { WEEKDAYS_SHORT, addDays, daysInMonth, parseDay, weekdayIndex } from './dates';

export type Unit = 'days' | 'weeks' | 'months';

export type Rule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: boolean[] } // 7 posiciones, lunes primero
  | { kind: 'every'; n: number; unit: Unit }
  | { kind: 'monthly'; day: number };

export const DAILY: Rule = { kind: 'daily' };
export const weekdays = (days: boolean[]): Rule => ({ kind: 'weekdays', days });
export const every = (n: number, unit: Unit): Rule => ({ kind: 'every', n, unit });
export const monthly = (day: number): Rule => ({ kind: 'monthly', day });

const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WORKDAYS = [true, true, true, true, true, false, false];
const UNIT_CODE: Record<Unit, string> = { days: 'd', weeks: 'w', months: 'm' };

const isUint = (s: string) => /^\d+$/.test(s);
const asciiUpper = (c: string) => (c >= 'a' && c <= 'z' ? c.toUpperCase() : c);

export function parse(input: string): Rule | null {
  const s = input.trim();
  if (s === '') return null;
  if (s === 'daily') return DAILY;
  if (s.startsWith('weekdays:')) {
    const days = [false, false, false, false, false, false, false];
    for (const c of s.slice('weekdays:'.length)) {
      const i = LETTERS.indexOf(asciiUpper(c));
      if (i < 0) return null;
      days[i] = true;
    }
    return days.some(Boolean) ? weekdays(days) : null;
  }
  if (s.startsWith('every:')) {
    const [ns, u, ...rest] = s.slice('every:'.length).split(':');
    if (ns === undefined || u === undefined || rest.length > 0 || !isUint(ns)) return null;
    const n = Number(ns);
    const unit: Unit | null = u === 'd' ? 'days' : u === 'w' ? 'weeks' : u === 'm' ? 'months' : null;
    if (!unit) return null;
    return n >= 1 ? every(n, unit) : null;
  }
  if (s.startsWith('monthly:')) {
    const ds = s.slice('monthly:'.length);
    if (!isUint(ds)) return null;
    const d = Number(ds);
    return d >= 1 && d <= 31 ? monthly(d) : null;
  }
  return null;
}

export function toStorage(r: Rule): string {
  switch (r.kind) {
    case 'daily':
      return 'daily';
    case 'weekdays':
      return `weekdays:${LETTERS.filter((_, i) => r.days[i]).join('')}`;
    case 'every':
      return `every:${r.n}:${UNIT_CODE[r.unit]}`;
    case 'monthly':
      return `monthly:${r.day}`;
  }
}

const DAY_WORDS: Record<string, number> = {
  l: 0, lu: 0, lun: 0, lunes: 0,
  m: 1, ma: 1, mar: 1, martes: 1,
  x: 2, mi: 2, 'mié': 2, mie: 2, 'miércoles': 2, miercoles: 2,
  j: 3, ju: 3, jue: 3, jueves: 3,
  v: 4, vi: 4, vie: 4, viernes: 4,
  s: 5, sa: 5, 'sáb': 5, sab: 5, 'sábado': 5, sabado: 5,
  d: 6, do: 6, dom: 6, domingo: 6,
};

/**
 * Interpreta lo que escribe el usuario: «diario», «cada día», «L X V»,
 * «laborables», «semanal», «cada 2 semanas», «cada 10 días», «mensual», «día 15».
 */
export function parseHuman(s: string): Rule | null {
  const t = s.trim().toLowerCase();
  if (t === '' || t === 'no' || t === 'nunca' || t === '-') return null;
  const stored = parse(t);
  if (stored) return stored;
  switch (t) {
    case 'diario': case 'diaria': case 'cada día': case 'cada dia': case 'todos los días': case 'todos los dias':
      return DAILY;
    case 'laborables': case 'entre semana':
      return weekdays([...WORKDAYS]);
    case 'fin de semana': case 'fines de semana':
      return weekdays([false, false, false, false, false, true, true]);
    case 'semanal': case 'cada semana':
      return every(1, 'weeks');
    case 'quincenal': case 'cada dos semanas': case 'cada 2 semanas':
      return every(2, 'weeks');
    case 'mensual': case 'cada mes':
      return every(1, 'months');
  }
  if (t.startsWith('cada ')) {
    const it = t.slice(5).split(/\s+/).filter((w) => w !== '');
    const ns = it[0], u = it[1];
    if (ns === undefined || !isUint(ns) || u === undefined) return null;
    const unit: Unit | null =
      ['día', 'dias', 'días', 'dia'].includes(u) ? 'days'
      : ['semana', 'semanas'].includes(u) ? 'weeks'
      : ['mes', 'meses'].includes(u) ? 'months'
      : null;
    return unit ? every(Number(ns), unit) : null;
  }
  if (t.startsWith('día ') || t.startsWith('dia ')) {
    const ds = t.slice(4).trim();
    if (!isUint(ds)) return null;
    const d = Number(ds);
    return d >= 1 && d <= 31 ? monthly(d) : null;
  }
  // Letras de días: «l x v», «lmx», «lunes miércoles»
  const days = [false, false, false, false, false, false, false];
  let any = false;
  for (const tok of t.split(/[\s,]+/)) {
    if (tok === '') continue;
    if (tok in DAY_WORDS) {
      days[DAY_WORDS[tok]] = true;
      any = true;
    } else if (tok.length <= 7 && [...tok].every((c) => 'lmxjvsd'.includes(c))) {
      for (const c of tok) {
        days[LETTERS.indexOf(asciiUpper(c))] = true;
        any = true;
      }
    } else {
      return null;
    }
  }
  return any ? weekdays(days) : null;
}

/** Descripción breve en español. */
export function describe(r: Rule): string {
  switch (r.kind) {
    case 'daily':
      return 'cada día';
    case 'weekdays':
      if (r.days.every((d, i) => d === WORKDAYS[i])) return 'laborables';
      return WEEKDAYS_SHORT.filter((_, i) => r.days[i]).join(' ');
    case 'every':
      if (r.n === 1) return r.unit === 'days' ? 'cada día' : r.unit === 'weeks' ? 'cada semana' : 'cada mes';
      return `cada ${r.n} ${r.unit === 'days' ? 'días' : r.unit === 'weeks' ? 'semanas' : 'meses'}`;
    case 'monthly':
      return `el día ${r.day} de cada mes`;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

function clampDay(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(Math.min(d, daysInMonth(y, m)))}`;
}

/** Primera fecha estrictamente posterior a `after` que cumple la regla. */
export function nextAfter(r: Rule, after: string): string {
  switch (r.kind) {
    case 'daily':
      return addDays(after, 1);
    case 'weekdays': {
      let d = addDays(after, 1);
      for (let i = 0; i < 7; i++) {
        if (r.days[weekdayIndex(d)]) return d;
        d = addDays(d, 1);
      }
      return d;
    }
    case 'every':
      if (r.unit === 'days') return addDays(after, r.n);
      if (r.unit === 'weeks') return addDays(after, 7 * r.n);
      return addMonths(after, r.n);
    case 'monthly': {
      const a = parseDay(after)!;
      let y = a.getFullYear(), m = a.getMonth() + 1;
      const thisMonth = clampDay(y, m, r.day);
      if (thisMonth > after) return thisMonth;
      if (m === 12) { y += 1; m = 1; } else { m += 1; }
      return clampDay(y, m, r.day);
    }
  }
}

export function addMonths(day: string, n: number): string {
  const d = parseDay(day)!;
  const total = d.getMonth() + n;
  const y = d.getFullYear() + Math.floor(total / 12);
  const m = (total % 12) + 1;
  return clampDay(y, m, d.getDate());
}
