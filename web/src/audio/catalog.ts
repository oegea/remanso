/**
 * Catálogo de sonidos sintetizados por la propia aplicación: ni ficheros ni licencias.
 * Cada sonido declara para qué usos se ofrece. Los textos evitan prometer efectos: la
 * evidencia apoya calmarse y dormir (música lenta, sonidos de naturaleza, ruido continuo);
 * para escribir sólo hay preferencia personal.
 */

export type Use = 'write' | 'calm' | 'sleep' | 'meditate';
export type Family = 'noise' | 'rain' | 'nature';
export type SoundId =
  | 'white' | 'pink' | 'brown' | 'grey'
  | 'rain_soft' | 'rain_heavy' | 'storm'
  | 'waves' | 'wind' | 'stream' | 'fire';

export interface Sound {
  id: SoundId;
  name: string;
  desc: string;
  family: Family;
  uses: Use[];
}

export const USES: { key: Use; label: string }[] = [
  { key: 'write', label: 'Escribir' },
  { key: 'calm', label: 'Calmarse' },
  { key: 'sleep', label: 'Dormir' },
  { key: 'meditate', label: 'Meditar' },
];

export const FAMILIES: { key: Family; label: string }[] = [
  { key: 'rain', label: 'Lluvia' },
  { key: 'nature', label: 'Naturaleza' },
  { key: 'noise', label: 'Ruido continuo' },
];

export const SOUNDS: Sound[] = [
  { id: 'rain_soft', name: 'Lluvia suave', desc: 'Gotas finas y un fondo constante, como una tarde de lluvia tras la ventana.', family: 'rain', uses: ['write', 'calm', 'sleep', 'meditate'] },
  { id: 'rain_heavy', name: 'Lluvia intensa', desc: 'Más densa y grave; tapa mejor los ruidos de alrededor.', family: 'rain', uses: ['calm', 'sleep'] },
  { id: 'storm', name: 'Tormenta lejana', desc: 'Lluvia intensa con truenos de vez en cuando, lejos.', family: 'rain', uses: ['sleep', 'calm'] },
  { id: 'waves', name: 'Olas', desc: 'Olas que llegan y se retiran, cada una un poco distinta.', family: 'nature', uses: ['calm', 'sleep', 'meditate'] },
  { id: 'wind', name: 'Viento', desc: 'Viento que sube y baja despacio, sin ráfagas bruscas.', family: 'nature', uses: ['calm', 'sleep', 'meditate'] },
  { id: 'stream', name: 'Arroyo', desc: 'Agua que corre entre piedras, viva pero regular.', family: 'nature', uses: ['write', 'calm', 'meditate'] },
  { id: 'fire', name: 'Fuego de chimenea', desc: 'Un fondo grave y crepitar de leña, de tarde en tarde.', family: 'nature', uses: ['write', 'calm'] },
  { id: 'brown', name: 'Ruido marrón', desc: 'Grave y redondo, como un avión lejano. El que menos cansa.', family: 'noise', uses: ['write', 'sleep'] },
  { id: 'pink', name: 'Ruido rosa', desc: 'Equilibrado, parecido a una cascada lejana.', family: 'noise', uses: ['write', 'sleep'] },
  { id: 'grey', name: 'Ruido gris', desc: 'Ajustado para sonar igual de fuerte en todas las frecuencias al oído.', family: 'noise', uses: ['write'] },
  { id: 'white', name: 'Ruido blanco', desc: 'Todas las frecuencias por igual; más agudo y presente.', family: 'noise', uses: ['sleep'] },
];

export function sound(id: SoundId): Sound {
  return SOUNDS.find((s) => s.id === id)!;
}

/** El siguiente de la lista filtrada por uso (o de toda la lista), en bucle. */
export function nextId(id: SoundId, use: Use | null = null): SoundId {
  const list = use ? SOUNDS.filter((s) => s.uses.includes(use)) : SOUNDS;
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return list[0].id;
  return list[(i + 1) % list.length].id;
}

export const TIMER_OPTIONS = [0, 30, 60, 90] as const;

/** «28 min», «1 h 05 min», «menos de un minuto». */
export function fmtRemaining(ms: number): string {
  const min = Math.ceil(ms / 60_000);
  if (min <= 0) return 'menos de un minuto';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}
