import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../db/sqlite';
import * as med from './meditation';
import { voiceText, type VoiceId } from '../audio/voice';

/** Las frases de una parte con el segundo en que empiezan y el silencio que las sigue (hasta la siguiente o el final). */
function silences(p: med.Phase, voice: boolean): { id: VoiceId; role: med.Role; silence: number }[] {
  const said = [...(p.voice && p.role ? [{ id: p.voice, role: p.role, at: p.voiceAt ?? 0 }] : []), ...p.steps.map((s) => ({ id: s.voice!, role: s.role, at: s.at }))];
  return said.map((l, i) => ({ id: l.id, role: l.role, silence: (i + 1 < said.length ? said[i + 1].at : p.seconds) - l.at - med.lineDuration(l.id, voice) }));
}

const STEPS: Record<string, number> = { settle: 6, scan: 6, sounds: 1, posture: 5, weight: 2, breath_body: 1 };

describe('plan de sesión', () => {
  it('suma exactamente la duración pedida y tiene la estructura fija', () => {
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 40; seed++) for (const voice of [true, false]) {
      const plan = med.makePlan(m, seed, voice);
      expect(med.planSeconds(plan)).toBe(m * 60);
      expect(plan.map((p) => p.kind).slice(0, 2)).toEqual(['intention', 'deep_breaths']);
      expect(Object.keys(STEPS)).toContain(plan[2].kind);
      expect(plan.map((p) => p.kind).slice(3)).toEqual(['breath', 'open_eyes', 'closing_breaths']);
      expect(plan[1].seconds - (plan[1].lead ?? 0), 'treinta segundos de círculo tras la explicación').toBe(med.CIRCLE_S);
      expect(plan[5].seconds).toBe(med.CIRCLE_S);
    }
  });

  it('modelo de tiempos: el silencio tras cada frase está entre el mínimo y el máximo de su papel', () => {
    for (const voice of [true, false]) for (const m of med.DURATIONS) for (let seed = 1; seed <= 200; seed++) {
      const plan = med.makePlan(m, seed, voice);
      for (const p of plan) for (const l of silences(p, voice)) {
        if (!voice && (p.kind === 'intention' || p.kind === 'open_eyes' || p.kind === 'deep_breaths')) continue; // sin voz duran lo que se tarda en leer
        const where = `${voice ? 'con' : 'sin'} voz, ${m} min, semilla ${seed}, ${p.kind}: ${l.id} (${l.role})`;
        // El círculo no es silencio: tras su anuncio se cuenta lo que tarda en aparecer.
        const silence = p.kind === 'deep_breaths' ? p.lead! - med.lineDuration(l.id, voice) : p.kind === 'open_eyes' ? l.silence - med.GONG_S : l.silence;
        expect(silence, where).toBeGreaterThanOrEqual(med.SILENCE[l.role].min - 1);
        expect(silence, where).toBeLessThanOrEqual(med.SILENCE[l.role].max + 1);
      }
    }
  });

  it('tras anunciar el círculo no hay espera: aparece al acabar la frase', () => {
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 20; seed++) {
      const plan = med.makePlan(m, seed, true);
      expect(plan[1].role).toBe('announce');
      expect(plan[4].role).toBe('announce');
      // Un segundo de respiro, más el redondeo a segundos enteros.
      expect(med.SILENCE.announce.max).toBeLessThanOrEqual(1);
      expect(plan[1].lead! - med.lineDuration('deep_breaths')).toBeLessThan(med.SILENCE.announce.max + 1);
      expect(plan[4].seconds - med.GONG_S - med.lineDuration('closing')).toBeLessThan(med.SILENCE.announce.max + 1);
    }
  });

  it('la reflexión se dice cuando «Empecemos» ha acabado y ha dado tiempo a colocarse', () => {
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 20; seed++) {
      const p = med.makePlan(m, seed, true)[0];
      const pause = p.voiceAt! - med.lineDuration('empecemos');
      expect(pause).toBeGreaterThanOrEqual(med.SILENCE.welcome.min);
      expect(pause).toBeLessThanOrEqual(med.SILENCE.welcome.max + 1);
    }
  });

  it('ningún guion se recorta: los recorridos van enteros en cualquier duración y entran todas las variantes', () => {
    for (const m of med.DURATIONS) {
      const kinds = new Set<string>(), focuses = new Set<string>(), ends = new Set<string>();
      for (let seed = 1; seed <= 120; seed++) {
        const p = med.makePlan(m, seed, true);
        kinds.add(p[2].kind); focuses.add(p[3].voice!); ends.add(p[5].endVoice!);
        expect(p[2].steps.length, `${m} min, ${p[2].kind}: todos sus pasos`).toBe(STEPS[p[2].kind]);
        if (p[2].kind === 'settle' || p[2].kind === 'scan') expect(p[2].steps.map((s) => s.voice).slice(-1)[0], 'el recorrido llega a la cara').toBe('scan_6');
        expect(p[3].steps.length).toBeGreaterThanOrEqual(1);
        expect(p[3].eyesClosed).toBe(p[3].voice !== 'gaze');
      }
      expect(kinds.size, `${m} min: las seis variantes de cuerpo`).toBe(6);
      expect(focuses.size, `${m} min: los siete apoyos`).toBe(7);
      expect(ends.size).toBe(3);
    }
  });

  it('una sola proporción para toda la sesión: cada silencio está igual de lejos de su mínimo que los demás', () => {
    const where = (m: number, seed: number) => `${m} min, semilla ${seed}`;
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 200; seed++) {
      const plan = med.makePlan(m, seed, true);
      // Lo que se estira la práctica (cuerpo y parte principal): entre 0 (mínimos) y 1 (máximos).
      const all = [plan[2], plan[3]].flatMap((p) => silences(p, true));
      const said = all.reduce((a, l) => a + med.lineDuration(l.id), 0);
      const least = all.reduce((a, l) => a + med.SILENCE[l.role].min, 0), room = all.reduce((a, l) => a + med.SILENCE[l.role].max - med.SILENCE[l.role].min, 0);
      const k = (plan[2].seconds + plan[3].seconds - said - least) / room;
      expect(k, where(m, seed)).toBeGreaterThanOrEqual(0);
      expect(k, where(m, seed)).toBeLessThanOrEqual(1);
      // Cada silencio, el de un anuncio o el de la práctica, sale de esa misma proporción (más el redondeo a segundos).
      for (const l of all) expect(Math.abs(l.silence - med.silence(l.role, k)), `${where(m, seed)}: tras ${l.id}`).toBeLessThanOrEqual(1.5);
      const lead = plan[1].lead! - med.lineDuration('deep_breaths'), stay = plan[0].seconds - plan[0].voiceAt! - med.lineDuration(plan[0].voice);
      expect(Math.abs(lead - med.silence('announce', k)), where(m, seed)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(stay - med.silence('reflection', k)), where(m, seed)).toBeLessThanOrEqual(2);
    }
  });

  it('más duración da más silencio, nunca menos guion; y un recordatorio más antes que un silencio excesivo', () => {
    const k: Record<number, number[]> = { 10: [], 15: [], 20: [] }, count: Record<number, number[]> = { 10: [], 15: [], 20: [] };
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 200; seed++) {
      const plan = med.makePlan(m, seed, true);
      const gaps = silences(plan[3], true).map((l) => l.silence);
      k[m].push((Math.min(...gaps) - med.SILENCE.focus.min) / (med.SILENCE.focus.max - med.SILENCE.focus.min));
      count[m].push(plan[3].steps.length);
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(k[10])).toBeLessThan(avg(k[15]));
    // Con sitio de sobra, la sesión no se queda en los mínimos ni se va a los máximos: ronda la mitad.
    for (const m of [15, 20]) { expect(Math.min(...k[m]), `${m} min`).toBeGreaterThan(0.25); expect(Math.max(...k[m]), `${m} min`).toBeLessThan(0.75); }
    expect(avg(count[20])).toBeGreaterThan(avg(count[10]));
  });

  it('un guion puede durar entre la suma de sus mínimos y la de sus máximos, y las frases se colocan dentro', () => {
    const script: { id: 'scan' | 'scan_1' | 'scan_2'; role: med.Role }[] = [{ id: 'scan', role: 'explain' }, { id: 'scan_1', role: 'place' }, { id: 'scan_2', role: 'place' }];
    const said = script.reduce((a, l) => a + med.lineDuration(l.id), 0);
    const s = med.span(script);
    expect(s.min).toBe(Math.ceil(said + med.SILENCE.explain.min + 2 * med.SILENCE.place.min));
    expect(s.max).toBe(Math.floor(said + med.SILENCE.explain.max + 2 * med.SILENCE.place.max));
    expect(med.stretch(script, said + med.SILENCE.explain.min + 2 * med.SILENCE.place.min)).toBeCloseTo(0, 5);
    expect(med.stretch(script, said + med.SILENCE.explain.max + 2 * med.SILENCE.place.max)).toBeCloseTo(1, 5);
    expect(med.stretch(script, s.min - 5)).toBeLessThan(0);
    // Al mínimo, cada frase llega justo tras el silencio mínimo de la anterior; al máximo, tras el máximo.
    const tight = med.layout(script, s.min), loose = med.layout(script, s.max);
    expect(tight[0]).toBe(0);
    expect(tight[1] - med.lineDuration('scan')).toBeCloseTo(med.SILENCE.explain.min, 0);
    expect(loose[1] - med.lineDuration('scan')).toBeCloseTo(med.SILENCE.explain.max, 0);
    expect(loose[2] - loose[1] - med.lineDuration('scan_1')).toBeCloseTo(med.SILENCE.place.max, 0);
    // A medio camino, todos los silencios están a medio camino.
    const half = med.layout(script, (s.min + s.max) / 2);
    expect(half[2] - half[1] - med.lineDuration('scan_1')).toBeCloseTo((med.SILENCE.place.min + med.SILENCE.place.max) / 2, 0);
  });

  it('los recordatorios encajan con el apoyo: sin respiración como apoyo, ninguno habla de volver a ella', () => {
    let other = 0;
    for (const m of med.DURATIONS) for (let seed = 1; seed <= 200; seed++) {
      const p = med.makePlan(m, seed, true)[3];
      if (p.voice !== 'gaze' && p.voice !== 'mind') continue;
      other++;
      for (const s of p.steps) expect(`${s.text} ${voiceText(s.voice!)}`, `${p.voice}: ${s.voice}`).not.toMatch(/respiraci|\baire\b/i);
    }
    expect(other).toBeGreaterThan(20);
  });

  it('varía entre semillas y es determinista con la misma', () => {
    const kinds = new Set<string>(), cues = new Set<string>(), breaths = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const plan = med.makePlan(10, seed);
      kinds.add(plan[2].kind); cues.add(plan[0].cue); breaths.add(plan[3].cue);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    expect(cues.size).toBeGreaterThan(3);
    expect(breaths.size).toBeGreaterThanOrEqual(3);
    expect(med.makePlan(15, 7)).toEqual(med.makePlan(15, 7));
  });
});

describe('diario de meditación', () => {
  let db: Database;
  beforeEach(async () => { db = await Database.create(() => {}); });
  it('guarda, termina, lista y cuenta banderas', () => {
    const plan = med.makePlan(10, 1);
    const id = med.start(db, plan, 1000);
    expect(med.list(db)).toHaveLength(0); // sin terminar no aparece
    med.finish(db, id, { now: 1300, doneSeconds: 300, feeling: 1, unpleasant: false, notes: 'bien' });
    const id2 = med.start(db, plan, 2000);
    med.finish(db, id2, { now: 2300, doneSeconds: 120, feeling: -1, unpleasant: true, notes: '' });
    const l = med.list(db);
    expect(l.map((s) => s.id)).toEqual([id2, id]);
    expect(l[0].unpleasant).toBe(true);
    expect(med.unpleasantAmongLast(db, 3)).toBe(1);
    expect(med.totals(db)).toEqual({ sessions: 2, minutes: 7 });
    expect(med.feelingLabel(l[1].feeling)).toBe('Algo más tranquilo');
    med.setNotes(db, id, '  ahora mejor ');
    expect(med.get(db, id)!.notes).toBe('ahora mejor');
    med.remove(db, id2);
    expect(med.list(db).map((s) => s.id)).toEqual([id]);
    expect(med.totals(db)).toEqual({ sessions: 1, minutes: 5 });
  });
  it('descarta las empezadas y no terminadas', () => {
    med.start(db, med.makePlan(10, 1), 1000);
    med.discardUnfinished(db);
    expect(db.scalar<number>('SELECT count(*) FROM meditation_sessions')).toBe(0);
  });
  it('preferencias con valores por defecto y persistencia', () => {
    expect(med.prefs(db).minutes).toBe(10);
    db.run("INSERT INTO settings(key, value) VALUES ('meditation_prefs', '{\"minutes\":5}') ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    expect(med.prefs(db).minutes, 'cinco minutos ya no existe: pasa a diez').toBe(10);
    med.setPrefs(db, { minutes: 15, voice: true });
    expect(med.prefs(db)).toMatchObject({ minutes: 15, voice: true, vibrate: true });
  });
});
