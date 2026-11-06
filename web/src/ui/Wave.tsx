/**
 * Marca de Remanso: la misma onda que el icono «wave», en movimiento muy lento.
 * Dos líneas que se desplazan a velocidades distintas (9 s y 15 s por periodo: dos capas
 * de agua con profundidad; a la misma velocidad parecerían una sola línea doblada), con poca
 * amplitud y en bucle sin costura. Con `prefers-reduced-motion` quedan quietas. Es la única
 * animación en bucle de la app (DESIGN.md §3.4, excepción documentada): bloqueo,
 * presentación, barra lateral y cabecera de Hoy en móvil. Decorativa: siempre aria-hidden.
 */
import { useId } from 'react';

export function WaveMark({ size = 28, className = '', animated = true }: { size?: number; className?: string; animated?: boolean }) {
  // Un periodo mide 12 unidades (de 3 a 15 en el icono). Dibujamos tres periodos y
  // desplazamos exactamente uno: al reiniciar, la línea coincide con la anterior.
  const clip = 'wave' + useId().replace(/:/g, '');
  const wave = 'M-9 12c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0 4 2.5 6 0 4-2.5 6 0 4 2.5 6 0 4-2.5 6 0 4 2.5 6 0';
  return (
    <svg className={`wave-mark ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}><rect x="2" y="0" width="20" height="24" rx="0" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <g className={animated ? 'wave-move is-slow' : undefined} style={{ opacity: 0.45 }}><path d={wave} transform="translate(0 2.5)" /></g>
        <g className={animated ? 'wave-move' : undefined}><path d={wave} /></g>
      </g>
    </svg>
  );
}
