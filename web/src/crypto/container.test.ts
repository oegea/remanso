import { describe, it, expect } from 'vitest';
import { deriveKey, newKdfParams, open, readHeader, seal, WrongPassword } from './container';

const cheap = () => ({ ...newKdfParams(), m_kib: 1024, t: 1 });

describe('contenedor cifrado', () => {
  it('cifra y descifra; la clave errónea no revela nada', async () => {
    const params = cheap();
    const key = await deriveKey('correcta', params);
    const data = new TextEncoder().encode('frase íntima que no debe verse');
    const blob = await seal(data, key, params, { schema: 5 });
    expect(new TextDecoder().decode(blob)).not.toContain('íntima');
    const h = readHeader(blob);
    expect(h.params.salt).toBe(params.salt);
    expect(h.meta.schema).toBe(5);
    const { plain } = await open(blob, key);
    expect(new TextDecoder().decode(plain)).toBe('frase íntima que no debe verse');
    const bad = await deriveKey('incorrecta', params);
    await expect(open(blob, bad)).rejects.toBeInstanceOf(WrongPassword);
  });

  it('la cabecera es autenticada: modificarla invalida el archivo', async () => {
    const params = cheap();
    const key = await deriveKey('x', params);
    const blob = await seal(new Uint8Array([1, 2, 3]), key, params);
    const tampered = blob.slice();
    // Cambiamos un carácter de la sal dentro del JSON (sigue siendo JSON válido).
    const txt = new TextDecoder().decode(tampered);
    const i = txt.indexOf(params.salt) + 3;
    tampered[i] = tampered[i] === 0x41 ? 0x42 : 0x41;
    await expect(open(tampered, key)).rejects.toBeInstanceOf(WrongPassword);
  });

  it('rechaza archivos que no son de Remanso', () => {
    expect(() => readHeader(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toThrow(/no es un archivo/);
  });

  it('la sal es imprimible y de 24 caracteres', () => {
    const p = newKdfParams();
    expect(p.salt).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(p.m_kib).toBe(32768);
  });
});
