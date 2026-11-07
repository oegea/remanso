import { describe, it, expect, vi, afterEach } from 'vitest';
import { b64u, unb64u, unwrap, wrap, enroll, unlock, available, isEnrollment, BiometricCancelled, BiometricUnavailable, type Enrollment } from './biometric';

const rnd = (n: number) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; };
const zeroed = (b: Uint8Array) => b.every((x) => x === 0);

describe('atajo biométrico: envoltura de la clave', () => {
  it('envuelve y desenvuelve con el mismo secreto; borra el secreto y la clave en claro', async () => {
    const secret = rnd(32), raw = rnd(32);
    const rawCopy = raw.slice();
    const e = await wrap(secret, raw, 'cred-1', b64u(rnd(32)));
    expect(zeroed(raw), 'la clave en claro se borra').toBe(true);
    expect(zeroed(secret), 'el secreto se borra').toBe(true);
    expect(isEnrollment(e)).toBe(true);
    expect(e.wrapped).not.toContain(b64u(rawCopy));
    expect(unb64u(e.wrapped).length).toBe(32 + 16);
  });

  it('desenvuelve con el mismo secreto y borra el secreto también al fallar', async () => {
    const secret = rnd(32), raw = rnd(32), rawCopy = raw.slice();
    const e = await wrap(secret.slice(), raw, 'cred-1', b64u(rnd(32)));
    const s1 = secret.slice();
    const back = await unwrap(s1, e);
    expect(Array.from(back)).toEqual(Array.from(rawCopy));
    expect(zeroed(s1)).toBe(true);
    const s2 = secret.slice();
    await expect(unwrap(s2, { ...e, hkdfSalt: 'no-es-base64url!' })).rejects.toThrow();
    expect(zeroed(s2), 'se borra aunque el registro esté corrupto').toBe(true);
  });

  it('otro secreto, otra credencial, otra sal, otro IV o un byte cambiado no abren nada', async () => {
    const secret = rnd(32);
    const e = await wrap(secret.slice(), rnd(32), 'cred-1', b64u(rnd(32)));
    await expect(unwrap(rnd(32), e)).rejects.toThrow();
    await expect(unwrap(secret.slice(), { ...e, credId: 'cred-2' })).rejects.toThrow();
    await expect(unwrap(secret.slice(), { ...e, hkdfSalt: b64u(rnd(32)) })).rejects.toThrow();
    await expect(unwrap(secret.slice(), { ...e, iv: b64u(rnd(12)) })).rejects.toThrow();
    const bad = unb64u(e.wrapped); bad[5] ^= 1;
    await expect(unwrap(secret.slice(), { ...e, wrapped: b64u(bad) })).rejects.toThrow();
    await expect(unwrap(secret.slice(), { ...e, v: 2 as unknown as Enrollment['v'] })).rejects.toThrow(/inválido/);
  });

  it('exige una clave de 32 bytes y borra lo que recibe aunque falle', async () => {
    const secret = rnd(32), raw = rnd(31);
    await expect(wrap(secret, raw, 'c', 'x')).rejects.toThrow(/32 bytes/);
    expect(zeroed(secret) && zeroed(raw)).toBe(true);
  });

  it('cada alta usa sales e IV nuevos', async () => {
    const secret = rnd(32), raw = rnd(32);
    const a = await wrap(secret.slice(), raw.slice(), 'c', 'p');
    const b = await wrap(secret.slice(), raw.slice(), 'c', 'p');
    expect(a.hkdfSalt).not.toBe(b.hkdfSalt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.wrapped).not.toBe(b.wrapped);
  });

  it('base64url va y vuelve; el registro se valida por forma', () => {
    for (const n of [0, 1, 2, 3, 31, 32, 48]) { const x = rnd(n); expect(Array.from(unb64u(b64u(x)))).toEqual(Array.from(x)); }
    expect(b64u(new Uint8Array([251, 255]))).not.toMatch(/[+/=]/);
    expect(isEnrollment(null)).toBe(false);
    expect(isEnrollment({ v: 1, credId: 'a', prfSalt: 'b', hkdfSalt: 'c', iv: 'd', wrapped: 'e', created_at: 1 })).toBe(true);
    expect(isEnrollment({ v: 1, credId: 'a+b', prfSalt: 'b', hkdfSalt: 'c', iv: 'd', wrapped: 'e', created_at: 1 })).toBe(false);
    expect(isEnrollment({ v: 1, credId: 'a', prfSalt: 'b', hkdfSalt: 'c', iv: 'd', wrapped: 'e' })).toBe(false);
  });
});

/** WebAuthn simulado: un «autenticador» que devuelve un secreto PRF fijo por credencial. */
function fakeWebAuthn(opts: { prfOnCreate?: boolean; prfEnabled?: boolean; cancel?: boolean; caps?: Record<string, boolean> | null; uvpa?: boolean } = {}) {
  const { prfOnCreate = false, prfEnabled = true, cancel = false, caps = { 'extension:prf': true }, uvpa = true } = opts;
  const secret = rnd(32);
  const credId = rnd(16);
  const calls = { create: 0, get: 0 };
  const cred = (withResults: boolean) => ({
    rawId: credId.slice().buffer,
    getClientExtensionResults: () => ({ prf: { enabled: prfEnabled, results: withResults ? { first: secret.slice().buffer } : undefined } }),
  });
  const dom = (name: string) => { const e = new Error(name) as Error & { name: string }; e.name = name; Object.setPrototypeOf(e, DOMException.prototype); return e; };
  const PKC = Object.assign(function PublicKeyCredential() {}, {
    isUserVerifyingPlatformAuthenticatorAvailable: async () => uvpa,
    ...(caps ? { getClientCapabilities: async () => caps } : {}),
  });
  vi.stubGlobal('window', { isSecureContext: true, PublicKeyCredential: PKC });
  vi.stubGlobal('location', { hostname: 'localhost' });
  vi.stubGlobal('navigator', {
    userAgent: 'test',
    credentials: {
      create: async () => { calls.create++; if (cancel) throw dom('NotAllowedError'); return cred(prfOnCreate); },
      get: async (o: { publicKey: { allowCredentials: { id: ArrayBuffer }[] } }) => {
        calls.get++;
        if (cancel) throw dom('NotAllowedError');
        const asked = new Uint8Array(o.publicKey.allowCredentials[0].id);
        if (asked.length !== credId.length || !asked.every((b, i) => b === credId[i])) throw dom('NotAllowedError');
        return cred(true);
      },
    },
  });
  return { secret, credId, calls };
}

describe('atajo biométrico: WebAuthn simulado', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('da de alta y abre; el secreto sale sólo del autenticador y la clave vuelve intacta', async () => {
    const f = fakeWebAuthn();
    const raw = rnd(32), rawCopy = raw.slice();
    const e = await enroll(raw, rnd(16));
    expect(zeroed(raw)).toBe(true);
    expect(f.calls, 'sin resultado al crear, se pide el secreto con get').toEqual({ create: 1, get: 1 });
    expect(unb64u(e.credId)).toEqual(f.credId);
    const back = await unlock(e);
    expect(Array.from(back)).toEqual(Array.from(rawCopy));
  });

  it('si el autenticador devuelve el secreto al crear, no hace falta el segundo paso', async () => {
    const f = fakeWebAuthn({ prfOnCreate: true });
    await enroll(rnd(32), rnd(16));
    expect(f.calls).toEqual({ create: 1, get: 0 });
  });

  it('cancelar o no admitir PRF se distinguen, y borran la clave en claro', async () => {
    fakeWebAuthn({ cancel: true });
    const raw = rnd(32);
    await expect(enroll(raw, rnd(16))).rejects.toBeInstanceOf(BiometricCancelled);
    expect(zeroed(raw)).toBe(true);
    fakeWebAuthn({ prfEnabled: false });
    await expect(enroll(rnd(32), rnd(16))).rejects.toBeInstanceOf(BiometricUnavailable);
  });

  it('disponibilidad: sí con PRF declarado, quizá sin declaración, no sin autenticador o con PRF negado', async () => {
    fakeWebAuthn(); expect(await available()).toBe('yes');
    fakeWebAuthn({ caps: null }); expect(await available()).toBe('maybe');
    fakeWebAuthn({ caps: { 'extension:prf': false } }); expect(await available()).toBe('no');
    fakeWebAuthn({ caps: {} }); expect(await available()).toBe('no');
    fakeWebAuthn({ uvpa: false }); expect(await available()).toBe('no');
  });

  it('un registro de otra credencial no abre', async () => {
    fakeWebAuthn();
    const e = await enroll(rnd(32), rnd(16));
    await expect(unlock({ ...e, credId: b64u(rnd(16)) })).rejects.toThrow();
  });
});
