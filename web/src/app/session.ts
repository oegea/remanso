/**
 * Sesión: estado de bloqueo, clave en memoria (CryptoKey no extraíble), base de
 * datos en memoria y guardado cifrado con retardo. Un único almacén observable
 * para toda la interfaz (sin librerías de estado).
 */
import { Database } from '../db/sqlite';
import * as store from '../db/store';
import { deriveKeyOffThread } from '../crypto/kdf';
import { newKdfParams, open as openContainer, readHeader, seal, WrongPassword, type KdfParams } from '../crypto/container';

export type Phase = 'loading' | 'first-use' | 'locked' | 'unlocked';

export interface SessionState {
  phase: Phase;
  prefs: store.Prefs;
  /** Pendiente de guardar / guardando / guardado. */
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  lastError: string | null;
}

type Listener = () => void;

const SAVE_DELAY_MS = 1500;

class Session {
  state: SessionState = { phase: 'loading', prefs: store.DEFAULT_PREFS, saveState: 'idle', lastError: null };
  db: Database | null = null;
  private key: CryptoKey | null = null;
  private params: KdfParams | null = null;
  private listeners = new Set<Listener>();
  private saveTimer: number | null = null;
  private lockTimer: number | null = null;
  private lastActivity = Date.now();
  private saving: Promise<void> | null = null;

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit() {
    for (const l of this.listeners) l();
  }
  private set(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  async init(): Promise<void> {
    const prefs = await store.loadPrefs();
    applyTheme(prefs.theme);
    const has = await store.hasData();
    this.set({ prefs, phase: has ? 'locked' : 'first-use' });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush();
    });
    window.addEventListener('pagehide', () => void this.flush());
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(ev, () => this.touch(), { passive: true });
    }
  }

  /** Crea el archivo cifrado con una contraseña nueva (primer uso). */
  async create(password: string): Promise<void> {
    const params = newKdfParams();
    const key = await deriveKeyOffThread(password, params);
    const db = await Database.create(() => this.markDirty());
    this.key = key;
    this.params = params;
    this.db = db;
    await this.flush(true);
    void store.requestPersistence();
    this.set({ phase: 'unlocked', lastError: null });
    this.armLock();
  }

  async unlock(password: string): Promise<void> {
    const blob = await store.loadBlob();
    if (!blob) {
      this.set({ phase: 'first-use' });
      return;
    }
    const { params } = readHeader(blob);
    const key = await deriveKeyOffThread(password, params);
    let plain: Uint8Array;
    try {
      ({ plain } = await openContainer(blob, key));
    } catch (e) {
      if (e instanceof WrongPassword) throw e;
      // Archivo principal ilegible: probar la copia previa.
      const prev = await store.loadPrevBlob();
      if (!prev) throw e;
      ({ plain } = await openContainer(prev, key));
    }
    const db = await Database.fromBytes(plain, () => this.markDirty());
    plain.fill(0);
    this.key = key;
    this.params = params;
    this.db = db;
    this.set({ phase: 'unlocked', lastError: null });
    this.armLock();
  }

  /** Guarda, cierra la base y olvida la clave. */
  async lock(): Promise<void> {
    await this.flush(true);
    this.db?.close();
    this.db = null;
    this.key = null;
    this.params = null;
    if (this.lockTimer) window.clearTimeout(this.lockTimer);
    this.set({ phase: 'locked', saveState: 'idle' });
  }

  private markDirty() {
    if (this.state.saveState !== 'dirty') this.set({ saveState: 'dirty' });
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  /** Serializa, cifra y guarda. `force` guarda aunque no haya cambios. */
  async flush(force = false): Promise<void> {
    if (!this.db || !this.key || !this.params) return;
    if (!force && this.state.saveState !== 'dirty') return;
    if (this.saving) await this.saving;
    if (!this.db || !this.key || !this.params) return;
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.set({ saveState: 'saving' });
    this.saving = (async () => {
      try {
        const bytes = this.db!.export();
        const blob = await seal(bytes, this.key!, this.params!, { schema: this.db!.version(), saved_at: Math.floor(Date.now() / 1000) });
        bytes.fill(0);
        await store.saveBlob(blob);
        this.set({ saveState: 'saved', lastError: null });
      } catch (e) {
        this.set({ saveState: 'error', lastError: String(e) });
      }
    })();
    await this.saving;
    this.saving = null;
  }

  /** Bytes del contenedor cifrado tal como está guardado (para descargar la copia). */
  async backupBlob(): Promise<Uint8Array> {
    await this.flush(true);
    const b = await store.loadBlob();
    if (!b) throw new Error('no hay datos');
    return b;
  }

  /** Restaura una copia: comprueba la contraseña y sustituye los datos locales. */
  async restore(blob: Uint8Array, password: string): Promise<void> {
    const { params } = readHeader(blob);
    const key = await deriveKeyOffThread(password, params);
    const { plain } = await openContainer(blob, key); // lanza WrongPassword
    const db = await Database.fromBytes(plain, () => this.markDirty());
    plain.fill(0);
    db.rebuildSearch();
    db.check();
    if (this.db) this.db.close();
    this.db = db;
    this.key = key;
    this.params = params;
    await this.flush(true);
    this.set({ phase: 'unlocked', lastError: null });
    this.armLock();
  }

  async changePassword(current: string, next: string): Promise<void> {
    if (!this.params || !this.db) throw new Error('sesión cerrada');
    // Comprobar la actual rederivando y descifrando lo guardado.
    const blob = await store.loadBlob();
    if (!blob) throw new Error('no hay datos');
    const curKey = await deriveKeyOffThread(current, this.params);
    await openContainer(blob, curKey); // WrongPassword si no coincide
    const params = newKdfParams();
    this.key = await deriveKeyOffThread(next, params);
    this.params = params;
    await this.flush(true);
  }

  async setPrefs(patch: Partial<store.Prefs>): Promise<void> {
    const prefs = { ...this.state.prefs, ...patch };
    await store.savePrefs(prefs);
    applyTheme(prefs.theme);
    this.set({ prefs });
    this.armLock();
  }

  /** Borra todos los datos locales (tras confirmación explícita en la interfaz). */
  async wipe(): Promise<void> {
    this.db?.close();
    this.db = null;
    this.key = null;
    this.params = null;
    await store.wipe();
    this.set({ phase: 'first-use', saveState: 'idle' });
  }

  private touch() {
    this.lastActivity = Date.now();
  }

  /** Bloqueo por inactividad: un temporizador que se reprograma, sin polling. */
  private armLock() {
    if (this.lockTimer) window.clearTimeout(this.lockTimer);
    const minutes = this.state.prefs.lockAfterMinutes;
    if (!minutes || this.state.phase !== 'unlocked') return;
    const check = () => {
      if (this.state.phase !== 'unlocked') return;
      const idle = Date.now() - this.lastActivity;
      const limit = minutes * 60_000;
      if (idle >= limit) void this.lock();
      else this.lockTimer = window.setTimeout(check, limit - idle + 50);
    };
    this.lockTimer = window.setTimeout(check, minutes * 60_000);
  }
}

export function applyTheme(theme: store.Prefs['theme']) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export const session = new Session();
