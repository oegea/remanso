/**
 * Episodio de impulso P1–P5 (+ desliz) y preparación P0. Un paso por pantalla,
 * «Guardar y salir» siempre visible, tiempo transcurrido sin cuenta atrás.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AnimatePresence, motion } from 'motion/react';
import { session } from '../app/session';
import { bumpData } from '../app/useSession';
import * as imp from '../domain/impulses';
import * as goals from '../domain/goals';
import * as plans from '../domain/plans';
import * as safety from '../domain/safety';
import { Breath } from '../ui/Breath';
import { HELP } from '../text/help';
import { Icon } from '../ui/Icon';
import { HBars, Tile } from '../ui/Chart';
import { Prompt, Choice, Confirm, Sheet } from '../ui/Sheet';
import { announce } from '../ui/Live';
import { T } from '../text/texts';
import catalog from '../text/builtin.json';

type Step = 'pick' | 'stop' | 'trigger' | 'context' | 'pathway' | 'wait' | 'after' | 'outcome' | 'lapse' | 'done';
const ORDER: Step[] = ['stop', 'trigger', 'context', 'pathway', 'wait', 'after', 'outcome', 'done'];

function steps(key: string): string[] {
  return (catalog.tecnicas as { clave: string; pasos?: string[] }[]).find((t) => t.clave === key)?.pasos ?? [];
}

export function Impulse() {
  const db = session.db!;
  const [, navigate] = useLocation();
  const active = useMemo(() => goals.list(db, false).filter((g) => g.status === 'active'), [db]);
  const [step, setStep] = useState<Step>(active.length ? 'pick' : 'stop');
  const [goal, setGoal] = useState<goals.Goal | null>(null);
  const [cfg, setCfg] = useState<imp.ImpulseConfig>(() => imp.loadConfig(db, null));
  const [episode, setEpisode] = useState<number | null>(() => (active.length ? null : imp.start(db, null)));
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [trigger, setTrigger] = useState<number | null>(null);
  const [ctx, setCtx] = useState<boolean[]>(() => T.IMPULSE_CONTEXTS.map(() => false));
  const [pathway, setPathway] = useState<imp.Pathway | null>(null);
  const [sub, setSub] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [lapseSel, setLapseSel] = useState<boolean[]>(() => T.LAPSE_BEFORE_OPTS.map(() => false));
  const [lapseStage, setLapseStage] = useState(0);
  const [forgave, setForgave] = useState(false);
  const [distress, setDistress] = useState(false);
  const [ask, setAsk] = useState<null | 'body' | 'future' | 'reframe' | 'reflection' | 'lapseStep' | { planSit: string } | 'harm' | 'tech' | 'derivation' | 'delete'>(null);
  const [derivLines, setDerivLines] = useState<string[]>([]);
  const hasHistory = (db.scalar<number>('SELECT count(*) FROM impulse_episodes WHERE ended_at IS NOT NULL') ?? 0) > 0;
  const waitStart = useRef<number | null>(null);
  const breathStart = useRef<number | null>(null);
  const BREATH_TARGET = 240; // tres a cinco minutos (Laborde et al., 2022); se puede terminar antes o seguir después
  const [, tick] = useState(0);
  // Redibujo del tiempo transcurrido cada 30 s sólo durante la espera.
  useEffect(() => {
    if (step !== 'wait') return;
    // Cada segundo mientras se respira con el círculo (muestra el tiempo); cada 30 s en el resto.
    const breathing = pathway === 'breathe' && sub === 1;
    // Siguiendo el círculo no se toca la pantalla: cuenta como uso para el bloqueo por inactividad.
    const id = window.setInterval(() => { if (breathing) session.keepAlive(); tick((x) => x + 1); }, breathing ? 1000 : 30_000);
    return () => window.clearInterval(id);
  }, [step, pathway, sub]);
  const fmtSecs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);
  const breathText = () => {
    const elapsed = breathStart.current ? Math.floor((Date.now() - breathStart.current) / 1000) : 0;
    if (elapsed >= BREATH_TARGET) return HELP.BREATH_DONE;
    return `Llevas ${fmtSecs(elapsed)} · quedan ${fmtSecs(BREATH_TARGET - elapsed)}. ${HELP.BREATH_FREE}`;
  };

  // Cada paso empieza arriba; el scroll del paso anterior no se hereda.
  useEffect(() => { window.scrollTo(0, 0); }, [step, sub]);
  const waited = () => (waitStart.current ? Math.floor((Date.now() - waitStart.current) / 1000) : null);
  // Escape (teclado) = «Guardar y salir», salvo cuando hay una hoja abierta (la hoja lo captura).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ask) exit(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  const saveAll = () => {
    if (episode == null) return;
    imp.setBefore(db, episode, before, trigger != null ? T.IMPULSE_TRIGGERS[trigger] : '');
    imp.setContext(db, episode, T.IMPULSE_CONTEXTS.filter((_, i) => ctx[i]).join(', '));
    imp.setAfter(db, episode, waited(), after);
    imp.finish(db, episode, outcome, notes.join('\n'));
    bumpData();
  };
  const exit = () => { saveAll(); navigate('/'); };
  // Un paso atrás sin perder nada: lo elegido sigue en memoria y se guarda igual al salir.
  const canBack = step !== 'pick' && step !== 'done' && !(step === 'stop' && !active.length);
  const back = () => {
    if (ask || !canBack) return;
    switch (step) {
      case 'stop': if (episode != null) imp.remove(db, episode); setEpisode(null); setGoal(null); setStep('pick'); break;
      case 'trigger': setStep('stop'); break;
      case 'context': setStep('trigger'); break;
      case 'pathway': setStep('context'); break;
      case 'wait': if (sub > 0) setSub(sub - 1); else setStep('pathway'); break;
      case 'after': setStep(pathway ? 'wait' : 'pathway'); break;
      case 'outcome': setStep('after'); break;
      case 'lapse': if (lapseStage > 0) setLapseStage(0); else setStep('outcome'); break;
    }
  };
  const removeEpisode = () => { if (episode != null) imp.remove(db, episode); bumpData(); announce(HELP.IMPULSE_DELETED); navigate('/'); };
  const startEpisode = (g: goals.Goal | null) => {
    setGoal(g);
    const c = imp.loadConfig(db, g?.id ?? null);
    setCfg(c);
    setEpisode(imp.start(db, g?.id ?? null));
    setStep('stop');
  };
  const choosePathway = (p: imp.Pathway) => {
    setPathway(p); setSub(0);
    if (!waitStart.current) waitStart.current = Date.now();
    if (episode != null) imp.setPathway(db, episode, goal?.id ?? null, p);
    setStep('wait');
  };
  const pathwaySteps = (): string[] => {
    switch (pathway) {
      case 'surf': return steps('surfear_impulso');
      case 'breathe': return steps('respiracion_lenta');
      case 'distract': return [cfg.distractions.length ? `${T.IMPULSE_DISTRACTIONS}:\n${cfg.distractions.map((d) => '· ' + d).join('\n')}` : T.IMPULSE_NONE_CONFIGURED];
      case 'long_term': {
        const first = [goal?.why ? `${T.IMPULSE_WHY}: ${goal.why}` : null, cfg.future_image ? `${T.IMPULSE_FUTURE_IMAGE}: ${cfg.future_image}` : null].filter(Boolean).join('\n') || T.IMPULSE_NONE_CONFIGURED;
        return [first, ...steps('espera_activa')];
      }
      case 'competing': return [cfg.competing_response || T.IMPULSE_NONE_CONFIGURED];
      default: return [];
    }
  };
  const nextInWait = () => {
    const ps = pathwaySteps();
    if (sub + 1 < ps.length) {
      const n = sub + 1; setSub(n);
      if (pathway === 'surf' && n === 1) setAsk('body');
      if (pathway === 'long_term' && n === 1) setAsk('future');
      if (pathway === 'long_term' && n === 2) setAsk('reframe');
    } else setStep('after');
  };
  const finishReflection = (v: string) => {
    if (v.trim()) setNotes((n) => [...n, v.trim()]);
    if (outcome === 'acted') { setStep('lapse'); setLapseStage(0); }
    else { setTimeout(() => { saveAll(); setStep('done'); }, 0); }
  };
  const progressIdx = ORDER.indexOf(step === 'lapse' ? 'outcome' : step);
  const elapsedMin = waitStart.current ? Math.floor((Date.now() - waitStart.current) / 60_000) : 0;
  const waitDone = waitStart.current ? (Date.now() - waitStart.current) / 1000 >= cfg.wait_seconds : false;
  const techKey = step === 'stop' || step === 'trigger' ? 'pausa_stop' : step === 'wait' && pathway ? imp.pathwayKey(pathway) : 'espera_activa';
  const tech = (catalog.tecnicas as { clave: string; nombre: string; confianza: string; finalidad: string; explicacion: string; evidencia: string[]; limites?: string; experimental: boolean }[]).find((x) => x.clave === techKey);

  return (
    <div className="editor-shell">
      <header className="topbar">
        <div className="content row" style={{ minHeight: 52 }}>
          <button className="btn btn-icon" style={{ marginLeft: -8, visibility: canBack ? 'visible' : 'hidden' }} aria-label={HELP.IMPULSE_BACK} aria-hidden={!canBack} tabIndex={canBack ? 0 : -1} onClick={back}><Icon name="back" /></button>
          <button className="btn btn-text" onClick={exit}><Icon name="close" /> {step === 'done' ? 'Volver' : 'Guardar y salir'}</button>
          <div className="grow" style={{ textAlign: 'center' }}><div className="steps" aria-label={`Paso ${progressIdx + 1} de ${ORDER.length}`}>{ORDER.map((s, i) => <span key={s} className={i <= progressIdx ? 'is-on' : ''} />)}</div></div>
          <button className="btn btn-icon" aria-label="Sobre esta técnica" onClick={() => setAsk('tech')}><Icon name="info" /></button>
        </div>
      </header>
      <div className="editor-body stack-lg" style={{ maxWidth: 560 }}>
        <AnimatePresence mode="wait">
          <motion.div key={step + sub} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }} className="stack-lg">
            {step === 'pick' && (
              <div className="stack">
                <h1 className="t-title">{T.IMPULSE_PICK_GOAL}</h1>
                {active.map((g) => <button key={g.id} className="btn btn-secondary btn-block" style={{ justifyContent: 'flex-start', whiteSpace: 'normal' }} onClick={() => startEpisode(g)}>{g.name}</button>)}
                <button className="btn btn-secondary btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => startEpisode(null)}>{T.IMPULSE_NO_GOAL}</button>
                {hasHistory && <Link href="/impulsos" className="btn btn-text" style={{ alignSelf: 'flex-start' }}>{T.IMPULSE_HISTORY_LINK}</Link>}
              </div>
            )}
            {step === 'stop' && (
              <div className="stack-lg">
                <div className="stack">{steps('pausa_stop').map((l, i) => <p key={l} className={i === 0 ? 't-date' : 't-title'} style={{ fontWeight: i === 0 ? 600 : 500 }}>{l}</p>)}</div>
                <Intensity label={T.IMPULSE_INTENSITY} initial={before} onPick={(v) => { setBefore(v); setStep('trigger'); }} onSkip={() => setStep('trigger')} />
              </div>
            )}
            {step === 'trigger' && (
              <div className="stack">
                <h1 className="t-title">{T.IMPULSE_TRIGGER}</h1>
                {T.IMPULSE_TRIGGERS.map((tr, i) => <button key={tr} className="btn btn-secondary btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setTrigger(i); setStep('context'); }}>{tr}</button>)}
                <button className="btn btn-text" onClick={() => setStep('context')}>Omitir</button>
              </div>
            )}
            {step === 'context' && (
              <div className="stack">
                <h1 className="t-title">{T.IMPULSE_CONTEXT}</h1>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{T.IMPULSE_CONTEXTS.map((c, i) => <button key={c} className="chip" aria-pressed={ctx[i]} onClick={() => setCtx((x) => x.map((v, j) => (j === i ? !v : v)))}>{c}</button>)}</div>
                <p className="t-muted">{T.IMPULSE_CONTEXT_HELP}</p>
                <button className="btn btn-primary btn-block" onClick={() => setStep('pathway')}>Siguiente</button>
              </div>
            )}
            {step === 'pathway' && (
              <div className="stack">
                <h1 className="t-title">{T.IMPULSE_PATHWAY}</h1>
                {([['surf', T.IMPULSE_PATHWAY_SURF.split(':')[0]], ['breathe', T.IMPULSE_PATHWAY_BREATHE.split(':')[0]], ['distract', T.IMPULSE_PATHWAY_DISTRACT], ['long_term', T.IMPULSE_PATHWAY_LONGTERM.split(':')[0]], ['competing', T.IMPULSE_PATHWAY_COMPETING.split(' (')[0]]] as [imp.Pathway, string][]).map(([p, label]) => {
                  const prepared = p === 'distract' ? (cfg.distractions.length ? cfg.distractions.join(' · ') : null) : p === 'competing' ? (cfg.competing_response || null) : undefined;
                  return (
                    <button key={p} className={`btn btn-secondary btn-block ${cfg.last_pathway === p ? 'is-on' : ''}`} style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left', minHeight: 56, padding: '12px 16px', display: 'block', ...(cfg.last_pathway === p ? { borderColor: 'var(--accent)' } : {}) }} onClick={() => choosePathway(p)}>
                      <span style={{ display: 'block' }}>{label}</span>
                      <span className="t-foot t-muted" style={{ display: 'block', fontWeight: 400, marginTop: 2 }}>{HELP.PATHWAY_DESC[p]}</span>
                      {prepared !== undefined && <span className="t-foot" style={{ display: 'block', fontWeight: 400, marginTop: 4, color: prepared ? 'var(--accent)' : 'var(--ink-3)' }}>{prepared ?? HELP.PATHWAY_UNPREPARED}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {step === 'wait' && pathway === 'breathe' && sub === 0 && (
              <div className="stack-lg">
                <p className="t-foot t-muted">{T.IMPULSE_WAIT_TITLE} · {tech?.nombre}</p>
                <h1 className="t-title">{HELP.BREATH_INTRO_TITLE}</h1>
                {HELP.BREATH_INTRO.map((x) => <p key={x} className="t-lead t-muted">{x}</p>)}
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => { breathStart.current = Date.now(); setSub(1); }}>Empezar</button>
                  <button className="btn btn-text" onClick={() => setStep('pathway')}>Otra vía</button>
                </div>
              </div>
            )}
            {step === 'wait' && pathway === 'breathe' && sub === 1 && (
              <div className="stack-lg">
                <p className="t-foot t-muted">{T.IMPULSE_WAIT_TITLE} · {tech?.nombre}</p>
                <Breath />
                {distress && <p className="notice">{T.IMPULSE_DISTRESS}</p>}
                <p className="t-muted" style={{ textAlign: 'center' }}>{breathText()}</p>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => setStep('after')}>Terminar</button>
                  <button className="btn btn-text" onClick={() => setStep('pathway')}>Otra vía</button>
                  {!distress && <button className="btn btn-text" onClick={() => setDistress(true)}>Esto me angustia</button>}
                </div>
              </div>
            )}
            {step === 'wait' && pathway !== 'breathe' && (
              <div className="stack-lg">
                <p className="t-foot t-muted">{T.IMPULSE_WAIT_TITLE} · {tech?.nombre}</p>
                <p className="t-title" style={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>{pathwaySteps()[sub]}</p>
                {pathway === 'surf' && sub === 2 && <Breath />}
                {distress && <p className="notice">{T.IMPULSE_DISTRESS}</p>}
                <p className="t-muted">{elapsedMin === 0 ? T.IMPULSE_WAIT_JUST_STARTED : T.IMPULSE_WAIT_ELAPSED.replace('{m}', String(elapsedMin))}{waitDone ? ` ${T.IMPULSE_WAIT_DONE}` : ''}</p>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button className="btn btn-primary" onClick={nextInWait}>Siguiente</button>
                  <button className="btn btn-secondary" onClick={() => setStep('after')}>Terminar</button>
                  <button className="btn btn-text" onClick={() => setStep('pathway')}>Otra vía</button>
                  {!distress && <button className="btn btn-text" onClick={() => setDistress(true)}>Esto me angustia</button>}
                </div>
                <p className="t-foot t-faint">Paso {sub + 1} de {Math.max(1, pathwaySteps().length)}</p>
              </div>
            )}
            {step === 'after' && <Intensity label={T.IMPULSE_INTENSITY} initial={after} onPick={(v) => { setAfter(v); setStep('outcome'); }} onSkip={() => setStep('outcome')} />}
            {step === 'outcome' && (
              <div className="stack">
                <h1 className="t-title">{T.IMPULSE_OUTCOME}</h1>
                {imp.OUTCOMES.map(([k, l]) => <button key={k} className="btn btn-secondary btn-block" style={{ justifyContent: 'flex-start' }} onClick={() => { setOutcome(k); setAsk('reflection'); }}>{l}</button>)}
              </div>
            )}
            {step === 'lapse' && (
              <div className="stack">
                <h1 className="t-title">{T.LAPSE_TITLE}</h1>
                <p className="t-lead">{T.LAPSE_LINE1}</p>
                {lapseStage === 0 ? (
                  <>
                    <p>{T.LAPSE_BEFORE}</p>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{T.LAPSE_BEFORE_OPTS.map((o, i) => <button key={o} className="chip" aria-pressed={lapseSel[i]} onClick={() => setLapseSel((x) => x.map((v, j) => (j === i ? !v : v)))}>{o}</button>)}</div>
                    <button className="btn btn-primary btn-block" onClick={() => { const seen = T.LAPSE_BEFORE_OPTS.filter((_, i) => lapseSel[i]); if (seen.length) setNotes((n) => [...n, `Antes: ${seen.join(', ')}`]); setLapseStage(1); setAsk('lapseStep'); }}>Siguiente</button>
                  </>
                ) : (
                  <>
                    {notes.map((n) => <p key={n} className="t-foot t-muted">✓ {n}</p>)}
                    {!forgave && <button className="btn btn-secondary btn-block" style={{ whiteSpace: 'normal' }} onClick={() => { setForgave(true); setNotes((n) => [...n, T.LAPSE_FORGIVE]); }}>{T.LAPSE_FORGIVE}</button>}
                    <button className="btn btn-primary btn-block" onClick={() => { saveAll(); setStep('done'); }}>Terminar</button>
                  </>
                )}
              </div>
            )}
            {step === 'done' && (
              <div className="stack">
                <h1 className="t-title">{T.IMPULSE_SAVED}</h1>
                {before != null && after != null && <p className="t-muted">Intensidad: {before} → {after}. {T.PATTERN_INTENSITY_NOTE}</p>}
                {waited() != null && <p className="t-muted">Tiempo: {Math.floor(waited()! / 60)} min {waited()! % 60} s.</p>}
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => navigate('/')}>Volver</button>
                  <Link href="/impulsos" className="btn btn-text">{T.IMPULSE_HISTORY_LINK}</Link>
                </div>
                <button className="btn btn-text btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setAsk('delete')}>{HELP.IMPULSE_DELETE}</button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {step !== 'done' && <p className="t-foot t-faint">«Guardar y salir» guarda lo que haya, en cualquier momento.</p>}
      </div>
      <Prompt open={ask === 'body'} onClose={() => setAsk(null)} title={T.IMPULSE_BODY_PROMPT} multiline onSubmit={(v) => { if (v.trim()) setNotes((n) => [...n, v.trim()]); }} />
      <Prompt open={ask === 'future'} onClose={() => setAsk(null)} title={T.IMPULSE_FUTURE_PROMPT} multiline onSubmit={(v) => { if (v.trim()) setNotes((n) => [...n, v.trim()]); }} />
      <Prompt open={ask === 'reframe'} onClose={() => setAsk(null)} title={T.IMPULSE_REFRAME_PROMPT} multiline onSubmit={(v) => { if (v.trim()) setNotes((n) => [...n, v.trim()]); }} />
      <Prompt open={ask === 'reflection'} onClose={() => { setAsk(null); }} title={T.IMPULSE_REFLECTION} multiline submitLabel="Guardar" onSubmit={finishReflection} />
      <Prompt open={ask === 'lapseStep'} onClose={() => setAsk(null)} title={T.LAPSE_NEXT_STEP} onSubmit={(v) => { if (v.trim()) { setNotes((n) => [...n, `Próxima vez: ${v.trim()}`]); setTimeout(() => setAsk({ planSit: v.trim() }), 0); } else setTimeout(() => setAsk('harm'), 0); }} />
      <Prompt open={!!(ask && typeof ask === 'object' && 'planSit' in ask)} onClose={() => setTimeout(() => setAsk('harm'), 0)} title={T.LAPSE_SAVE_AS_PLAN} help="Déjalo vacío si no quieres guardarlo como plan." onSubmit={(v) => { if (ask && typeof ask === 'object' && 'planSit' in ask && v.trim()) { plans.create(db, goal?.id ?? null, null, v, ask.planSit, true); bumpData(); setNotes((n) => [...n, 'Plan si–entonces guardado.']); } setTimeout(() => setAsk('harm'), 0); }} />
      <Choice open={ask === 'harm'} onClose={() => setAsk(null)} title={T.LAPSE_HARM} options={['No', 'Sí']} onPick={(i) => { if (i === 1 && (safety.isSupervised(db) || safety.firstTime(db, 'harm_warning_shown'))) { setDerivLines(safety.derivation(db, goal ? goals.category(goal.category).red_flag : null, { harm: true })); setTimeout(() => setAsk('derivation'), 0); } }} />
      <Sheet open={ask === 'derivation'} onClose={() => setAsk(null)} title={T.DERIVATION_TITLE} footer={<button className="btn btn-primary btn-block" onClick={() => setAsk(null)}>Entendido</button>}>
        <div className="notice stack">{derivLines.map((l) => <p key={l}>{l}</p>)}</div>
      </Sheet>
      <Confirm open={ask === 'delete'} onClose={() => setAsk(null)} destructive title="¿Borrar este episodio?" body={HELP.IMPULSE_DELETE_CONFIRM} confirmLabel="Borrar" onConfirm={removeEpisode} />
      <Sheet open={ask === 'tech'} onClose={() => setAsk(null)} title={tech?.nombre ?? ''}>
        {tech && <div className="stack t-muted"><p><span className="chip is-on">Confianza {tech.confianza.toLowerCase()}</span>{tech.experimental && <span className="chip" style={{ marginLeft: 8 }}>experimental</span>}</p><p style={{ color: 'var(--ink)' }}>{tech.explicacion}</p><p className="t-foot" style={{ fontWeight: 600 }}>{HELP.EVIDENCE_HEAD}</p><ul className="stack" style={{ gap: 4 }}>{tech.evidencia.map((e) => <li key={e}>· {e}</li>)}</ul>{tech.limites && <><p className="t-foot" style={{ fontWeight: 600 }}>{HELP.LIMITS_HEAD}</p><p>{tech.limites}</p></>}<p className="t-foot">{HELP.CONFIDENCE_LEGEND}</p></div>}
      </Sheet>
    </div>
  );
}

/** Intensidad 0–10: deslizador grande con el número visible y «Omitir». */
function Intensity({ label, initial, onPick, onSkip }: { label: string; initial?: number | null; onPick: (v: number) => void; onSkip: () => void }) {
  const [v, setV] = useState(initial ?? 5);
  return (
    <div className="stack">
      <label htmlFor="intensity" className="t-lead">{label}</label>
      <div className="slider-value" aria-hidden="true">{v}</div>
      <input id="intensity" type="range" min={0} max={10} step={1} value={v} onChange={(e) => setV(Number(e.target.value))} className="slider" aria-valuetext={`${v} de 10`} />
      <div className="row"><button className="btn btn-primary" onClick={() => onPick(v)}>Continuar</button><button className="btn btn-text" onClick={onSkip}>Omitir</button></div>
    </div>
  );
}

// ---- preparación P0 y patrón P6 -------------------------------------------------------------

export function ImpulsePrep({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = session.db!;
  const gs = goals.list(db, false);
  const [gid, setGid] = useState<number | null>(null);
  const [seriousNote, setSeriousNote] = useState<string[] | null>(null);
  const [cfg, setCfg] = useState<imp.ImpulseConfig>(() => imp.loadConfig(db, null));
  const [stage, setStage] = useState(0);
  const load = (g: number | null) => { setGid(g); setCfg(imp.loadConfig(db, g)); setStage(1); };
  const save = (patch: Partial<imp.ImpulseConfig>) => { const c = { ...cfg, ...patch, goal_id: gid }; setCfg(c); imp.saveConfig(db, c); bumpData(); };
  const lines = (v: string) => v.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const fields: { key: keyof imp.ImpulseConfig; title: string; get: () => string; set: (v: string) => void; multiline?: boolean }[] = [
    { key: 'env_changes', title: T.PREP_ENV, get: () => cfg.env_changes.join('; '), set: (v) => save({ env_changes: lines(v) }), multiline: true },
    { key: 'future_image', title: T.PREP_FUTURE, get: () => cfg.future_image, set: (v) => save({ future_image: v }), multiline: true },
    { key: 'distractions', title: T.PREP_DISTRACTIONS, get: () => cfg.distractions.join('; '), set: (v) => save({ distractions: lines(v) }), multiline: true },
    { key: 'competing_response', title: T.PREP_COMPETING, get: () => cfg.competing_response, set: (v) => save({ competing_response: v }) },
    { key: 'wait_seconds', title: T.PREP_WAIT, get: () => String(Math.round(cfg.wait_seconds / 60)), set: (v) => { const m = Number(v); if (Number.isFinite(m)) save({ wait_seconds: Math.min(1200, Math.max(300, m * 60)) }); } },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={T.PREP_TITLE}>
      {stage === 0 ? (
        <div className="stack">
          {HELP.PREP_INTRO.map((x) => <p key={x} className="t-muted">{x}</p>)}
          <div className="list">{gs.map((g) => <button key={g.id} className="list-item" onClick={() => load(g.id)}><span className="grow">{g.name}</span><Icon name="forward" className="t-faint" /></button>)}<button className="list-item" onClick={() => load(null)}><span className="grow">General (sin objetivo concreto)</span><Icon name="forward" className="t-faint" /></button></div>
        </div>
      ) : (
        <div className="stack">
          {fields.map((f) => <PrepField key={f.key} title={f.title} value={f.get()} onSave={f.set} multiline={f.multiline} />)}
          <div className="field"><label>{T.PREP_SERIOUS}</label><div className="row">{T.PREP_SERIOUS_OPTS.map((o, i) => <button key={o} className="chip" aria-pressed={cfg.serious === (i === 0 ? false : i === 1 ? true : null) && (i !== 2 || cfg.serious === null)} onClick={() => { save({ serious: i === 0 ? false : i === 1 ? true : null }); if (i === 1 && (safety.isSupervised(db) || safety.firstTime(db, 'serious_warning_shown'))) { const g = gs.find((x) => x.id === cfg.goal_id); setSeriousNote(safety.derivation(db, g ? goals.category(g.category).red_flag : null)); } }}>{o}</button>)}</div>
            {seriousNote && <div className="notice stack" role="status" style={{ marginTop: 8 }}>{seriousNote.map((l) => <p key={l}>{l}</p>)}</div>}
          </div>
          <button className="btn btn-text" onClick={() => setStage(0)}>Otro objetivo</button>
        </div>
      )}
    </Sheet>
  );
}

function PrepField({ title, value, onSave, multiline }: { title: string; value: string; onSave: (v: string) => void; multiline?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="field">
      <label>{title}</label>
      {multiline ? <textarea className="input" rows={2} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} /> : <input className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} />}
    </div>
  );
}

/** Nombre de la técnica de una vía, tomado del catálogo. */
export function pathwayName(p: imp.Pathway | null): string {
  if (!p) return '';
  return (catalog.tecnicas as { clave: string; nombre: string }[]).find((t) => t.clave === imp.pathwayKey(p))?.nombre ?? '';
}

const fmt1 = (x: number) => x.toFixed(1).replace('.', ',');

/**
 * Resumen visual de los últimos 30 días: baldosas con las cifras, barras por franja, por
 * lo que había antes, por contexto y por vía; intensidad antes/después sobre 0–10.
 * Un solo tono; nada se puntúa (Harkin 2016: comparar sólo con uno mismo).
 */
export function PatternCard({ link = true }: { link?: boolean } = {}) {
  const db = session.db!;
  const p = imp.pattern(db, null, Math.floor(Date.now() / 1000));
  const cfg = imp.loadConfig(db, null);
  const rising = imp.risingFourWeeks(p);
  const showDerivation = useMemo(() => {
    if (!rising) return false;
    const last = Number(db.scalar<string>("SELECT value FROM settings WHERE key = 'rising_warning_at'") ?? 0);
    const now = Math.floor(Date.now() / 1000);
    if (now - last > 28 * 86_400) { db.run("INSERT INTO settings(key, value) VALUES ('rising_warning_at', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [String(now)]); return true; }
    return false;
  }, [db, rising]);
  if (p.total_30 === 0) return <p className="t-muted">{T.PATTERN_EMPTY}</p>;
  const slots = T.PATTERN_SLOTS.map((s, i) => [s, p.by_slot[i]] as const);
  return (
    <div className="stack-lg">
      <div className="tiles">
        <Tile value={p.total_7} label="episodios en 7 días" />
        <Tile value={p.total_30} label="episodios en 30 días" />
        {p.known_30 > 0 && <Tile value={p.not_acted_30} unit={`de ${p.known_30}`} label="sin actuar en 30 días" />}
      </div>
      <Block title="A qué hora aparecen"><HBars rows={slots} /></Block>
      {p.mean_before != null && p.mean_after != null && (
        <Block title="Intensidad media (0–10)" foot={T.PATTERN_INTENSITY_NOTE}>
          <HBars rows={[['antes', p.mean_before], ['después', p.mean_after]]} max={10} format={fmt1} />
        </Block>
      )}
      {p.triggers.length > 0 && <Block title="Qué había antes del impulso"><HBars rows={p.triggers.slice(0, 4)} /></Block>}
      {p.contexts.length > 0 && <Block title="En qué contexto"><HBars rows={p.contexts.slice(0, 4)} /></Block>}
      {p.pathways.length > 0 && <Block title="Qué vía elegiste"><HBars rows={p.pathways.map(([pw, n]) => [pathwayName(pw) || imp.pathwayKey(pw).replace('_', ' '), n] as const)} /></Block>}
      {rising && <p className="notice is-warn">{T.PATTERN_RISING.replace('{a}', String(p.acted_weekly[0])).replace('{b}', String(p.acted_weekly[1])).replace('{c}', String(p.acted_weekly[2])).replace('{d}', String(p.acted_weekly[3]))}</p>}
      {showDerivation && <div className="notice stack" role="status">{safety.derivation(db, null).map((l) => <p key={l}>{l}</p>)}</div>}
      {cfg.env_changes.length > 0 && <div><p style={{ fontWeight: 600 }}>Cambios en el entorno que anotaste. ¿Siguen en pie?</p><ul>{cfg.env_changes.map((c) => <li key={c} className="t-muted">· {c}</li>)}</ul></div>}
      {link && <Link href="/impulsos" className="btn btn-text" style={{ alignSelf: 'flex-start' }}>{T.IMPULSE_HISTORY_LINK}</Link>}
    </div>
  );
}

function Block({ title, foot, children }: { title: string; foot?: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 0 }}>
      <h3 className="t-foot" style={{ fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      {children}
      {foot && <p className="t-foot t-muted" style={{ marginTop: 8 }}>{foot}</p>}
    </div>
  );
}
