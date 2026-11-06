import { Link } from 'wouter';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { SIDE_EXTRA } from '../ui/Nav';
import { HELP } from '../text/help';

export function More() {
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
      </div>
    </div>
  );
}
