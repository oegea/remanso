/**
 * Atajo biométrico: entrar con Face ID, Touch ID, huella o cara sin escribir la contraseña.
 *
 * Cómo funciona. WebAuthn por sí solo no da ningún secreto, sólo una firma; en una
 * aplicación sin servidor eso no sirve para descifrar nada. Se usa la extensión PRF: el
 * autenticador de plataforma deriva un secreto de 32 bytes que sólo entrega tras verificar
 * a la persona (biometría o PIN del sistema) y que nunca se guarda. Con ese secreto, por
 * HKDF, se obtiene una clave AES-256-GCM que envuelve la clave del contenedor. En disco
 * queda sólo la clave envuelta y metadatos públicos (id de la credencial, sales, IV).
 *
 * Qué NO hace. No guarda la contraseña ni nada derivado de ella; no cambia el formato del
 * contenedor; no verifica la firma de la aserción (no hay servidor y la seguridad no
 * depende de ella sino del secreto PRF). La contraseña sigue siendo la única manera de
 * abrir los datos en otro dispositivo o tras restaurar una copia.
 *
 * Una sola passkey por instalación: `user.id` es fijo (se genera una vez y se guarda), así
 * el sistema sustituye la anterior en vez de acumular llaves huérfanas en el llavero. Al
 * cambiar la contraseña se vuelve a envolver con la misma credencial (`rewrap`).
 */

export const BIOMETRIC_VERSION = 1;
const HKDF_INFO = new TextEncoder().encode('remanso/biometric-wrap/v1');

/** Lo que se guarda en el dispositivo. Nada de aquí abre los datos sin el autenticador. */
export interface Enrollment {
  v: typeof BIOMETRIC_VERSION;
  /** Id de la credencial WebAuthn (base64url). */
  credId: string;
  /** Entrada de la PRF (base64url, 32 bytes aleatorios). */
  prfSalt: string;
  /** Sal del HKDF (base64url, 32 bytes aleatorios). */
  hkdfSalt: string;
  /** IV de AES-GCM (base64url, 12 bytes aleatorios). */
  iv: string;
  /** Clave del contenedor envuelta (base64url, 32 + 16 bytes). */
  wrapped: string;
  created_at: number;
}

/** Comprueba la forma de un registro leído del disco (puede estar corrupto o ser de otra versión). */
export function isEnrollment(x: unknown): x is Enrollment {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  const b64 = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]+$/.test(v);
  return e.v === BIOMETRIC_VERSION && b64(e.credId) && b64(e.prfSalt) && b64(e.hkdfSalt) && b64(e.iv) && b64(e.wrapped) && typeof e.created_at === 'number';
}

export class BiometricUnavailable extends Error {
  constructor(msg = 'biometría no disponible') { super(msg); this.name = 'BiometricUnavailable'; }
}
/** La persona canceló o el navegador no permitió el intento (sin gesto previo, por ejemplo). */
export class BiometricCancelled extends Error {
  constructor(msg = 'intento cancelado') { super(msg); this.name = 'BiometricCancelled'; }
}

// ---- utilidades ------------------------------------------------------------------------

export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function random(n: number): Uint8Array { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
function buf(u: Uint8Array): ArrayBuffer { return u.slice().buffer as ArrayBuffer; }

/** Datos asociados: atan la envoltura a la credencial y a la versión. */
function aad(credId: string): Uint8Array {
  return new TextEncoder().encode(`remanso-biometric:${BIOMETRIC_VERSION}:${credId}`);
}

/** Clave AES-GCM no extraíble derivada del secreto PRF. El secreto se borra al salir, pase lo que pase. */
async function wrapKeyFrom(secret: Uint8Array, hkdfSalt: Uint8Array): Promise<CryptoKey> {
  try {
    const ikm = await crypto.subtle.importKey('raw', buf(secret), 'HKDF', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: buf(hkdfSalt), info: buf(HKDF_INFO) },
      ikm,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    secret.fill(0);
  }
}

/**
 * Envuelve la clave del contenedor con el secreto PRF. Función pura (sin WebAuthn) para
 * poder probarla. `secret` y `raw` se borran siempre al terminar.
 */
export async function wrap(secret: Uint8Array, raw: Uint8Array, credId: string, prfSalt: string): Promise<Enrollment> {
  try {
    if (raw.length !== 32) throw new Error('clave de 32 bytes esperada');
    const hkdfSalt = random(32);
    const iv = random(12);
    const key = await wrapKeyFrom(secret, hkdfSalt);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad(credId)), tagLength: 128 }, key, buf(raw)));
    return { v: BIOMETRIC_VERSION, credId, prfSalt, hkdfSalt: b64u(hkdfSalt), iv: b64u(iv), wrapped: b64u(ct), created_at: Math.floor(Date.now() / 1000) };
  } finally {
    secret.fill(0);
    raw.fill(0);
  }
}

/** Desenvuelve la clave del contenedor. Lanza si el secreto no es el que envolvió. `secret` se borra siempre. */
export async function unwrap(secret: Uint8Array, e: Enrollment): Promise<Uint8Array> {
  try {
    if (!isEnrollment(e)) throw new Error('registro de atajo inválido');
    const hkdfSalt = unb64u(e.hkdfSalt), iv = unb64u(e.iv), wrapped = unb64u(e.wrapped), extra = aad(e.credId);
    const key = await wrapKeyFrom(secret, hkdfSalt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(iv), additionalData: buf(extra), tagLength: 128 }, key, buf(wrapped));
    const raw = new Uint8Array(plain);
    if (raw.length !== 32) { raw.fill(0); throw new Error('clave envuelta inválida'); }
    return raw;
  } finally {
    secret.fill(0);
  }
}

// ---- WebAuthn ---------------------------------------------------------------------------

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer | Uint8Array } } };

const RP_NAME = 'Remanso';
function rpId(): string { return location.hostname; }

/** Nombre del método según el dispositivo, para los textos de la interfaz. */
export function methodName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|Macintosh/.test(ua)) return 'Face ID o Touch ID';
  return 'huella o cara';
}

/**
 * Si este navegador puede ofrecer el atajo.
 * - 'yes': contexto seguro, autenticador de plataforma con verificación y PRF declarado
 *   por el navegador (`getClientCapabilities`). Se ofrece solo al entrar.
 * - 'maybe': lo mismo pero el navegador no sabe declarar PRF (versiones anteriores). No se
 *   ofrece solo; desde Ajustes se puede intentar, y se comprueba al crear la credencial.
 * - 'no': no se ofrece en ningún sitio.
 */
export type Availability = 'yes' | 'maybe' | 'no';
export async function available(): Promise<Availability> {
  if (typeof window === 'undefined' || !window.isSecureContext || !('PublicKeyCredential' in window)) return 'no';
  const PKC = window.PublicKeyCredential as typeof PublicKeyCredential & { getClientCapabilities?: () => Promise<Record<string, boolean>> };
  try {
    if (!(await PKC.isUserVerifyingPlatformAuthenticatorAvailable())) return 'no';
    if (typeof PKC.getClientCapabilities !== 'function') return 'maybe';
    const caps = await PKC.getClientCapabilities();
    return caps['extension:prf'] === true ? 'yes' : 'no';
  } catch {
    return 'no';
  }
}

function isCancel(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError');
}
function secretOf(x: ArrayBuffer | Uint8Array): Uint8Array {
  const s = new Uint8Array(x instanceof ArrayBuffer ? x : buf(x));
  if (s.length < 32) { s.fill(0); throw new BiometricUnavailable('secreto demasiado corto'); }
  return s;
}

/** Pide al autenticador el secreto PRF de una credencial. */
async function prfSecret(credId: Uint8Array, prfSalt: Uint8Array, signal?: AbortSignal): Promise<Uint8Array> {
  let cred: Credential | null;
  try {
    cred = await navigator.credentials.get({
      signal,
      publicKey: {
        challenge: buf(random(32)),
        rpId: rpId(),
        allowCredentials: [{ id: buf(credId), type: 'public-key', transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: buf(prfSalt) } } } as AuthenticationExtensionsClientInputs,
      },
    });
  } catch (e) {
    if (isCancel(e)) throw new BiometricCancelled();
    throw e;
  }
  if (!cred) throw new BiometricCancelled();
  const first = ((cred as PublicKeyCredential).getClientExtensionResults() as PrfResults).prf?.results?.first;
  if (!first) throw new BiometricUnavailable('el autenticador no devolvió el secreto');
  return secretOf(first);
}

/**
 * Da de alta el atajo: crea (o sustituye, por el `userId` fijo) la passkey de plataforma
 * con PRF, pide el secreto y envuelve con él la clave del contenedor. `raw` se borra siempre.
 */
export async function enroll(raw: Uint8Array, userId: Uint8Array): Promise<Enrollment> {
  try {
    if ((await available()) === 'no') throw new BiometricUnavailable();
    const prfSalt = random(32);
    let cred: Credential | null;
    try {
      cred = await navigator.credentials.create({
        publicKey: {
          rp: { name: RP_NAME, id: rpId() },
          // Sin datos personales: un identificador aleatorio fijo por instalación y un nombre fijo.
          user: { id: buf(userId), name: 'remanso', displayName: 'Remanso' },
          challenge: buf(random(32)),
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
          attestation: 'none',
          timeout: 60_000,
          extensions: { prf: { eval: { first: buf(prfSalt) } } } as AuthenticationExtensionsClientInputs,
        },
      });
    } catch (e) {
      if (isCancel(e)) throw new BiometricCancelled();
      throw e;
    }
    if (!cred) throw new BiometricCancelled();
    const pk = cred as PublicKeyCredential;
    const ext = pk.getClientExtensionResults() as PrfResults;
    if (!ext.prf?.enabled) throw new BiometricUnavailable('este autenticador no admite PRF');
    const credId = new Uint8Array(pk.rawId);
    // Algunos autenticadores ya devuelven el secreto al crear; otros sólo al autenticar.
    const fromCreate = ext.prf.results?.first;
    const secret = fromCreate ? secretOf(fromCreate) : await prfSecret(credId, prfSalt);
    return await wrap(secret, raw, b64u(credId), b64u(prfSalt));
  } finally {
    raw.fill(0);
  }
}

/** Vuelve a envolver con la misma credencial (tras cambiar la contraseña): una sola verificación, ninguna passkey nueva. */
export async function rewrap(e: Enrollment, raw: Uint8Array): Promise<Enrollment> {
  try {
    const secret = await prfSecret(unb64u(e.credId), unb64u(e.prfSalt));
    return await wrap(secret, raw, e.credId, e.prfSalt);
  } finally {
    raw.fill(0);
  }
}

/** Pide la verificación y devuelve la clave del contenedor (32 bytes) para importarla. */
export async function unlock(e: Enrollment, signal?: AbortSignal): Promise<Uint8Array> {
  const secret = await prfSecret(unb64u(e.credId), unb64u(e.prfSalt), signal);
  return unwrap(secret, e);
}
