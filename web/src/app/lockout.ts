/**
 * Freno a la fuerza bruta en la pantalla de desbloqueo. Tras tres fallos seguidos, cada
 * intento siguiente espera el doble (10 s, 20 s, 40 s… hasta 5 min). Se guarda en
 * `localStorage` para que sobreviva a recargar la página.
 *
 * Honestidad: esto frena a quien tiene el teléfono en la mano y prueba contraseñas; a quien
 * copia el archivo cifrado y lo ataca fuera de la aplicación lo frena Argon2id (32 MiB,
 * tres pasadas: entre medio segundo y dos por intento), no este contador.
 */

export const FREE_TRIES = 3;
export const MAX_WAIT_S = 300;
const KEY = 'remanso.intentos';

export class TooManyTries extends Error {
  constructor(public readonly until: number) { super('demasiados intentos'); this.name = 'TooManyTries'; }
}

interface State { n: number; until: number }

let memory: State = { n: 0, until: 0 };

function read(): State {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) { const s = JSON.parse(raw) as Partial<State>; return { n: s.n ?? 0, until: s.until ?? 0 }; }
  } catch { /* sin almacenamiento: se usa la memoria */ }
  return memory;
}

function write(s: State): void {
  memory = s;
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(s)); } catch { /* nada */ }
}

/** Segundos de espera tras `failures` fallos seguidos. */
export function waitSeconds(failures: number): number {
  if (failures < FREE_TRIES) return 0;
  return Math.min(MAX_WAIT_S, 10 * 2 ** (failures - FREE_TRIES));
}

/** Instante (ms) hasta el que no se puede probar, o 0 si se puede ya. */
export function lockedUntil(now = Date.now()): number {
  const s = read();
  return s.until > now ? s.until : 0;
}

/** Anota un fallo y devuelve hasta cuándo hay que esperar (0 si todavía no hay espera). */
export function noteFailure(now = Date.now()): number {
  const s = read();
  const n = s.n + 1;
  const wait = waitSeconds(n);
  const until = wait ? now + wait * 1000 : 0;
  write({ n, until });
  return until;
}

export function clearFailures(): void {
  memory = { n: 0, until: 0 };
  try { globalThis.localStorage?.removeItem(KEY); } catch { /* nada */ }
}

/** «27 s», «2 min», «2 min 5 s». */
export function fmtWait(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}
