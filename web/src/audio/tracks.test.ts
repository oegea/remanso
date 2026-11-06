import { describe, it, expect } from 'vitest';
import { TRACKS, nextTrackId, fmtSeconds } from './tracks';

// Ficheros realmente presentes en public/musica (Vite resuelve el glob en tiempo de prueba).
const FILES = Object.keys(import.meta.glob('../../public/musica/*.mp3'));

describe('catálogo de pistas', () => {
  it('cada pista tiene fichero presente, título, uso y duración', () => {
    for (const t of TRACKS) {
      expect(FILES.some((f) => f.endsWith('/' + t.file)), `falta public/musica/${t.file}`).toBe(true);
      expect(t.title.length).toBeGreaterThan(2);
      expect(t.uses.length).toBeGreaterThan(0);
      expect(t.seconds).toBeGreaterThan(30);
    }
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
  });
  it('nextTrackId devuelve null sin pistas y recorre la lista en bucle', () => {
    if (TRACKS.length === 0) { expect(nextTrackId('x')).toBeNull(); return; }
    expect(nextTrackId(TRACKS[TRACKS.length - 1].id)).toBe(TRACKS[0].id);
  });
  it('fmtSeconds', () => {
    expect(fmtSeconds(204)).toBe('3:24');
    expect(fmtSeconds(5)).toBe('0:05');
  });
});
