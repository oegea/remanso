/**
 * Minirreproductor: sólo existe mientras hay un sonido elegido. Una línea sobre la barra
 * inferior en móvil y al pie de la barra lateral en escritorio: nombre, tiempo hasta el
 * apagado, pausa, siguiente, parar y volumen. Parar lo quita de en medio.
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { usePlayer, player, elapsed, fmtElapsed } from '../audio/player';
import { sound, fmtRemaining } from '../audio/catalog';
import { track, fmtSeconds } from '../audio/tracks';
import { Icon } from './Icon';
import { HELP } from '../text/help';

export function MiniPlayer({ raised }: { raised: boolean }) {
  const p = usePlayer();
  const [, tick] = useState(0);
  useEffect(() => {
    if (p.status !== 'playing') return;
    const t = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [p.status]);
  if (!p.soundId && !p.trackId) return null;
  const t = p.trackId ? track(p.trackId) : null;
  const name = t ? t.title : sound(p.soundId!).name;
  const remaining = p.endsAt ? fmtRemaining(p.endsAt - Date.now()) : null;
  const pos = player.position();
  const time = t ? `${fmtSeconds(pos.position)}${pos.duration ? ` / ${fmtSeconds(pos.duration)}` : ''}` : fmtElapsed(elapsed());
  return (
    <div className={`miniplayer ${raised ? 'is-raised' : ''}`} role="region" aria-label={HELP.SOUNDS_NOW}>
      <Link href="/sonidos" className="mini-title">
        <Icon name="sound" className="t-muted" size={18} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: 'block', fontWeight: 600 }}>{name}</span>
          <span className="t-foot t-muted ellipsis num" style={{ display: 'block' }}>{p.status === 'paused' ? `${HELP.SOUNDS_PAUSED} · ${time}` : `${time}${remaining ? ` · ${HELP.SOUNDS_ENDS.replace('{t}', remaining)}` : ''}`}</span>
        </span>
      </Link>
      <div className="mini-controls">
        <button className="btn btn-icon" aria-label={p.status === 'playing' ? HELP.MINI_PAUSE : HELP.MINI_PLAY} onClick={() => void player.toggle()}><Icon name={p.status === 'playing' ? 'pause' : 'play'} /></button>
        <button className="btn btn-icon" aria-label={HELP.MINI_NEXT} onClick={() => void player.next()}><Icon name="next" /></button>
        {t && <button className={`btn btn-icon ${p.loop ? 'is-on' : ''}`} aria-label={HELP.MINI_LOOP} aria-pressed={p.loop} onClick={() => player.setLoop(!p.loop)}><Icon name="repeat" size={18} /></button>}
        <button className="btn btn-icon" aria-label={HELP.MINI_STOP} onClick={() => void player.stop()}><Icon name="stop" /></button>
        <input className="mini-volume" type="range" min={0} max={1} step={0.02} value={p.volume} aria-label={HELP.MINI_VOLUME} onChange={(e) => player.setVolume(Number(e.target.value))} />
      </div>
    </div>
  );
}
