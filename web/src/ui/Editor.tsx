/**
 * Editor de texto para diario y notas: textarea serif que crece con el
 * contenido, contador de palabras, autoguardado a los 2 s y al perder el foco.
 * Pensado para teclado móvil: la barra superior se queda fija y el área crece.
 */
import { useCallback, useEffect, useRef } from 'react';
import { wordCount } from '../domain/diary';

export function useAutosave(save: (text: string) => void, delay = 2000) {
  const timer = useRef<number | null>(null);
  const pending = useRef<string | null>(null);
  const flush = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (pending.current !== null) { const t = pending.current; pending.current = null; save(t); }
  }, [save]);
  const schedule = useCallback((text: string) => {
    pending.current = text;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, delay);
  }, [flush, delay]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); flush(); };
  }, [flush]);
  return { schedule, flush };
}

export function TextEditor({ value, onChange, placeholder, autoFocus, readOnly, minHeight = 200 }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; readOnly?: boolean; minHeight?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Altura automática: el área crece con el texto (sin barra de scroll interna).
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [minHeight]);
  useEffect(() => { resize(); }, [value, resize]);
  useEffect(() => {
    if (autoFocus && ref.current) {
      const el = ref.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [autoFocus]);
  return (
    <textarea
      ref={ref}
      className="editor-text"
      style={{ minHeight }}
      value={value}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      spellCheck
      autoCapitalize="sentences"
      aria-label="Texto"
    />
  );
}

export function WordCount({ text }: { text: string }) {
  const n = wordCount(text);
  return <span className="num">{n} {n === 1 ? 'palabra' : 'palabras'}</span>;
}

/** Vista de lectura con Markdown ligero: #, -, >, **negrita**, _cursiva_. */
export function ReadView({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="t-read read-view">
      {lines.map((l, i) => {
        const t = l.trimStart();
        if (t.startsWith('# ')) return <h2 key={i} className="read-h">{t.slice(2)}</h2>;
        if (t.startsWith('## ')) return <h3 key={i} className="read-h">{t.slice(3)}</h3>;
        if (t.startsWith('> ')) return <blockquote key={i} className="read-q">{inline(t.slice(2))}</blockquote>;
        if (/^[-*] /.test(t)) return <div key={i} className="read-li">· {inline(t.slice(2))}</div>;
        if (t === '') return <div key={i} style={{ height: '0.8em' }} />;
        return <p key={i}>{inline(l)}</p>;
      })}
    </div>
  );
}

function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('_') && p.endsWith('_') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}
