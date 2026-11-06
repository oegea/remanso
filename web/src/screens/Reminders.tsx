import { useMemo, useState } from 'react';
import { session } from '../app/session';
import { bumpData, useDataVersion } from '../app/useSession';
import * as rm from '../domain/reminders';
import * as rec from '../domain/recurrence';
import { fmtDateCompact, fmtTime, parseDatetimeInput, today, tsToDay, nowTs } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Prompt, Confirm, Choice } from '../ui/Sheet';
import { announce } from '../ui/Live';
import { T } from '../text/texts';

export function Reminders() {
  const dataVersion = useDataVersion();
  const db = session.db!;
  const now = nowTs();
  const t = today();
  const due = useMemo(() => rm.due(db, now), [db, dataVersion, now]);
  const upcoming = useMemo(() => rm.upcoming(db, now, 100), [db, dataVersion, now]);
  const [sheet, setSheet] = useState<null | 'title' | { when: string } | { repeat: number } | { snooze: rm.Reminder } | { resched: rm.Reminder } | { menu: rm.Reminder } | { del: rm.Reminder }>(null);
  const notif = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  const when = (v: string) => parseDatetimeInput(v, new Date());
  const fmtWhen = (ts: number) => (tsToDay(ts) === t ? `hoy ${fmtTime(ts)}` : `${fmtDateCompact(tsToDay(ts), t)} ${fmtTime(ts)}`);
  const row = (r: rm.Reminder, isDue: boolean) => (
    <div key={r.id} className="list-item">
      <span className="t-foot num" style={{ color: isDue ? 'var(--warn)' : 'var(--ink-2)', minWidth: 90 }}>{fmtWhen(rm.effectiveAt(r))}</span>
      <span className="grow"><span>{r.title}</span>{(r.repeat || (isDue && rm.needsReview(r))) && <span className="meta" style={{ display: 'block' }}>{[r.repeat ? rec.describe(r.repeat) : null, isDue && rm.needsReview(r) ? 'mostrado 2 veces' : null].filter(Boolean).join(' · ')}</span>}</span>
      {isDue && <button className="btn btn-text" onClick={() => { rm.dismiss(db, r.id); bumpData(); announce('Cerrado.'); }}>Hecho</button>}
      <button className="btn btn-icon" aria-label={`Opciones de ${r.title}`} onClick={() => setSheet({ menu: r })}><Icon name="more" /></button>
    </div>
  );
  const menu = sheet && typeof sheet === 'object' && 'menu' in sheet ? sheet.menu : null;
  return (
    <div className="screen">
      <Topbar title={T.REMINDERS} actions={<button className="btn btn-primary" onClick={() => setSheet('title')}><Icon name="plus" /> Nuevo</button>} />
      <div className="content screen-body stack">
        {due.length === 0 && upcoming.length === 0 && <div className="empty"><p>{T.REMINDERS_EMPTY[0]}</p><p>Se comprueban al abrir la aplicación y mientras está abierta. Un aviso que ya se mostró dos veces invita a revisarlo en vez de insistir.</p></div>}
        {due.length > 0 && <section><h2 className="list-head">{T.REMINDERS_DUE}</h2><div className="list">{due.map((r) => row(r, true))}</div>{due.some(rm.needsReview) && <p className="t-foot t-muted" style={{ marginTop: 8 }}>{T.REMINDER_REVIEW_HINT.replace('(e)', '').replace('(r)', '').replace('(d)', '')}</p>}</section>}
        {upcoming.length > 0 && <section><h2 className="list-head">{T.REMINDERS_UPCOMING}</h2><div className="list">{upcoming.map((r) => row(r, false))}</div></section>}
        <NotificationsNote state={notif} />
      </div>
      <Prompt open={sheet === 'title'} onClose={() => setSheet(null)} title={T.REMINDER_TITLE_PROMPT} submitLabel="Siguiente" onSubmit={(v) => { if (v.trim()) setTimeout(() => setSheet({ when: v.trim() }), 0); }} />
      <Prompt open={!!(sheet && typeof sheet === 'object' && 'when' in sheet)} onClose={() => setSheet(null)} title={T.REMINDER_WHEN_PROMPT} help="mañana 9:00 · lun 18:30 · 15/12 10:00 · +2h" submitLabel="Siguiente"
        onSubmit={(v) => { const ts = when(v); if (!ts || !(sheet && typeof sheet === 'object' && 'when' in sheet)) { announce(T.REMINDER_WHEN_UNKNOWN); return; } const id = rm.create(db, sheet.when, ts, null, null, null); bumpData(); setTimeout(() => setSheet({ repeat: id }), 0); }} />
      <Prompt open={!!(sheet && typeof sheet === 'object' && 'repeat' in sheet)} onClose={() => setSheet(null)} title={T.REMINDER_REPEAT_PROMPT} help="Vacío para no repetir." submitLabel="Guardar"
        onSubmit={(v) => { if (!(sheet && typeof sheet === 'object' && 'repeat' in sheet)) return; const r = rec.parseHuman(v); if (!r && v.trim() && !['no', 'nunca', '-'].includes(v.trim().toLowerCase())) { announce(T.TASK_RECUR_UNKNOWN); return; } rm.setRepeat(db, sheet.repeat, r ?? null); bumpData(); }} />
      <Choice open={!!menu} onClose={() => setSheet(null)} title={menu?.title ?? ''} options={['Cerrar (hecho)', 'Posponer hasta…', 'Reprogramar…', 'Cambiar repetición…', 'Borrar']}
        onPick={(i) => { if (!menu) return; if (i === 0) { rm.dismiss(db, menu.id); bumpData(); } else if (i === 1) setTimeout(() => setSheet({ snooze: menu }), 0); else if (i === 2) setTimeout(() => setSheet({ resched: menu }), 0); else if (i === 3) setTimeout(() => setSheet({ repeat: menu.id }), 0); else setTimeout(() => setSheet({ del: menu }), 0); }} />
      <Prompt open={!!(sheet && typeof sheet === 'object' && 'snooze' in sheet)} onClose={() => setSheet(null)} title={T.REMINDER_SNOOZE_PROMPT} onSubmit={(v) => { const ts = when(v); if (!ts || !(sheet && typeof sheet === 'object' && 'snooze' in sheet)) { announce(T.REMINDER_WHEN_UNKNOWN); return; } rm.snooze(db, sheet.snooze.id, ts); bumpData(); }} />
      <Prompt open={!!(sheet && typeof sheet === 'object' && 'resched' in sheet)} onClose={() => setSheet(null)} title={T.REMINDER_WHEN_PROMPT} onSubmit={(v) => { const ts = when(v); if (!ts || !(sheet && typeof sheet === 'object' && 'resched' in sheet)) { announce(T.REMINDER_WHEN_UNKNOWN); return; } rm.reschedule(db, sheet.resched.id, ts); bumpData(); }} />
      <Confirm open={!!(sheet && typeof sheet === 'object' && 'del' in sheet)} onClose={() => setSheet(null)} destructive title={T.REMINDER_DELETE_CONFIRM} confirmLabel="Borrar" onConfirm={() => { if (sheet && typeof sheet === 'object' && 'del' in sheet) { rm.delete(db, sheet.del.id); bumpData(); } }} />
    </div>
  );
}

/** Notificaciones del navegador: honestas sobre su alcance (sólo con la app abierta o instalada y reciente). */
function NotificationsNote({ state }: { state: string }) {
  const [st, setSt] = useState(state);
  if (st === 'unsupported') return null;
  return (
    <div className="notice stack" style={{ marginTop: 16 }}>
      <p>Sin servidor, Remanso sólo puede avisar mientras está abierta (o instalada y en segundo plano reciente). Los recordatorios se comprueban al abrirla y nada se marca como incumplido.</p>
      {st === 'default' && <button className="btn btn-secondary" onClick={() => void Notification.requestPermission().then(setSt)}>Permitir avisos del navegador</button>}
      {st === 'granted' && <p className="t-foot t-muted">Avisos del navegador permitidos.</p>}
      {st === 'denied' && <p className="t-foot t-muted">Avisos del navegador bloqueados en los permisos del sitio.</p>}
    </div>
  );
}
