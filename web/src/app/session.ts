/**
 * Sesión: estado de bloqueo, clave en memoria (CryptoKey no extraíble), base de
 * datos en memoria y guardado cifrado con retardo. Un único almacén observable
 * para toda la interfaz (sin librerías de estado).
 */
import { Database } from '../db/sqlite';
import * as store from '../db/store';
import { deriveKeyOffThread, deriveRawOffThread } from '../crypto/kdf';
import * as bio from '../crypto/biometric';
import { clearFailures, lockedUntil, noteFailure, TooManyTries } from './lockout';
import { importKey, newKdfParams, open as openContainer, readHeader, seal, WrongPassword, type KdfParams } from '../crypto/container';

export type Phase = 'loading' | 'first-use' | 'locked' | 'unlocked';

export interface SessionState {
  phase: Phase;
  prefs: store.Prefs;
  /** Pendiente de guardar / guardando / guardado. */
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  lastError: string | null;
  /** Hay un atajo biométrico dado de alta en este dispositivo. */
  biometric: boolean;
  /** Por qué está bloqueada: al abrir, por inactividad o porque la persona lo pidió (entonces el atajo no se dispara solo). */
  lockReason: 'start' | 'idle' | 'manual';
}

/** El atajo biométrico ya no abre los datos (la contraseña cambió desde otro sitio): se ha borrado. */
export class BiometricStale extends Error {
  constructor() { super('el atajo biométrico ya no sirve'); this.name = 'BiometricStale'; }
}

type Listener = () => void;

const SAVE_DELAY_MS = 1500;
/** Marca «no volver a ofrecer el atajo» (localStorage; se borra al darlo de alta). */
const BIO_DECLINED = 'remanso.biometria.rechazada';

class Session {
  state: SessionState = { phase: 'loading', prefs: store.DEFAULT_PREFS, saveState: 'idle', lastError: null, biometric: false, lockReason: 'start' };
  db: Database | null = null;
  private key: CryptoKey | null = null;
  private params: KdfParams | null = null;
  private listeners = new Set<Listener>();
  private saveTimer: number | null = null;
  private lockTimer: number | null = null;
  private lastActivity = Date.now();
  private saving: Promise<void> | null = null;
  /** Clave en claro retenida sólo entre un desbloqueo con contraseña y la decisión de dar de alta el atajo. */
  private heldRaw: Uint8Array | null = null;

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
    const biometric = (await store.loadBiometric()) !== null;
    this.set({ prefs, phase: has ? 'locked' : 'first-use', biometric });
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

  /**
   * Desbloquea con la contraseña. Con `hold`, deja todo listo pero no entra todavía y
   * retiene la clave en claro para poder dar de alta el atajo biométrico sin volver a
   * derivarla; `enter()` o `dropHeld()` la borran.
   */
  async unlock(password: string, opts: { hold?: boolean } = {}): Promise<void> {
    const blob = await store.loadBlob();
    if (!blob) {
      this.set({ phase: 'first-use' });
      return;
    }
    const until = lockedUntil();
    if (until) throw new TooManyTries(until);
    const { params } = readHeader(blob);
    const raw = await deriveRawOffThread(password, params);
    const key = await importKey(raw.slice());
    try {
      await this.openWith(blob, key, params);
    } catch (e) {
      raw.fill(0);
      if (e instanceof WrongPassword) noteFailure();
      throw e;
    }
    clearFailures();
    if (opts.hold) this.heldRaw = raw;
    else { raw.fill(0); this.enter(); }
  }

  /** Abre el contenedor (o su copia previa) con una clave ya importada y deja la base en memoria. */
  private async openWith(blob: Uint8Array, key: CryptoKey, params: KdfParams): Promise<void> {
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
    this.db?.close();
    this.key = key;
    this.params = params;
    this.db = db;
  }

  /** Entra de verdad (tras un desbloqueo retenido). */
  enter(): void {
    this.dropHeld();
    if (!this.db) return;
    this.set({ phase: 'unlocked', lastError: null });
    this.armLock();
  }

  dropHeld(): void {
    this.heldRaw?.fill(0);
    this.heldRaw = null;
  }

  /** Si tiene sentido ofrecer el atajo tras entrar con contraseña: disponible, sin alta y no rechazado antes. */
  async shouldOfferBiometric(): Promise<boolean> {
    if (this.state.biometric) return false;
    try { if (localStorage.getItem(BIO_DECLINED) === '1') return false; } catch { /* sin almacenamiento */ }
    return (await bio.available()) === 'yes';
  }
  declineBiometric(): void {
    try { localStorage.setItem(BIO_DECLINED, '1'); } catch { /* sin almacenamiento */ }
  }

  /**
   * Comprueba la contraseña con la sesión abierta (Ajustes) y retiene la clave en claro
   * para el siguiente paso (`enrollBiometric` o `rewrapBiometric`). Así la llamada WebAuthn
   * puede hacerse desde un toque de la persona, sin la espera de Argon2 por medio.
   */
  async holdPassword(password: string): Promise<void> {
    if (!this.params) throw new Error('sesión cerrada');
    const blob = await store.loadBlob();
    if (!blob) throw new Error('no hay datos');
    const raw = await deriveRawOffThread(password, this.params);
    try { await openContainer(blob, await importKey(raw.slice())); } // WrongPassword si no coincide
    catch (e) { raw.fill(0); throw e; }
    this.dropHeld();
    this.heldRaw = raw;
  }

  /**
   * Da de alta el atajo con la clave retenida (de un desbloqueo reciente o de
   * `holdPassword`). La clave retenida sólo se suelta si el alta termina bien, para que
   * se pueda reintentar tras una cancelación.
   */
  async enrollBiometric(): Promise<void> {
    if (!this.heldRaw) throw new Error('hace falta la contraseña');
    const e = await bio.enroll(this.heldRaw.slice(), await store.biometricUserId()); // borra la copia siempre
    await store.saveBiometric(e);
    this.dropHeld();
    try { localStorage.removeItem(BIO_DECLINED); } catch { /* sin almacenamiento */ }
    this.set({ biometric: true });
  }

  /** Tras cambiar la contraseña: vuelve a envolver con la misma passkey (una verificación). */
  async rewrapBiometric(): Promise<void> {
    const e = await store.loadBiometric();
    if (!this.heldRaw || !e) { this.dropHeld(); await this.disableBiometric(); throw new BiometricStale(); }
    const next = await bio.rewrap(e, this.heldRaw.slice());
    await store.saveBiometric(next);
    this.dropHeld();
  }

  async disableBiometric(byUser = false): Promise<void> {
    await store.clearBiometric();
    if (byUser) this.declineBiometric();
    this.set({ biometric: false });
  }

  /** Desbloquea con el atajo biométrico: sin Argon2, sólo el autenticador y AES-GCM. */
  async unlockWithBiometric(signal?: AbortSignal): Promise<void> {
    const e = await store.loadBiometric();
    const blob = await store.loadBlob();
    if (!e || !blob) { await this.disableBiometric(); throw new BiometricStale(); }
    let raw: Uint8Array;
    try {
      raw = await bio.unlock(e, signal);
    } catch (err) {
      // Cancelar o no poder no dicen nada del registro; cualquier otro fallo (no desenvuelve,
      // registro alterado) significa que el atajo ya no sirve: se descarta y se pide la contraseña.
      if (err instanceof bio.BiometricCancelled || err instanceof bio.BiometricUnavailable) throw err;
      await this.disableBiometric();
      throw new BiometricStale();
    }
    if (this.state.phase === 'unlocked') { raw.fill(0); return; } // la contraseña llegó antes
    const key = await importKey(raw); // borra raw
    const { params } = readHeader(blob);
    try {
      await this.openWith(blob, key, params);
    } catch (err) {
      if (err instanceof WrongPassword) { await this.disableBiometric(); throw new BiometricStale(); }
      throw err;
    }
    clearFailures();
    this.enter();
  }

  /** Guarda, cierra la base y olvida la clave. */
  async lock(reason: 'idle' | 'manual' = 'manual'): Promise<void> {
    this.dropHeld();
    await this.flush(true);
    this.db?.close();
    this.db = null;
    this.key = null;
    this.params = null;
    if (this.lockTimer) window.clearTimeout(this.lockTimer);
    this.set({ phase: 'locked', saveState: 'idle', lockReason: reason });
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
    // El atajo biométrico envolvía la clave de los datos anteriores: ya no sirve.
    if (this.state.biometric) await this.disableBiometric();
    this.set({ phase: 'unlocked', lastError: null });
    this.armLock();
  }

  async changePassword(current: string, next: string): Promise<'ok' | 'rewrap'> {
    if (!this.params || !this.db) throw new Error('sesión cerrada');
    // Comprobar la actual rederivando y descifrando lo guardado.
    const blob = await store.loadBlob();
    if (!blob) throw new Error('no hay datos');
    const curKey = await deriveKeyOffThread(current, this.params);
    await openContainer(blob, curKey); // WrongPassword si no coincide
    const params = newKdfParams();
    const raw = await deriveRawOffThread(next, params);
    this.key = await importKey(raw.slice());
    this.params = params;
    await this.flush(true);
    // El atajo biométrico envolvía la clave antigua. Se retiene la nueva para que la interfaz
    // vuelva a vincular desde un toque (`rewrapBiometric`) o quite el atajo (`disableBiometric`).
    if (this.state.biometric) { this.dropHeld(); this.heldRaw = raw; return 'rewrap'; }
    raw.fill(0);
    return 'ok';
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
    this.dropHeld();
    this.db?.close();
    this.db = null;
    this.key = null;
    this.params = null;
    await store.wipe();
    try { localStorage.removeItem(BIO_DECLINED); } catch { /* sin almacenamiento */ }
    clearFailures();
    this.set({ phase: 'first-use', saveState: 'idle', biometric: false });
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
      if (idle >= limit) void this.lock('idle');
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
