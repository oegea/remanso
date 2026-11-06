/** Región aria-live para anunciar guardados y confirmaciones breves. Los avisos de
 * derivación o cualquier texto que haya que leer con calma van en hojas o avisos en
 * línea (`.notice`), nunca aquí. */
import { useEffect, useState } from 'react';

type Listener = (msg: string) => void;
const listeners = new Set<Listener>();
export function announce(msg: string) {
  for (const l of listeners) l(msg);
}

export function LiveRegion() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const l: Listener = (m) => {
      setMsg('');
      requestAnimationFrame(() => setMsg(m));
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  useEffect(() => {
    if (!msg) return;
    // Tiempo proporcional a la longitud: nadie debe quedarse a medias leyendo un aviso.
    const t = setTimeout(() => setMsg(''), Math.min(9000, 3000 + msg.length * 45));
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{msg}</div>
      <div className={`toast ${msg ? 'is-on' : ''}`} aria-hidden="true">{msg}</div>
    </>
  );
}
