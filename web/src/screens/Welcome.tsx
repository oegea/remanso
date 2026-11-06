/**
 * Presentación inicial, paso a paso: de dónde viene Remanso, qué no hace, de quién es
 * lo escrito y quién hay detrás. Se muestra en el primer uso y se puede volver a ver
 * desde Ajustes → Acerca de. Termina siempre en el aviso de salud (lo pone quien la usa).
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { WELCOME_STEPS } from '../text/about';

export function Welcome({ onDone, onSkip, doneLabel = 'Siguiente', extraStep }: { onDone: () => void; onSkip?: () => void; doneLabel?: string; extraStep?: { title: string; body: string[] } }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  const steps = extraStep ? [...WELCOME_STEPS, extraStep] : WELCOME_STEPS;
  const step = steps[i];
  const last = i === steps.length - 1;
  const ease = [0.2, 0.8, 0.2, 1] as const;
  return (
    <div className="welcome stack-lg">
      <div className="steps" role="img" aria-label={`Paso ${i + 1} de ${steps.length}`}>
        {steps.map((s, k) => <span key={s.title} className={k <= i ? 'is-on' : ''} />)}
      </div>
      <AnimatePresence mode="wait">
        <motion.section
          key={i}
          className="stack welcome-step"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.32, ease }}
          aria-live="polite"
        >
          <h2 className="t-title">{step.title}</h2>
          {step.body.map((p, k) => (
            <motion.p key={p} className="t-lead t-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.16 + k * 0.16, duration: 0.32 }}>
              {p}
            </motion.p>
          ))}
        </motion.section>
      </AnimatePresence>
      <div className="stack">
        <button className="btn btn-primary btn-block" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? doneLabel : 'Siguiente'}</button>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-text" style={{ visibility: i === 0 ? 'hidden' : 'visible' }} onClick={() => setI(i - 1)}>Atrás</button>
          {onSkip && !last && <button className="btn btn-text" onClick={onSkip}>Saltar la presentación</button>}
        </div>
      </div>
    </div>
  );
}
