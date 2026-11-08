import { useState } from 'react';
import { Link } from 'wouter';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { SIDE_EXTRA } from '../ui/Nav';
import { HELP } from '../text/help';
import * as sup from '../domain/support';
import { SupportSheet } from './Support';

export function More() {
  const [support, setSupport] = useState(false);
  return (
    <div className="screen">
      <Topbar title="Más" />
      <div className="content screen-body">
        <div className="list">
          {SIDE_EXTRA.map((d) => (
            <Link key={d.href} href={d.href} className="list-item">
              <Icon name={d.icon} className="t-muted" />
              <span className="grow"><span>{d.label}</span>{HELP.MORE_DESC[d.href] && <span className="meta" style={{ display: 'block' }}>{HELP.MORE_DESC[d.href]}</span>}</span>
              <Icon name="forward" className="t-faint" />
            </Link>
          ))}
        </div>
        {sup.enabled() && (
          <div className="list" style={{ marginTop: 16 }}>
            <button className="list-item" onClick={() => setSupport(true)}>
              <Icon name="wave" className="t-muted" />
              <span className="grow"><span>{HELP.SUPPORT_MORE}</span><span className="meta" style={{ display: 'block' }}>{HELP.SUPPORT_MORE_DESC}</span></span>
              <Icon name="forward" className="t-faint" />
            </button>
          </div>
        )}
      </div>
      <SupportSheet open={support} onClose={() => setSupport(false)} />
    </div>
  );
}
