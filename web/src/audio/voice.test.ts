import { describe, expect, it } from 'vitest';
import { VOICES, VOICE_IDS, voiceText, voiceUrl } from './voice';
import { makePlan } from '../domain/meditation';

// Los MP3 de cada voz, tal como están en public/voz/ (si falta uno, se regenera con tools/gen_voice.py).
const files = Object.keys(import.meta.glob('/public/voz/*/*.mp3'));

describe('voz guía', () => {
  it('cada frase del catálogo tiene su archivo en las dos voces', () => {
    const missing = VOICES.flatMap((v) => VOICE_IDS.filter((id) => !files.includes(`/public/voz/${v.id}/${id}.mp3`)).map((id) => `${v.id}/${id}`));
    expect(missing).toEqual([]);
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
