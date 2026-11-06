/**
 * Catálogo de pistas musicales (ficheros en `public/musica/`, licencia CC BY 4.0, ver
 * `public/musica/LICENSE.md`). Se sirven bajo demanda; «guardar para sin conexión» las
 * copia a la caché del navegador. Cada pista lleva para qué usos se ofrece y una frase.
 */
import type { Use } from './catalog';

export interface Track {
  id: string;
  title: string;
  /** Nombre del fichero dentro de /musica/. */
  file: string;
  uses: Use[];
  /** Una frase sobre cómo suena. */
  desc: string;
  /** Duración en segundos (orientativa; la real la da el fichero). */
  seconds: number;
}

export const TRACKS: Track[] = [
  { id: 'pagina-en-blanco', title: 'Página en blanco', file: 'pagina-en-blanco.mp3', uses: ['write'], desc: 'Piano de fieltro y Rhodes sobre un pulso lento y suave; nada que reclame atención.', seconds: 183 },
  { id: 'orilla', title: 'Orilla', file: 'orilla.mp3', uses: ['calm'], desc: 'Cuerdas largas y un piano con mucho aire, sin ritmo; quieta y cálida.', seconds: 224 },
  { id: 'bajo-la-manta', title: 'Bajo la manta', file: 'bajo-la-manta.mp3', uses: ['sleep'], desc: 'Un colchón grave y cálido que cambia muy despacio; sin melodía ni ritmo.', seconds: 179 },
  { id: 'cuerdas-de-nailon', title: 'Cuerdas de nailon', file: 'cuerdas-de-nailon.mp3', uses: ['write'], desc: 'Guitarra de nailon punteada con un patrón sencillo, contrabajo y escobillas lejanas; regular y cercana.', seconds: 180 },
  { id: 'tarde-de-domingo', title: 'Tarde de domingo', file: 'tarde-de-domingo.mp3', uses: ['calm'], desc: 'Piano solo de fieltro, arpegios lentos y mucho silencio entre frases; cálida, sin dramatismo.', seconds: 199 },
  { id: 'marea-baja', title: 'Marea baja', file: 'marea-baja.mp3', uses: ['write'], desc: 'Un colchón cálido con un pulso lento y apagado, como un latido; hipnótica y constante.', seconds: 196 },
  { id: 'templo', title: 'Templo', file: 'templo.mp3', uses: ['meditate'], desc: 'Dron de tanpura, cuencos de vez en cuando y silencios largos; seca y serena.', seconds: 179 },
];

export function track(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}

export function trackUrl(t: Track): string {
  return `${import.meta.env.BASE_URL}musica/${t.file}`;
}

/** La siguiente pista de la lista filtrada por uso, en bucle. */
export function nextTrackId(id: string, use: Use | null = null): string | null {
  const list = use ? TRACKS.filter((t) => t.uses.includes(use)) : TRACKS;
  if (list.length === 0) return null;
  const i = list.findIndex((t) => t.id === id);
  return list[(i + 1) % list.length].id;
}

/** «3:24». */
export function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const CACHE = 'remanso-musica-v1';

export async function isSaved(t: Track): Promise<boolean> {
  try { const c = await caches.open(CACHE); return (await c.match(trackUrl(t))) !== undefined; } catch { return false; }
}

export async function save(t: Track): Promise<boolean> {
  try { const c = await caches.open(CACHE); await c.add(trackUrl(t)); return true; } catch { return false; }
}

export async function unsave(t: Track): Promise<void> {
  try { const c = await caches.open(CACHE); await c.delete(trackUrl(t)); } catch { /* sin caché */ }
}

/** URL reproducible: desde la caché si está guardada (sirve sin conexión), si no la de red. */
export async function playableUrl(t: Track): Promise<string> {
  try {
    const c = await caches.open(CACHE);
    const res = await c.match(trackUrl(t));
    if (res) return URL.createObjectURL(await res.blob());
  } catch { /* sin caché */ }
  return trackUrl(t);
}
