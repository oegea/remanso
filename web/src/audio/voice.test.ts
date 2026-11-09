import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VOICES, VOICE_IDS, busy, playLine, queueLine, stopLine, voiceText, voiceUrl } from './voice';
import { installFakeAudio, resetFakeAudio, spoken } from './fake-audio';
import { makePlan } from '../domain/meditation';
import DUR from './voice-durations.json';

// Los MP3 de cada voz, tal como están en public/voz/ (si falta uno, se regenera con tools/gen_voice.py).
const files = Object.keys(import.meta.glob('/public/voz/*/*.mp3'));

describe('voz guía', () => {
  it('cada frase del catálogo tiene su archivo en las dos voces', () => {
    const missing = VOICES.flatMap((v) => VOICE_IDS.filter((id) => !files.includes(`/public/voz/${v.id}/${id}.mp3`)).map((id) => `${v.id}/${id}`));
    expect(missing).toEqual([]);
  });

  it('la tabla de duraciones cubre cada frase y nada más (tools/voice_durations.py tras regenerar)', () => {
    const ids = Object.keys(DUR).sort();
    expect(ids).toEqual([...VOICE_IDS].sort());
    for (const id of ids) expect((DUR as Record<string, number>)[id]).toBeGreaterThan(5);
  });

  it('no hay archivos huérfanos', () => {
    const known = new Set(VOICES.flatMap((v) => VOICE_IDS.map((id) => `/public/voz/${v.id}/${id}.mp3`)));
    expect(files.filter((f) => !known.has(f))).toEqual([]);
  });

  it('todas las frases que usa el plan existen y son explicativas', () => {
    const used = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      for (const p of makePlan(10, seed)) { if (p.voice) used.add(p.voice); for (const s of p.steps) if (s.voice) used.add(s.voice); }
    }
    for (const id of used) expect(voiceText(id as (typeof VOICE_IDS)[number]).length).toBeGreaterThan(60);
    expect(voiceUrl('serena', 'empecemos')).toMatch(/\/voz\/serena\/empecemos\.mp3$/);
  });
});

describe('cola de la voz: ninguna frase corta a otra', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); installFakeAudio(); resetFakeAudio(); });
  afterEach(() => { stopLine(); vi.useRealTimers(); });
  const whole = () => spoken.map((s) => `${s.id}${s.cut ? ' (cortada)' : ''}`);

  it('lo que se encola espera a la frase lanzada desde un botón («Empecemos» suena entera)', async () => {
    void playLine('serena', 'empecemos');
    await vi.advanceTimersByTimeAsync(2500);
    void queueLine('serena', 'intention_1');
    expect(busy()).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(whole()).toEqual(['empecemos', 'intention_1']);
    expect(spoken[1].start).toBeGreaterThanOrEqual(spoken[0].end!);
    expect(busy()).toBe(false);
  });

  it('varias frases encoladas mientras suena otra suenan todas, enteras y en orden', async () => {
    void queueLine('serena', 'scan');
    await vi.advanceTimersByTimeAsync(1000);
    void queueLine('serena', 'scan_1');
    void queueLine('serena', 'scan_2');
    void queueLine('serena', 'scan_3');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(whole()).toEqual(['scan', 'scan_1', 'scan_2', 'scan_3']);
    for (let i = 1; i < spoken.length; i++) expect(spoken[i].start).toBeGreaterThanOrEqual(spoken[i - 1].end!);
  });

  it('parar lo calla todo: lo que suena y lo que esperaba', async () => {
    void queueLine('serena', 'scan');
    void queueLine('serena', 'scan_1');
    await vi.advanceTimersByTimeAsync(5000);
    stopLine();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(whole()).toEqual(['scan (cortada)']);
    expect(busy()).toBe(false);
  });

  it('una frase lanzada desde un botón sustituye a lo que hubiera, y lo siguiente la espera', async () => {
    void queueLine('serena', 'scan');
    void queueLine('serena', 'scan_1');
    await vi.advanceTimersByTimeAsync(5000);
    void playLine('serena', 'empecemos');
    void queueLine('serena', 'intention_1');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(whole()).toEqual(['scan (cortada)', 'empecemos', 'intention_1']);
  });
});
