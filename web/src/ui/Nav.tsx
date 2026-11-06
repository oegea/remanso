import { Link, useLocation } from 'wouter';
import { Icon, type IconName } from './Icon';
import { WaveMark } from './Wave';

const DESTS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Hoy', icon: 'today' },
  { href: '/diario', label: 'Diario', icon: 'diary' },
  { href: '/cuadernos', label: 'Cuadernos', icon: 'notebooks' },
  { href: '/objetivos', label: 'Objetivos', icon: 'goals' },
  { href: '/mas', label: 'Más', icon: 'more' },
];

const SIDE_EXTRA: { href: string; label: string; icon: IconName }[] = [
  { href: '/tareas', label: 'Tareas', icon: 'tasks' },
  { href: '/recordatorios', label: 'Recordatorios', icon: 'reminders' },
  { href: '/revision', label: 'Revisión', icon: 'review' },
  { href: '/impulso', label: 'Impulso', icon: 'impulse' },
  { href: '/buscar', label: 'Buscar', icon: 'search' },
  { href: '/ajustes', label: 'Ajustes', icon: 'settings' },
];

function active(loc: string, href: string) {
  if (href === '/') return loc === '/';
  if (href === '/mas') return ['/mas', ...SIDE_EXTRA.map((d) => d.href)].some((h) => loc === h || loc.startsWith(h + '/'));
  return loc === href || loc.startsWith(href + '/');
}

/** Barra inferior (móvil). */
export function TabBar() {
  const [loc] = useLocation();
  return (
    <nav className="tabbar" aria-label="Secciones">
      {DESTS.map((d) => (
        <Link key={d.href} href={d.href} className={`tab ${active(loc, d.href) ? 'is-active' : ''}`} aria-current={active(loc, d.href) ? 'page' : undefined}>
          <Icon name={d.icon} />
          <span>{d.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Barra lateral (escritorio): todos los destinos visibles. */
export function Sidebar() {
  const [loc] = useLocation();
  const all = [...DESTS.filter((d) => d.href !== '/mas'), ...SIDE_EXTRA];
  return (
    <nav className="sidebar" aria-label="Secciones">
      <div className="sidebar-brand row">
        <WaveMark size={24} className="t-muted" />
        <span style={{ fontWeight: 600 }}>Remanso</span>
      </div>
      {all.map((d) => (
        <Link key={d.href} href={d.href} className={`side-item ${active(loc, d.href) ? 'is-active' : ''}`} aria-current={active(loc, d.href) ? 'page' : undefined}>
          <Icon name={d.icon} />
          <span>{d.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export { SIDE_EXTRA };
