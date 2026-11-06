/**
 * Cifrado del archivo de datos (web/DESIGN.md §6, docs/security/threat-model.md).
 *
 * Esquema: Argon2id(contraseña, sal) → clave de 256 bits → AES-256-GCM sobre la
 * base de datos SQLite serializada. Todo con primitivas auditadas: Argon2id de
 * hash-wasm (WebAssembly) y AES-GCM de WebCrypto. No hay criptografía propia.
 *
 * Formato del contenedor (igual para el almacenamiento local y las copias):
 *   magic   "RMNS1\n"                      (6 bytes)
 *   hlen    u32 little-endian               (4 bytes)
 *   header  JSON UTF-8 con los parámetros   (hlen bytes)
 *   nonce   12 bytes aleatorios
 *   cipher  AES-256-GCM(datos, aad = header)
 * El header no es secreto (sal y parámetros); la etiqueta GCM lo autentica.
 */
import { argon2id } from 'hash-wasm';

export const MAGIC = new TextEncoder().encode('RMNS1\n');

/** Copia a un ArrayBuffer propio: WebCrypto exige vistas sobre ArrayBuffer, no SharedArrayBuffer. */
function toBuffer(u: Uint8Array): ArrayBuffer {
  return u.slice().buffer as ArrayBuffer;
}

export interface KdfParams {
  version: 1;
  algorithm: 'argon2id';
  /** Sal como texto imprimible; sus bytes UTF-8 son la sal real (24 alfanuméricos). */
  salt: string;
  m_kib: number;
  t: number;
  p: number;
  key_len: 32;
}

/** Mismos valores por defecto que la versión de terminal: 32 MiB, 3 pasadas. */
export const DEFAULT_KDF: Omit<KdfParams, 'salt'> = { version: 1, algorithm: 'argon2id', m_kib: 32 * 1024, t: 3, p: 1, key_len: 32 };

const SALT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomSalt(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) {
    if (out.length === 24) break;
    if (b < 248) out += SALT_ALPHABET[b % 62];
  }
  while (out.length < 24) out += randomSalt().slice(0, 24 - out.length);
  return out;
}

export function newKdfParams(): KdfParams {
  return { ...DEFAULT_KDF, salt: randomSalt() };
}

/** Deriva la clave (bytes). Tarda deliberadamente: en un móvil, 0,5–2 s. */
export async function deriveKeyBytes(password: string, params: KdfParams): Promise<Uint8Array> {
  if (params.algorithm !== 'argon2id' || params.key_len !== 32) throw new Error('parámetros de derivación no soportados');
  return argon2id({
    password,
    salt: new TextEncoder().encode(params.salt),
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m_kib,
    hashLength: 32,
    outputType: 'binary',
  });
}

/** Importa la clave en WebCrypto como no extraíble: no se puede volver a leer desde JS. */
export async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey('raw', toBuffer(raw), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  raw.fill(0);
  return key;
}

export async function deriveKey(password: string, params: KdfParams): Promise<CryptoKey> {
  return importKey(await deriveKeyBytes(password, params));
}

export interface Container {
  params: KdfParams;
  /** Metadatos no secretos adicionales (versión de esquema, fecha). */
  meta: Record<string, string | number>;
}

export async function seal(plain: Uint8Array, key: CryptoKey, params: KdfParams, meta: Record<string, string | number> = {}): Promise<Uint8Array> {
  const header = new TextEncoder().encode(JSON.stringify({ kdf: params, meta }));
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: header, tagLength: 128 }, key, toBuffer(plain)),
  );
  const out = new Uint8Array(MAGIC.length + 4 + header.length + nonce.length + cipher.length);
  let o = 0;
  out.set(MAGIC, o); o += MAGIC.length;
  new DataView(out.buffer).setUint32(o, header.length, true); o += 4;
  out.set(header, o); o += header.length;
  out.set(nonce, o); o += nonce.length;
  out.set(cipher, o);
  return out;
}

/** Lee sólo la cabecera (no necesita la clave): para derivar antes de descifrar. */
export function readHeader(blob: Uint8Array): Container & { nonce: Uint8Array; cipher: Uint8Array } {
  for (let i = 0; i < MAGIC.length; i++) if (blob[i] !== MAGIC[i]) throw new Error('no es un archivo de Remanso');
  let o = MAGIC.length;
  const hlen = new DataView(blob.buffer, blob.byteOffset).getUint32(o, true); o += 4;
  if (hlen > 64 * 1024 || o + hlen + 12 > blob.length) throw new Error('archivo dañado');
  const header = JSON.parse(new TextDecoder().decode(blob.subarray(o, o + hlen))) as { kdf: KdfParams; meta: Record<string, string | number> };
  o += hlen;
  const nonce = blob.subarray(o, o + 12); o += 12;
  const cipher = blob.subarray(o);
  if (!header.kdf || header.kdf.algorithm !== 'argon2id') throw new Error('parámetros de derivación no soportados');
  return { params: header.kdf, meta: header.meta ?? {}, nonce, cipher };
}

export class WrongPassword extends Error {
  constructor() { super('contraseña incorrecta'); }
}

export async function open(blob: Uint8Array, key: CryptoKey): Promise<{ plain: Uint8Array; container: Container }> {
  const { params, meta, nonce, cipher } = readHeader(blob);
  const hlen = new DataView(blob.buffer, blob.byteOffset).getUint32(MAGIC.length, true);
  const header = blob.subarray(MAGIC.length + 4, MAGIC.length + 4 + hlen);
  try {
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toBuffer(nonce), additionalData: toBuffer(header), tagLength: 128 }, key, toBuffer(cipher)),
    );
    return { plain, container: { params, meta } };
  } catch {
    // Con clave errónea GCM falla la autenticación: no hay más información que dar.
    throw new WrongPassword();
  }
}
