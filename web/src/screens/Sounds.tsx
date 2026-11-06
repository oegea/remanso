/**
 * Sonidos: la librería de ambientes sintetizados, filtrable por uso (escribir, calmarse,
 * dormir) y agrupada por familia. Tocar una fila la pone a sonar; el minirreproductor hace
 * el resto. Temporizador de apagado para dormir.
 */
import { useState } from 'react';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { usePlayer, player } from '../audio/player';
import { FAMILIES, SOUNDS, TIMER_OPTIONS, USES, type Use } from '../audio/catalog';
import { HELP } from '../text/help';

export function Sounds() {
  const p = usePlayer();
  const [help, setHelp] = useState(false);
  const use: Use | null = p.use;
  const list = use ? SOUNDS.filter((s) => s.uses.includes(use)) : SOUNDS;
  return (
    <div className="screen">
      <Topbar title="Sonidos" actions={<button className="btn btn-icon" aria-label={HELP.SOUNDS_WHAT_Q} onClick={() => setHelp(true)}><Icon name="help" /></button>} />
      <div className="content screen-body stack-lg">
        <p className="t-muted">{HELP.SOUNDS_INTRO}</p>
        <div className="segments" role="tablist" aria-label="Para qué">
          <button role="tab" aria-selected={use === null} className="segment" onClick={() => player.setUse(null)}>{HELP.SOUNDS_USE_ALL}</button>
          {USES.map((u) => <button key={u.key} role="tab" aria-selected={use === u.key} className="segment" onClick={() => player.setUse(u.key)}>{u.label}</button>)}
        </div>
        {FAMILIES.map((f) => {
          const rows = list.filter((s) => s.family === f.key);
          if (rows.length === 0) return null;
          return (
            <section key={f.key} aria-labelledby={`h-${f.key}`}>
              <h2 id={`h-${f.key}`} className="list-head">{f.label}</h2>
              <div className="list">
                {rows.map((s) => {
                  const current = p.soundId === s.id;
                  const playing = current && p.status === 'playing';
                  return (
                    <button key={s.id} className={`list-item ${current ? 'is-current' : ''}`} aria-pressed={current} onClick={() => (current ? void player.toggle() : void player.play(s.id))}>
                      <span className={`sound-dot ${playing ? 'is-playing' : ''}`} aria-hidden="true"><Icon name={playing ? 'pause' : 'play'} size={16} /></span>
                      <span className="grow"><span style={{ fontWeight: current ? 600 : 400 }}>{s.name}</span><span className="meta" style={{ display: 'block' }}>{s.desc}</span></span>
                      {current && <span className="t-foot" style={{ color: 'var(--accent)', whiteSpace: 'nowrap', flex: 'none' }}>{playing ? HELP.SOUNDS_PLAYING : HELP.SOUNDS_PAUSED}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        <section className="card stack" aria-labelledby="h-timer">
          <h2 id="h-timer" className="t-lead" style={{ fontWeight: 600 }}>{HELP.SOUNDS_TIMER}</h2>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {TIMER_OPTIONS.map((m) => <button key={m} className="chip" aria-pressed={p.timerMinutes === m} onClick={() => player.setTimer(m)}>{m === 0 ? HELP.SOUNDS_TIMER_NONE : `${m} min`}</button>)}
          </div>
          <p className="t-foot t-muted">{HELP.SOUNDS_TIMER_HELP}</p>
        </section>
      </div>
      <Sheet open={help} onClose={() => setHelp(false)} title={HELP.SOUNDS_WHAT_Q}>
        <div className="stack">{HELP.SOUNDS_WHAT.map((t) => <p key={t} className="t-muted">{t}</p>)}</div>
      </Sheet>
    </div>
  );
}
