/**
 * Fechas y horas locales con nombres en español. Sin librerías.
 * `day` = 'AAAA-MM-DD' en hora local; `ts` = segundos Unix.
 */
export const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
export const WEEKDAYS_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;
export const WEEKDAYS_INITIAL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

export const nowTs = (): number => Math.floor(Date.now() / 1000);
export const nowDate = (): Date => new Date();

const pad = (n: number) => String(n).padStart(2, '0');

export function dateToDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function today(): string {
  return dateToDay(new Date());
}
export function tsToDay(ts: number): string {
  return dateToDay(new Date(ts * 1000));
}
/** Convierte 'AAAA-MM-DD' en Date local a medianoche; null si no es válida. */
export function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}
export function addDays(day: string, n: number): string {
  const d = parseDay(day)!;
  d.setDate(d.getDate() + n);
  return dateToDay(d);
}
export function diffDays(a: string, b: string): number {
  const da = parseDay(a)!, db = parseDay(b)!;
  return Math.round((da.getTime() - db.getTime()) / 86_400_000);
}
/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(day: string): number {
  return (parseDay(day)!.getDay() + 6) % 7;
}
export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month 1..12
}

export function fmtDateShort(day: string): string {
  const d = parseDay(day);
  if (!d) return day;
  return `${WEEKDAYS_SHORT[weekdayIndex(day)]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDateLong(day: string): string {
  const d = parseDay(day);
  if (!d) return day;
  return `${WEEKDAYS[weekdayIndex(day)]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}
export function fmtDateCompact(day: string, todayDay = today()): string {
  const d = parseDay(day);
  if (!d) return day;
  const sameYear = d.getFullYear() === parseDay(todayDay)!.getFullYear();
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}
export function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Descripción relativa, neutra: «hoy», «ayer», «hace 3 días», «hace 2 semanas». */
export function fmtRelativeDays(day: string, todayDay = today()): string {
  const diff = diffDays(todayDay, day);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff >= 2 && diff <= 13) return `hace ${diff} días`;
  if (diff >= 14 && diff <= 59) return `hace ${Math.floor(diff / 7)} semanas`;
  if (diff >= 60 && diff <= 365) return `hace ${Math.floor(diff / 30)} meses`;
  if (diff < 0) {
    const f = -diff;
    if (f === 1) return 'mañana';
    if (f <= 13) return `en ${f} días`;
    return `en ${Math.floor(f / 7)} semanas`;
  }
  return `hace ${Math.floor(diff / 365)} años`;
}

const WEEKDAY_WORDS: Record<string, number> = {
  l: 0, lu: 0, lun: 0, lunes: 0, m: 1, ma: 1, mar: 1, martes: 1, x: 2, mi: 2, 'mié': 2, mie: 2, 'miércoles': 2, miercoles: 2,
  j: 3, ju: 3, jue: 3, jueves: 3, v: 4, vi: 4, vie: 4, viernes: 4, s: 5, sa: 5, 'sáb': 5, sab: 5, 'sábado': 5, sabado: 5,
  d: 6, do: 6, dom: 6, domingo: 6,
};

/**
 * Interpreta una fecha escrita: hoy, mañana, pasado, lun…dom (próximo), +N,
 * AAAA-MM-DD, DD/MM, DD/MM/AAAA, DD (este mes o el siguiente), «ninguna».
 * Devuelve `{ day: null }` para «ninguna» y `undefined` si no se entiende.
 */
export function parseDayInput(s: string, todayDay = today()): { day: string | null } | undefined {
  const t = s.trim().toLowerCase();
  if (t === '' || ['ninguna', 'ninguno', '-', 'no', 'sin fecha'].includes(t)) return { day: null };
  if (t === 'hoy') return { day: todayDay };
  if (t === 'mañana' || t === 'manana') return { day: addDays(todayDay, 1) };
  if (t === 'pasado' || t === 'pasado mañana') return { day: addDays(todayDay, 2) };
  if (['semana', 'próxima semana', 'proxima semana'].includes(t)) return { day: addDays(weekStart(todayDay), 7) };
  if (/^\+\d+$/.test(t)) return { day: addDays(todayDay, Number(t.slice(1))) };
  if (t in WEEKDAY_WORDS) {
    let diff = WEEKDAY_WORDS[t] - weekdayIndex(todayDay);
    if (diff <= 0) diff += 7;
    return { day: addDays(todayDay, diff) };
  }
  if (parseDay(t)) return { day: t };
  const parts = t.split('/');
  const td = parseDay(todayDay)!;
  if (parts.length === 1) {
    const dd = Number(t);
    if (!Number.isInteger(dd) || dd < 1 || dd > 31) return undefined;
    const y = td.getFullYear(), m = td.getMonth() + 1;
    const thisMonth = `${y}-${pad(m)}-${pad(Math.min(dd, daysInMonth(y, m)))}`;
    if (thisMonth >= todayDay) return { day: thisMonth };
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    return { day: `${ny}-${pad(nm)}-${pad(Math.min(dd, daysInMonth(ny, nm)))}` };
  }
  if (parts.length === 2 || parts.length === 3) {
    const dd = Number(parts[0]), mm = Number(parts[1]);
    if (!Number.isInteger(dd) || !Number.isInteger(mm)) return undefined;
    let y = parts.length === 3 ? Number(parts[2]) : td.getFullYear();
    if (parts.length === 3 && y < 100) y += 2000;
    let cand = `${y}-${pad(mm)}-${pad(dd)}`;
    if (!parseDay(cand)) return undefined;
    if (parts.length === 2 && cand < todayDay) {
      cand = `${y + 1}-${pad(mm)}-${pad(dd)}`;
      if (!parseDay(cand)) return undefined;
    }
    return { day: cand };
  }
  return undefined;
}

/** «HH:MM» o «HH» → [hora, minuto]. */
export function parseTimeInput(s: string): [number, number] | undefined {
  const t = s.trim();
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(t);
  if (!m) return undefined;
  const h = Number(m[1]), mi = m[2] ? Number(m[2]) : 0;
  if (h > 23 || mi > 59) return undefined;
  return [h, mi];
}

/** «mañana 9:00», «+2h», «+30m», «lun 18:30», «18:30», «15/11 10:00» → ts. */
export function parseDatetimeInput(s: string, now = new Date()): number | undefined {
  const t = s.trim().toLowerCase();
  const rel = /^\+(\d+)([hmd])$/.exec(t);
  if (rel) {
    const n = Number(rel[1]);
    const mult = rel[2] === 'h' ? 3600 : rel[2] === 'm' ? 60 : 86_400;
    return Math.floor(now.getTime() / 1000) + n * mult;
  }
  const todayDay = dateToDay(now);
  let dayPart = '', timePart = '';
  const sp = t.lastIndexOf(' ');
  if (sp > 0 && parseTimeInput(t.slice(sp + 1))) {
    dayPart = t.slice(0, sp);
    timePart = t.slice(sp + 1);
  } else if (parseTimeInput(t)) {
    timePart = t;
  } else {
    dayPart = t;
    timePart = '9:00';
  }
  const hm = parseTimeInput(timePart);
  if (!hm) return undefined;
  let day: string;
  if (!dayPart) {
    const cand = new Date(now);
    cand.setHours(hm[0], hm[1], 0, 0);
    day = cand.getTime() <= now.getTime() ? addDays(todayDay, 1) : todayDay;
  } else {
    const r = parseDayInput(dayPart, todayDay);
    if (!r || !r.day) return undefined;
    day = r.day;
  }
  const d = parseDay(day)!;
  d.setHours(hm[0], hm[1], 0, 0);
  return Math.floor(d.getTime() / 1000);
}
