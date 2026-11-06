/**
 * Sonidos: ambientes sintetizados y pistas musicales, filtrables por uso (escribir,
 * calmarse, dormir). Tocar una fila la pone a sonar; el minirreproductor hace el resto.
 * Temporizador de apagado para dormir; «guardar para sin conexión» por pista.
 */
import { useEffect, useState } from 'react';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { announce } from '../ui/Live';
import { usePlayer, player } from '../audio/player';
import { FAMILIES, SOUNDS, TIMER_OPTIONS, USES, type Use } from '../audio/catalog';
import { TRACKS, fmtSeconds, isSaved, save, unsave, type Track } from '../audio/tracks';
import { HELP } from '../text/help';

type Tab = 'ambient' | 'music';

export function Sounds() {
  const p = usePlayer();
  const [help, setHelp] = useState(false);
  const [tab, setTab] = useState<Tab>(() => { try { return (localStorage.getItem('remanso.sonidos.pestana') as Tab) || 'ambient'; } catch { return 'ambient'; } });
  const pick = (t: Tab) => { setTab(t); try { localStorage.setItem('remanso.sonidos.pestana', t); } catch { /* sin almacenamiento */ } };
  const use: Use | null = p.use;
  const list = use ? SOUNDS.filter((s) => s.uses.includes(use)) : SOUNDS;
  const tracks = use ? TRACKS.filter((t) => t.uses.includes(use)) : TRACKS;
  return (
    <div className="screen">
      <Topbar title="Sonidos" actions={<button className="btn btn-icon" aria-label={HELP.SOUNDS_WHAT_Q} onClick={() => setHelp(true)}><Icon name="help" /></button>} />
      <div className="content screen-body stack-lg">
        <div className="segments" role="tablist" aria-label="Tipo">
          <button role="tab" aria-selected={tab === 'ambient'} className="segment" onClick={() => pick('ambient')}>{HELP.SOUNDS_TAB_AMBIENT}</button>
          <button role="tab" aria-selected={tab === 'music'} className="segment" onClick={() => pick('music')}>{HELP.SOUNDS_TAB_MUSIC}</button>
        </div>
        <p className="t-muted">{tab === 'ambient' ? HELP.SOUNDS_INTRO : HELP.MUSIC_INTRO}</p>
        <div className="row" role="group" aria-label="Para qué" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="chip" aria-pressed={use === null} onClick={() => player.setUse(null)}>{HELP.SOUNDS_USE_ALL}</button>
          {USES.map((u) => <button key={u.key} className="chip" aria-pressed={use === u.key} onClick={() => player.setUse(u.key)}>{u.label}</button>)}
        </div>
        {tab === 'ambient' ? FAMILIES.map((f) => {
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
        }) : (
          tracks.length === 0 ? <p className="t-muted">{HELP.MUSIC_EMPTY}</p> : (
            <section aria-label={HELP.SOUNDS_TAB_MUSIC}>
              <div className="list">{tracks.map((t) => <TrackRow key={t.id} t={t} current={p.trackId === t.id} playing={p.trackId === t.id && p.status === 'playing'} />)}</div>
              <p className="t-foot t-muted" style={{ marginTop: 12 }}>{HELP.MUSIC_SAVE_HELP} {HELP.MUSIC_LICENCE}</p>
            </section>
          )
        )}
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

/** Fila de pista: tocar reproduce; el icono de la derecha guarda o quita la copia sin conexión. */
function TrackRow({ t, current, playing }: { t: Track; current: boolean; playing: boolean }) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let on = true; void isSaved(t).then((v) => { if (on) setSaved(v); }); return () => { on = false; }; }, [t]);
  const toggleSave = async () => {
    setBusy(true);
    if (saved) { await unsave(t); setSaved(false); announce(HELP.MUSIC_UNSAVE + '.'); }
    else { const ok = await save(t); setSaved(ok); announce(ok ? HELP.MUSIC_SAVED + '.' : 'No se pudo guardar.'); }
    setBusy(false);
  };
  return (
    <div className={`list-item ${current ? 'is-current' : ''}`} style={{ gap: 8 }}>
      <button className="btn btn-icon" aria-label={`${playing ? 'Pausar' : 'Reproducir'} ${t.title}`} aria-pressed={current} onClick={() => (current ? void player.toggle() : void player.playTrack(t))}>
        <span className={`sound-dot ${playing ? 'is-playing' : ''}`} aria-hidden="true"><Icon name={playing ? 'pause' : 'play'} size={16} /></span>
      </button>
      <button className="grow" style={{ textAlign: 'left', minHeight: 44 }} onClick={() => (current ? void player.toggle() : void player.playTrack(t))}>
        <span style={{ fontWeight: current ? 600 : 400 }}>{t.title}</span>
        <span className="meta" style={{ display: 'block' }}>{t.desc} · {fmtSeconds(t.seconds)}</span>
      </button>
      <button className={`btn btn-icon ${saved ? 'is-on' : ''}`} aria-label={saved ? HELP.MUSIC_UNSAVE : HELP.MUSIC_SAVE} aria-pressed={!!saved} disabled={busy || saved === null} onClick={() => void toggleSave()}>
        <Icon name={saved ? 'check' : 'download'} size={18} />
      </button>
    </div>
  );
}
