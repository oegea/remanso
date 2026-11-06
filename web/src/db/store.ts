/**
 * Persistencia local (IndexedDB). Sólo se guarda el contenedor cifrado y las
 * preferencias no sensibles. Nada sale del dispositivo.
 */
import { openDB, type IDBPDatabase } from 'idb';

export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  lockAfterMinutes: number; // 0 = nunca
  passwordFeedback: boolean;
  weeklyReviewDay: number; // 0 lunes … 6 domingo
}

export const DEFAULT_PREFS: Prefs = { theme: 'system', lockAfterMinutes: 10, passwordFeedback: true, weeklyReviewDay: 6 };

const DB_NAME = 'remanso';
const STORE = 'kv';

let dbp: Promise<IDBPDatabase> | null = null;
function idb() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore(STORE);
      },
    });
  }
  return dbp;
}

export async function loadBlob(): Promise<Uint8Array | null> {
  const d = await idb();
  const v = (await d.get(STORE, 'blob')) as ArrayBuffer | Uint8Array | undefined;
  if (!v) return null;
  return v instanceof Uint8Array ? v : new Uint8Array(v);
}

export async function saveBlob(blob: Uint8Array): Promise<void> {
  const d = await idb();
  // Se guarda una copia previa para poder recuperarse de una escritura interrumpida.
  const tx = d.transaction(STORE, 'readwrite');
  const prev = await tx.store.get('blob');
  if (prev) await tx.store.put(prev, 'blob_prev');
  await tx.store.put(blob, 'blob');
  await tx.done;
}

export async function loadPrevBlob(): Promise<Uint8Array | null> {
  const d = await idb();
  const v = (await d.get(STORE, 'blob_prev')) as Uint8Array | undefined;
  return v ?? null;
}

export async function hasData(): Promise<boolean> {
  return (await loadBlob()) !== null;
}

export async function loadPrefs(): Promise<Prefs> {
  const d = await idb();
  const v = (await d.get(STORE, 'prefs')) as Partial<Prefs> | undefined;
  return { ...DEFAULT_PREFS, ...(v ?? {}) };
}

export async function savePrefs(p: Prefs): Promise<void> {
  const d = await idb();
  await d.put(STORE, p, 'prefs');
}

/** Borra TODO (datos cifrados y preferencias). Sólo tras confirmación explícita. */
export async function wipe(): Promise<void> {
  const d = await idb();
  await d.clear(STORE);
}

/** Estimación de espacio para informar al usuario (si el navegador la ofrece). */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!('storage' in navigator) || !navigator.storage.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}

/** Pide al navegador que no borre los datos por presión de espacio. */
export async function requestPersistence(): Promise<boolean> {
  if (!('storage' in navigator) || !navigator.storage.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
