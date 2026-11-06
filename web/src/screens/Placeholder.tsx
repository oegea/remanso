import { Topbar } from '../ui/Topbar';
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="screen">
      <Topbar title={title} />
      <div className="content screen-body"><p className="t-muted">En construcción.</p></div>
    </div>
  );
}
