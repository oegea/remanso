import { importKey, type KdfParams } from './container';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (k: Uint8Array) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./kdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; key?: Uint8Array; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      // El buffer llega transferido: se usa tal cual para que el borrado posterior lo alcance.
      if (e.data.key) p.resolve(e.data.key);
      else p.reject(new Error(e.data.error ?? 'error al derivar la clave'));
    };
  }
  return worker;
}

/** Deriva la clave en el worker y devuelve los 32 bytes en claro (quien los recibe debe borrarlos). */
export function deriveRawOffThread(password: string, params: KdfParams): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, password, params });
  });
}

/** Deriva la clave en el worker y la importa como CryptoKey no extraíble. */
export async function deriveKeyOffThread(password: string, params: KdfParams): Promise<CryptoKey> {
  return importKey(await deriveRawOffThread(password, params));
}
