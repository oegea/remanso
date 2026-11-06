/** Hoja inferior (móvil) / diálogo centrado (escritorio) con foco atrapado y Escape. */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createPortal } from 'react-dom';

export function Sheet({ open, onClose, title, children, footer, closeLabel = 'Cerrar' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; closeLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // `onClose` suele ser una función nueva en cada render; si el efecto dependiera de ella,
  // cada tecla escrita en la hoja lo relanzaría y devolvería el foco al primer botón.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const body = ref.current?.querySelector<HTMLElement>('.sheet-body, .sheet-foot');
    const first = body?.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]') ?? ref.current?.querySelector<HTMLElement>('input, textarea, button, [tabindex]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && ref.current) {
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>('input, textarea, button, select, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
        if (f.length === 0) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      // Diferido: si la hoja se cerró con Enter, el keypress de esa misma tecla llegaría al
      // botón que la abrió y la reabriría vacía.
      setTimeout(() => prev?.focus?.(), 0);
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} onClick={onClose}>
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            className="sheet"
            initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-head">
              <h2 id="sheet-title" className="t-lead" style={{ fontWeight: 600 }}>{title}</h2>
              <button className="btn btn-text" onClick={onClose}>{closeLabel}</button>
            </div>
            <div className="sheet-body">{children}</div>
            {footer && <div className="sheet-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Confirmación: pregunta, consecuencia, dos botones. Nunca para información. */
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = 'Sí', destructive = false }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: string; confirmLabel?: string; destructive?: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel="Cancelar" footer={
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>No</button>
        <button className={`btn ${destructive ? 'btn-secondary btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    }>
      {body && <p className="t-muted">{body}</p>}
    </Sheet>
  );
}

/** Pedir un texto corto en una hoja. */
export function Prompt({ open, onClose, onSubmit, title, label, initial = '', placeholder, help, multiline = false, submitLabel = 'Aceptar', inputMode }: {
  open: boolean; onClose: () => void; onSubmit: (v: string) => void; title: string; label?: string; initial?: string; placeholder?: string; help?: string; multiline?: boolean; submitLabel?: string; inputMode?: 'text' | 'numeric' | 'decimal';
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const inputId = useId();
  useEffect(() => { if (open && ref.current) { ref.current.value = initial; } }, [open, initial]);
  const submit = () => { onSubmit(ref.current?.value ?? ''); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel="Cancelar" footer={
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={submit}>{submitLabel}</button>
      </div>
    }>
      <div className="field">
        {label && <label htmlFor={inputId}>{label}</label>}
        {multiline ? (
          <textarea id={inputId} ref={ref} className="input t-read prompt-input" rows={4} placeholder={placeholder} defaultValue={initial} aria-label={label ? undefined : title} />
        ) : (
          <input id={inputId} ref={ref} className="input prompt-input" placeholder={placeholder} defaultValue={initial} inputMode={inputMode} aria-label={label ? undefined : title}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        )}
        {help && <span className="help">{help}</span>}
      </div>
    </Sheet>
  );
}

/** Elegir una opción de una lista corta. */
export function Choice({ open, onClose, onPick, title, options, help }: { open: boolean; onClose: () => void; onPick: (i: number) => void; title: string; options: readonly string[]; help?: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel="Cancelar">
      {help && <p className="t-muted" style={{ marginBottom: 12 }}>{help}</p>}
      <div className="list" role="listbox" aria-label={title}>
        {options.map((o, i) => (
          <button key={i} role="option" aria-selected={false} className="list-item" onClick={() => { onPick(i); onClose(); }}>
            <span className="grow">{o}</span>
            <Icon name="forward" className="t-faint" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

import { Icon } from './Icon';
