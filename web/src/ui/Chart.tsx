/** Gráficas SVG mínimas: línea de tendencia + puntos crudos, barra, puntos de semana. */
import type { DayValue } from '../domain/metrics';

export function TrendChart({ series, smooth, height = 120 }: { series: DayValue[]; smooth: DayValue[]; height?: number }) {
  const w = 320;
  const all = [...series.map((p) => p.value), ...smooth.map((p) => p.value)];
  if (all.length === 0) return null;
  let min = Math.min(...all), max = Math.max(...all);
  if (max - min < 1e-9) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  min -= pad; max += pad;
  const days = series.map((p) => p.day);
  const first = days[0], last = days[days.length - 1];
  const span = Math.max(1, dayDiff(last, first));
  const x = (d: string) => 8 + (dayDiff(d, first) / span) * (w - 16);
  const y = (v: number) => height - 8 - ((v - min) / (max - min)) * (height - 16);
  const path = smooth.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img" aria-label="Gráfica de tendencia; los valores se describen en el texto" className="chart">
      {series.map((p, i) => <circle key={i} cx={x(p.day)} cy={y(p.value)} r={2.5} fill="var(--ink-3)" />)}
      {smooth.length > 1 && <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="chart-line" />}
    </svg>
  );
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

export function Sparkline({ values, width = 120, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  let min = Math.min(...values), max = Math.max(...values);
  if (max - min < 1e-9) { min -= 1; max += 1; }
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - ((v - min) / (max - min)) * (height - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WeekDots({ days, labels = true }: { days: ('done' | 'not' | 'blank' | 'future')[]; labels?: boolean }) {
  const L = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return (
    <div className="dots" aria-hidden="true">
      {days.map((d, i) => (
        <span key={i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span className={`dot is-${d}`} />
          {labels && <span className="t-foot t-faint" style={{ fontSize: 10 }}>{L[i]}</span>}
        </span>
      ))}
    </div>
  );
}

export function ProgressBar({ ratio }: { ratio: number }) {
  return <div className="bar" aria-hidden="true"><span style={{ width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` }} /></div>;
}

/**
 * Barras horizontales con etiqueta y valor: magnitudes en un solo tono (DESIGN.md §3.1:
 * sin colores de fallo). `soft` pinta la barra en gris para la referencia pasada.
 */
export function HBars({ rows, max, soft = false, format }: { rows: readonly (readonly [string, number])[]; max?: number; soft?: boolean; format?: (n: number) => string }) {
  const top = Math.max(1, max ?? Math.max(...rows.map(([, n]) => n)));
  return (
    <div className="hbars">
      {rows.map(([label, n]) => (
        <div key={label} style={{ display: 'contents' }}>
          <span className="lbl" title={label}>{label}</span>
          <span className={`trk ${soft ? 'is-soft' : ''}`} aria-hidden="true"><span style={{ width: `${Math.round((n / top) * 100)}%` }} /></span>
          <span className="val">{format ? format(n) : n}</span>
        </div>
      ))}
    </div>
  );
}

/** Baldosa con una cifra grande y su pie. Nunca cuenta hacia arriba. */
export function Tile({ value, unit, label }: { value: string | number; unit?: string; label: string }) {
  return (
    <div className="tile">
      <span className="big">{value}{unit && <small> {unit}</small>}</span>
      <span className="t-foot">{label}</span>
    </div>
  );
}
