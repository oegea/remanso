/**
 * Minirreproductor: sólo existe mientras hay un sonido elegido. Una línea sobre la barra
 * inferior en móvil y al pie de la barra lateral en escritorio: nombre, tiempo hasta el
 * apagado, pausa, siguiente, parar y volumen. Parar lo quita de en medio.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { usePlayer, player } from '../audio/player';
import { sound, fmtRemaining } from '../audio/catalog';
import { Icon } from './Icon';
import { HELP } from '../text/help';

export function MiniPlayer({ raised }: { raised: boolean }) {
  const p = usePlayer();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!p.endsAt) return;
    const t = window.setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [p.endsAt]);
  if (!p.soundId) return null;
  const s = sound(p.soundId);
  const remaining = p.endsAt ? fmtRemaining(p.endsAt - Date.now()) : null;
  return (
    <div className={`miniplayer ${raised ? 'is-raised' : ''}`} role="region" aria-label={HELP.SOUNDS_NOW}>
      <Link href="/sonidos" className="mini-title">
        <Icon name="sound" className="t-muted" size={18} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: 'block', fontWeight: 600 }}>{s.name}</span>
          <span className="t-foot t-muted ellipsis" style={{ display: 'block' }}>{p.status === 'paused' ? HELP.SOUNDS_PAUSED : remaining ? HELP.SOUNDS_ENDS.replace('{t}', remaining) : HELP.SOUNDS_PLAYING}</span>
        </span>
      </Link>
      <div className="mini-controls">
        <button className="btn btn-icon" aria-label={p.status === 'playing' ? HELP.MINI_PAUSE : HELP.MINI_PLAY} onClick={() => void player.toggle()}><Icon name={p.status === 'playing' ? 'pause' : 'play'} /></button>
        <button className="btn btn-icon" aria-label={HELP.MINI_NEXT} onClick={() => void player.next()}><Icon name="next" /></button>
        <button className="btn btn-icon" aria-label={HELP.MINI_STOP} onClick={() => void player.stop()}><Icon name="stop" /></button>
        <input className="mini-volume" type="range" min={0} max={1} step={0.02} value={p.volume} aria-label={HELP.MINI_VOLUME} onChange={(e) => player.setVolume(Number(e.target.value))} />
      </div>
    </div>
  );
}
