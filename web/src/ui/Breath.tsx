/**
 * Guía de respiración lenta: 4 s dentro, 6 s fuera (Laborde et al., 2022). Un círculo
 * crece y decrece y el texto alterna «Inspira» / «Espira»; con `prefers-reduced-motion`
 * sólo cambia el texto. Es la única animación continua de la app (DESIGN.md §Movimiento):
 * marca un ritmo, no decora, y se detiene al salir de la pantalla.
 */
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { T } from '../text/texts';

export const BREATH_IN_MS = 4000;
export const BREATH_OUT_MS = 6000;

export function Breath() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  useEffect(() => {
    let id = 0;
    let p: 'in' | 'out' = 'in';
    const tick = () => {
      p = p === 'in' ? 'out' : 'in';
      setPhase(p);
      id = window.setTimeout(tick, p === 'in' ? BREATH_IN_MS : BREATH_OUT_MS);
    };
    id = window.setTimeout(tick, BREATH_IN_MS);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="breath" role="group" aria-label="Guía de respiración">
      <div className={`breath-ring ${reduce ? 'is-static' : ''}`} aria-hidden="true"><div className="breath-core" /></div>
      <p className="breath-label" aria-live="polite" aria-atomic="true">{phase === 'in' ? T.BREATH_IN : T.BREATH_OUT}</p>
      <p className="t-foot t-muted" style={{ textAlign: 'center' }}>{reduce ? T.BREATH_HINT_STATIC : T.BREATH_HINT}</p>
    </div>
  );
}
