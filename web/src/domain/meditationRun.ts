/**
 * La sesión de meditación en marcha, segundo a segundo y sin navegador: con el plan y lo
 * que esté haciendo la voz, decide cuándo aparece el círculo, cuándo se cambia de parte y
 * qué hay que hacer sonar. La pantalla (Meditate.tsx) sólo ejecuta lo que sale de aquí, y
 * la prueba (meditationRun.test.ts) recorre sesiones enteras con estas mismas reglas:
 *
 *  - Una parte no acaba mientras la voz tenga una frase sonando o en cola.
 *  - En las partes con círculo, el círculo aparece cuando la explicación ha terminado (nunca
 *    mientras la voz habla) y dura lo que tres respiraciones, ni más ni menos.
 *  - Si un audio se quedara colgado sin acabar nunca, se sigue pasado un margen.
 */
import { CIRCLE_S, type Phase } from './meditation';
import type { VoiceId } from '../audio/voice';

/** Margen para seguir si la voz no acaba nunca (más que la frase más larga). */
export const STUCK_S = 45;
/** Lo que se espera antes de la frase de una parte: tras el gong, o al cambiar sin gong. */
export const AFTER_GONG_MS = 2500, AFTER_CHANGE_MS = 200;

export interface Run {
  /** Parte actual del plan. */
  idx: number;
  /** Segundos dentro de la parte. */
  elapsed: number;
  /** Segundo de la parte en que apareció el círculo; `null` si aún no (o si la parte no lo tiene). */
  circleAt: number | null;
}

export interface Options { voice: boolean; gong: boolean }

export type Cue =
  | { kind: 'gong' }
  | { kind: 'vibrate'; pattern: 'phase' | 'step' | 'end' }
  | { kind: 'say'; id: VoiceId; delayMs: number }
  | { kind: 'step'; text: string };

export const START: Run = { idx: 0, elapsed: 0, circleAt: null };

const hasCircle = (p: Phase) => p.kind === 'deep_breaths' || p.kind === 'closing_breaths';

/** Lo que suena al entrar en una parte: gong al empezar y al terminar, vibración y su frase. */
function enter(plan: Phase[], idx: number, o: Options): Cue[] {
  const p = plan[idx];
  const closing = p.kind === 'open_eyes';
  const gong = o.gong && (idx === 0 || closing);
  const cues: Cue[] = [];
  if (gong) cues.push({ kind: 'gong' });
  cues.push({ kind: 'vibrate', pattern: closing ? 'end' : 'phase' });
  // La frase de la parte se dice al entrar, salvo que el plan le dé su segundo (`voiceAt`:
  // la reflexión inicial espera a «Empecemos» y a su silencio); entonces la lanza `tick`.
  if (o.voice && p.voice && !p.voiceAt) cues.push({ kind: 'say', id: p.voice, delayMs: gong ? AFTER_GONG_MS : AFTER_CHANGE_MS });
  return cues;
}

/** Arranque de la sesión. «Empecemos» ya suena desde el botón; la primera frase espera en cola. */
export function begin(plan: Phase[], o: Options): Cue[] { return enter(plan, 0, o); }

/** Pasa un segundo. `busy`: la voz tiene algo sonando o en cola. */
export function tick(plan: Phase[], prev: Run, o: Options, busy: boolean): { run: Run; cues: Cue[]; finished: boolean } {
  const run: Run = { ...prev, elapsed: prev.elapsed + 1 };
  const phase = plan[run.idx];
  const talking = o.voice && busy;
  const cues: Cue[] = [];

  if (o.voice && phase.voice && phase.voiceAt && phase.voiceAt === run.elapsed) cues.push({ kind: 'say', id: phase.voice, delayMs: 0 });
  const step = phase.steps.find((s) => s.at === run.elapsed);
  if (step) {
    cues.push({ kind: 'step', text: step.text }, { kind: 'vibrate', pattern: 'step' });
    if (o.voice && step.voice) cues.push({ kind: 'say', id: step.voice, delayMs: 0 });
  }

  const circle = hasCircle(phase);
  if (circle && run.circleAt === null) {
    const lead = phase.lead ?? 0;
    if (run.elapsed >= lead && (!talking || run.elapsed >= lead + STUCK_S)) run.circleAt = run.elapsed;
  }

  const end = circle ? (run.circleAt === null ? Infinity : run.circleAt + CIRCLE_S) : phase.seconds;
  if (run.elapsed < end || (talking && run.elapsed < end + STUCK_S)) return { run, cues, finished: false };
  if (run.idx + 1 >= plan.length) return { run, cues, finished: true };
  const next = plan[run.idx + 1];
  return {
    run: { idx: run.idx + 1, elapsed: 0, circleAt: hasCircle(next) && !next.lead ? 0 : null },
    cues: [...cues, ...enter(plan, run.idx + 1, o)],
    finished: false,
  };
}

/** El círculo está en pantalla. */
export function circleVisible(plan: Phase[], run: Run): boolean { return hasCircle(plan[run.idx]) && run.circleAt !== null; }

/** Segundos que le quedan a la parte actual. */
export function phaseLeft(plan: Phase[], run: Run): number {
  const p = plan[run.idx];
  if (!hasCircle(p)) return Math.max(0, p.seconds - run.elapsed);
  if (run.circleAt === null) return Math.max(0, (p.lead ?? 0) - run.elapsed) + CIRCLE_S;
  return Math.max(0, run.circleAt + CIRCLE_S - run.elapsed);
}

/** Segundos que quedan de sesión. */
export function totalLeft(plan: Phase[], run: Run): number {
  return phaseLeft(plan, run) + plan.slice(run.idx + 1).reduce((a, p) => a + p.seconds, 0);
}
