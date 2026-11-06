import type { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Icon } from './Icon';

/** Cabecera: Atrás (si procede) · título · hasta dos acciones. */
export function Topbar({ title, back, actions, subtitle }: { title: string; back?: string | (() => void); actions?: ReactNode; subtitle?: string }) {
  const [, navigate] = useLocation();
  const goBack = () => {
    if (typeof back === 'function') back();
    else if (back) navigate(back);
  };
  return (
    <header className="topbar">
      <div className="content row" style={{ minHeight: 52 }}>
        {back !== undefined ? (
          <button className="btn btn-text" style={{ marginLeft: -8 }} onClick={goBack}>
            <Icon name="back" /> Atrás
          </button>
        ) : null}
        <div className="grow" style={{ minWidth: 0 }}>
          <h1 className="t-lead ellipsis" style={{ fontWeight: 600 }}>{title}</h1>
          {subtitle && <div className="t-foot ellipsis">{subtitle}</div>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </header>
  );
}
