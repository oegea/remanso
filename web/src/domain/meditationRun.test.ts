import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as med from './meditation';
import { START, begin, circleVisible, tick, totalLeft, type Cue, type Options, type Run } from './meditationRun';
import { busy, playLine, queueLine, stopLine } from '../audio/voice';
import { installFakeAudio, resetFakeAudio, spoken, type Spoken } from '../audio/fake-audio';

/**
 * Sesiones enteras, de «Empezar» al formulario, con la cola real de la voz y un audio de
 * mentira que dura lo que cada frase. Lo que se comprueba es lo que se ha ido decidiendo
 * tras cada fallo visto en uso real (registro de decisiones, ADR-022, ADR-024 y ADR-026).
 */
interface Trace {
  plan: med.Phase[];
  said: Spoken[];
  /** Segundo en que empieza cada parte. */
  starts: number[];
  /** Segundo en que aparece el círculo en cada parte (las que lo tienen). */
  circles: Record<number, number>;
  gongs: number[];
  /** Fin de la última parte, y momento en que saldría el formulario. */
  end: number;
  form: number;
}

const now = () => Date.now() / 1000;

/** Lo mismo que hace la pantalla (Meditate.tsx): el botón, el arranque, un `tick` por segundo y la despedida. */
async function session(minutes: number, seed: number, o: Options, factor = 1): Promise<Trace> {
  vi.setSystemTime(0);
  resetFakeAudio(factor);
  const plan = med.makePlan(minutes, seed, o.voice);
  const t: Trace = { plan, said: spoken, starts: [0], circles: {}, gongs: [], end: 0, form: 0 };
  const perform = (cues: Cue[]) => {
    for (const c of cues) {
      if (c.kind === 'gong') t.gongs.push(now());
      else if (c.kind === 'say') { const id = c.id; if (c.delayMs > 0) setTimeout(() => void queueLine('serena', id), c.delayMs); else void queueLine('serena', id); }
    }
  };
  if (o.voice) void playLine('serena', 'empecemos'); // el botón «Empezar»
  perform(begin(plan, o));
  let run: Run = START;
  for (;;) {
    await vi.advanceTimersByTimeAsync(1000);
    const r = tick(plan, run, o, busy());
    if (r.run.idx !== run.idx) t.starts.push(now());
    if (circleVisible(plan, r.run) && t.circles[r.run.idx] === undefined) t.circles[r.run.idx] = now();
    expect(totalLeft(plan, r.run)).toBeGreaterThanOrEqual(0);
    run = r.run;
    perform(r.cues);
    if (r.finished) break;
    if (now() > minutes * 60 + 600) throw new Error('la sesión no termina');
  }
  t.end = now();
  if (o.voice) {
    let done = false;
    void queueLine('serena', plan[plan.length - 1].endVoice ?? 'farewell').then(() => { done = true; });
    while (!done && now() < t.end + 30) await vi.advanceTimersByTimeAsync(500);
  }
  t.form = now();
  t.said = [...spoken];
  stopLine();
  return t;
}

/** Las frases que tienen que sonar, en orden: nada se omite. */
function script(plan: med.Phase[]): string[] {
  const out: string[] = ['empecemos'];
  for (const p of plan) { if (p.voice) out.push(p.voice); for (const s of p.steps) if (s.voice) out.push(s.voice); }
  out.push(plan[plan.length - 1].endVoice!);
  return out;
}

const line = (t: Trace, id: string) => t.said.find((s) => s.id === id)!;
const phaseAt = (t: Trace, sec: number) => t.starts.filter((s) => s <= sec).length - 1;

beforeEach(() => { vi.useFakeTimers(); installFakeAudio(); });
afterEach(() => { stopLine(); vi.useRealTimers(); });

describe('una sesión entera, segundo a segundo', () => {
  const ON: Options = { voice: true, gong: true };

  it('suena todo el guion, en orden, y ninguna frase se corta ni pisa a otra', async () => {
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 25; seed++) {
      const t = await session(m, seed, ON);
      const where = `${m} min, semilla ${seed}`;
      expect(t.said.map((s) => s.id), where).toEqual(script(t.plan));
      expect(t.said.filter((s) => s.cut).map((s) => s.id), where).toEqual([]);
      for (let i = 1; i < t.said.length; i++) expect(t.said[i].start, `${where}: ${t.said[i].id}`).toBeGreaterThanOrEqual(t.said[i - 1].end!);
    }
  });

  it('«Empecemos» suena entero, luego la reflexión, y no queda un silencio muerto antes de las respiraciones', async () => {
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 25; seed++) {
      const t = await session(m, seed, ON);
      const hello = t.said[0], reflection = t.said[1], breaths = line(t, 'deep_breaths');
      expect(hello.id).toBe('empecemos');
      expect(hello.end! - hello.start).toBeCloseTo(med.lineDuration('empecemos'), 1);
      expect(reflection.id).toBe(t.plan[0].voice);
      // Tras «Empecemos», lo justo para colocarse; tras la reflexión, un momento para quedarse
      // con ella. Ni atropello ni medio minuto de espera.
      const settle = reflection.start - hello.end!, stay = breaths.start - reflection.end!;
      expect(settle, `${m} min, semilla ${seed}`).toBeGreaterThanOrEqual(med.SILENCE.welcome.min);
      expect(settle, `${m} min, semilla ${seed}`).toBeLessThanOrEqual(med.SILENCE.welcome.max + 1);
      expect(stay, `${m} min, semilla ${seed}`).toBeGreaterThanOrEqual(med.SILENCE.reflection.min);
      expect(stay, `${m} min, semilla ${seed}`).toBeLessThanOrEqual(med.SILENCE.reflection.max + 1);
    }
  });

  it('el círculo aparece en cuanto acaba su explicación, nunca antes, y dura tres respiraciones justas', async () => {
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 25; seed++) {
      const t = await session(m, seed, ON);
      const opening = line(t, 'deep_breaths'), closing = line(t, 'closing');
      for (const [i, explained] of [[1, opening.end!], [5, closing.end!]] as const) {
        const wait = t.circles[i] - explained;
        expect(wait, `parte ${i}: el círculo no sale mientras la voz lo explica`).toBeGreaterThanOrEqual(0);
        expect(wait, `parte ${i}: sin espera tras la explicación`).toBeLessThanOrEqual(2.5);
        const until = i === 5 ? t.end : t.starts[i + 1];
        expect(until - t.circles[i], `parte ${i}: treinta segundos de círculo`).toBe(med.CIRCLE_S);
      }
      // Durante el círculo no habla nadie.
      for (const s of t.said) for (const i of [1, 5]) {
        const from = t.circles[i], to = from + med.CIRCLE_S;
        expect(s.start >= to || s.end! <= from, `${s.id} suena durante el círculo`).toBe(true);
      }
    }
  });

  it('una parte no acaba mientras la voz habla, cada paso llega tras la explicación y el total es el elegido', async () => {
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 25; seed++) {
      const t = await session(m, seed, ON);
      const where = `${m} min, semilla ${seed}`;
      for (const s of t.said.slice(0, -1)) expect(phaseAt(t, s.start), `${where}: ${s.id} empieza y acaba en la misma parte`).toBe(phaseAt(t, s.end! - 0.01));
      // Lo que se oye de verdad respeta el modelo: tras cada frase del cuerpo y de la parte
      // principal, un silencio dentro de los límites de su papel.
      for (const i of [2, 3]) {
        const p = t.plan[i], until = t.starts[i + 1];
        const said = [{ id: p.voice!, role: p.role! }, ...p.steps.map((s) => ({ id: s.voice!, role: s.role }))];
        said.forEach((l, k) => {
          const silence = (k + 1 < said.length ? line(t, said[k + 1].id).start : until) - line(t, l.id).end!;
          expect(silence, `${where}: tras ${l.id}`).toBeGreaterThanOrEqual(med.SILENCE[l.role].min - 1);
          expect(silence, `${where}: tras ${l.id}`).toBeLessThanOrEqual(med.SILENCE[l.role].max + 1);
        });
      }
      expect(t.end, where).toBe(m * 60);
      expect(t.gongs.length).toBe(2);
      expect(t.gongs[1], 'el gong del final abre «Para terminar»').toBe(t.starts[4]);
      // El cierre: gong, abrir los ojos, círculo, y la despedida entera antes del formulario.
      const bye = t.said[t.said.length - 1];
      expect(bye.start).toBeGreaterThanOrEqual(t.end);
      expect(bye.cut).toBe(false);
      expect(t.form).toBeGreaterThanOrEqual(bye.end!);
    }
  });

  it('si los audios duran más o menos de lo medido, sigue sin cortarse nada y el círculo espera a la voz', async () => {
    for (const factor of [0.85, 1.25]) for (const m of med.DURATIONS) for (let seed = 1; seed <= 8; seed++) {
      const t = await session(m, seed, ON, factor);
      const where = `×${factor}, ${m} min, semilla ${seed}`;
      expect(t.said.map((s) => s.id), where).toEqual(script(t.plan));
      expect(t.said.filter((s) => s.cut), where).toEqual([]);
      for (let i = 1; i < t.said.length; i++) expect(t.said[i].start, where).toBeGreaterThanOrEqual(t.said[i - 1].end!);
      expect(t.circles[1], where).toBeGreaterThanOrEqual(line(t, 'deep_breaths').end!);
      expect(t.circles[5], where).toBeGreaterThanOrEqual(line(t, 'closing').end!);
      expect(t.starts[2] - t.circles[1], where).toBe(med.CIRCLE_S);
      expect(t.end, where).toBeGreaterThanOrEqual(m * 60);
      expect(t.end, `${where}: como mucho, lo que se alargan las frases`).toBeLessThanOrEqual(m * 60 + 60);
    }
  });

  it('sin voz: el círculo sale al empezar su parte, no suena ninguna frase y el total es exacto', async () => {
    for (const gong of [true, false]) for (const m of med.DURATIONS) for (let seed = 1; seed <= 8; seed++) {
      const t = await session(m, seed, { voice: false, gong });
      expect(t.said).toEqual([]);
      expect(t.circles[1]).toBe(t.starts[1]);
      expect(t.circles[5]).toBe(t.starts[5]);
      expect(t.end).toBe(m * 60);
      expect(t.form).toBe(t.end);
      expect(t.gongs.length).toBe(gong ? 2 : 0);
    }
  });

  it('con voz y sin gong, la primera frase también espera a «Empecemos»', async () => {
    const t = await session(10, 3, { voice: true, gong: false });
    expect(t.said.filter((s) => s.cut)).toEqual([]);
    expect(t.said.map((s) => s.id)).toEqual(script(t.plan));
    expect(t.said[1].start).toBeGreaterThanOrEqual(t.said[0].end!);
  });
});
