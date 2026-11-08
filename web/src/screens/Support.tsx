/**
 * «Por qué existe Remanso»: la intención con la que se ofrece, y la invitación a un café.
 * Se abre desde Hoy, desde «Más» y desde Ajustes. Explica primero; la persona elige después.
 */
import { motion } from 'motion/react';
import { session } from '../app/session';
import { bumpData } from '../app/useSession';
import * as sup from '../domain/support';
import { Sheet } from '../ui/Sheet';
import { Icon } from '../ui/Icon';
import { HELP } from '../text/help';

export function SupportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = () => {
    // Pulsar el enlace cuenta como «más adelante» para la tarjeta de Hoy: una semana de tranquilidad.
    if (session.db) { sup.later(session.db, Math.floor(Date.now() / 1000)); bumpData(); }
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={HELP.SUPPORT_WHY_TITLE} closeLabel={HELP.SUPPORT_NOT_NOW} footer={
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>{HELP.SUPPORT_NOT_NOW}</button>
        <a className="btn btn-primary" href={sup.SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={go}>{HELP.SUPPORT_GO}</a>
      </div>
    }>
      <div className="stack">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduce ? 0 : 0.5, ease: [0.2, 0.8, 0.2, 1] }} style={{ textAlign: 'center' }}>
          <Icon name="wave" size={40} className="t-muted" />
        </motion.div>
        {HELP.SUPPORT_WHY.map((p, i) => (
          <motion.p key={p} className={i === 0 ? '' : 't-muted'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : 0.15 + i * 0.25, ease: [0.2, 0.8, 0.2, 1] }}>{p}</motion.p>
        ))}
        <motion.p className="t-foot t-faint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.15 + HELP.SUPPORT_WHY.length * 0.25 }}>{HELP.SUPPORT_OPENS}</motion.p>
      </div>
    </Sheet>
  );
}
