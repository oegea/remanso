/// Derivación de clave en un hilo aparte para no congelar la interfaz.
import { deriveKeyBytes, type KdfParams } from './container';

self.onmessage = async (e: MessageEvent<{ id: number; password: string; params: KdfParams }>) => {
  const { id, password, params } = e.data;
  try {
    const key = await deriveKeyBytes(password, params);
    (self as unknown as Worker).postMessage({ id, key }, [key.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
