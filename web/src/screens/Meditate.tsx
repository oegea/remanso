/**
 * Meditar: pantalla de inicio (qué es, duración, opciones, diario de sesiones) y la sesión
 * guiada a pantalla completa. La sesión es un plan de fases con cambios señalados por gong,
 * vibración y, si se quiere, una voz breve; al terminar se pregunta cómo te sientes y si
 * hubo algo desagradable (bandera de seguridad, safety.md §2.11).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { session } from '../app/session';
import { bumpData, useDataVersion } from '../app/useSession';
import * as med from '../domain/meditation';
import { fmtDateCompact, fmtTime, today, tsToDay } from '../domain/dates';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Sheet, Confirm } from '../ui/Sheet';
import { Breath } from '../ui/Breath';
import { TextEditor } from '../ui/Editor';
import { announce } from '../ui/Live';
import { canSpeak, canVibrate, gong, hush, keepAwake, speak, vibrate, voiceName } from '../audio/cues';
import { player } from '../audio/player';
import { SOUNDS, type SoundId } from '../audio/catalog';
import { TRACKS, track } from '../audio/tracks';
import { HELP } from '../text/help';

/** Plan preparado en Inicio y recogido por la sesión (no pasa por la URL). */
let pending: { plan: med.Phase[]; prefs: med.Prefs } | null = null;

const BACKGROUNDS: { id: string; label: string }[] = [
  { id: '', label: 'Ninguno' },
  ...TRACKS.filter((t) => t.uses.includes('meditate')).map((t) => ({ id: `track:${t.id}`, label: t.title })),
  ...SOUNDS.filter((s) => s.uses.includes('meditate')).map((s) => ({ id: `sound:${s.id}`, label: s.name })),
];

function fmtMMSS(s: number): string { const m = Math.floor(s / 60), sec = Math.max(0, Math.floor(s % 60)); return `${m}:${String(sec).padStart(2, '0')}`; }

export function Meditate() {
  const dataVersion = useDataVersion();
  const db = session.db!;
  const [, navigate] = useLocation();
  const [help, setHelp] = useState(false);
  const [open, setOpen] = useState<med.Session | null>(null);
  const [prefs, setPrefsState] = useState(() => med.prefs(db));
  const setPrefs = (p: Partial<med.Prefs>) => setPrefsState(med.setPrefs(db, p));
  useEffect(() => { med.discardUnfinished(db); if (canSpeak()) window.speechSynthesis.getVoices(); }, [db]);
  const sessions = useMemo(() => med.list(db), [db, dataVersion]);
  const totals = useMemo(() => med.totals(db), [db, dataVersion]);
  const t = today();
  const begin = () => {
    pending = { plan: med.makePlan(prefs.minutes), prefs };
    navigate('/meditar/sesion');
  };
  return (
    <div className="screen">
      <Topbar title="Meditar" actions={<button className="btn btn-icon" aria-label={HELP.MED_WHAT_Q} onClick={() => setHelp(true)}><Icon name="help" /></button>} />
      <div className="content screen-body stack-lg">
        <p className="t-muted">{HELP.MED_INTRO}</p>
        <section className="card stack" aria-labelledby="h-med-start">
          <h2 id="h-med-start" className="t-lead" style={{ fontWeight: 600 }}>{HELP.MED_DURATION}</h2>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {med.DURATIONS.map((m) => <button key={m} className="chip" aria-pressed={prefs.minutes === m} onClick={() => setPrefs({ minutes: m })}>{m} {HELP.MED_MIN}</button>)}
          </div>
          <h3 className="t-foot" style={{ fontWeight: 600, marginTop: 8 }}>{HELP.MED_OPTIONS}</h3>
          <div className="list">
            <OptRow label={HELP.MED_VOICE} help={canSpeak() ? HELP.MED_VOICE_HELP : HELP.MED_VOICE_NA} on={prefs.voice && canSpeak()} disabled={!canSpeak()} onChange={(v) => setPrefs({ voice: v })} />
            {prefs.voice && canSpeak() && (
              <div className="list-item" style={{ minHeight: 44 }}>
                <span className="grow t-foot t-muted">{voiceName() ? HELP.MED_VOICE_USING.replace('{v}', voiceName()!) : HELP.MED_VOICE_NONE_ES}</span>
                <button className="btn btn-text" onClick={() => speak(HELP.MED_VOICE_SAMPLE)}><Icon name="play" size={16} /> {HELP.MED_VOICE_TEST}</button>
              </div>
            )}
            <OptRow label={HELP.MED_VIBRATE} help={canVibrate() ? undefined : HELP.MED_VIBRATE_NA} on={prefs.vibrate && canVibrate()} disabled={!canVibrate()} onChange={(v) => setPrefs({ vibrate: v })} />
            <OptRow label={HELP.MED_GONG} on={prefs.gong} onChange={(v) => setPrefs({ gong: v })} />
            <div className="list-item" style={{ flexWrap: 'wrap' }}>
              <span className="grow">{HELP.MED_BACKGROUND}</span>
              <select className="input" style={{ width: 'auto', minHeight: 36, padding: '4px 10px' }} aria-label={HELP.MED_BACKGROUND} value={prefs.background} onChange={(e) => setPrefs({ background: e.target.value })}>
                {BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={begin}>{HELP.MED_START} · {prefs.minutes} {HELP.MED_MIN}</button>
          <p className="t-foot t-muted">{HELP.MED_START_HELP}</p>
        </section>
        <section aria-labelledby="h-med-list">
          <h2 id="h-med-list" className="list-head">{HELP.MED_SESSIONS}</h2>
          {sessions.length === 0 ? <p className="t-muted">{HELP.MED_SESSIONS_EMPTY}</p> : (
            <>
              <p className="t-foot t-muted" style={{ marginBottom: 8 }}>{totals.sessions} {totals.sessions === 1 ? HELP.MED_SESSION_ONE : HELP.MED_SESSION_MANY} · {totals.minutes} {totals.minutes === 1 ? 'minuto' : 'minutos'} en total</p>
              <div className="list">
                {sessions.map((s) => (
                  <button key={s.id} className="list-item" onClick={() => setOpen(s)}>
                    <Icon name="meditate" className="t-muted" />
                    <span className="grow">
                      <span>{fmtDateCompact(tsToDay(s.started_at), t)} · {fmtTime(s.started_at)} · {Math.round(s.done_seconds / 60)} {HELP.MED_MIN}{s.done_seconds < s.planned_seconds - 30 ? ` (${HELP.MED_INCOMPLETE})` : ''}</span>
                      <span className="meta" style={{ display: 'block' }}>{med.feelingLabel(s.feeling)}{s.unpleasant ? ` · ${HELP.MED_UNPLEASANT_FLAG}` : ''}{s.notes ? ` · ${s.notes.slice(0, 60)}${s.notes.length > 60 ? '…' : ''}` : ''}</span>
                    </span>
                    <Icon name="forward" className="t-faint" />
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
      <Sheet open={help} onClose={() => setHelp(false)} title={HELP.MED_WHAT_Q}>
        <div className="stack">{HELP.MED_WHAT.map((p) => <p key={p} className="t-muted">{p}</p>)}</div>
      </Sheet>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${fmtDateCompact(tsToDay(open.started_at), t)} · ${fmtTime(open.started_at)}` : ''}>
        {open && (
          <dl className="stack t-muted" style={{ margin: 0 }}>
            <div><dt className="t-foot" style={{ fontWeight: 600 }}>{HELP.MED_DURATION}</dt><dd style={{ margin: 0, color: 'var(--ink)' }}>{fmtMMSS(open.done_seconds)} de {fmtMMSS(open.planned_seconds)}</dd></div>
            <div><dt className="t-foot" style={{ fontWeight: 600 }}>{HELP.MED_FEELING}</dt><dd style={{ margin: 0, color: 'var(--ink)' }}>{med.feelingLabel(open.feeling)}{open.unpleasant ? ` · ${HELP.MED_UNPLEASANT_FLAG}` : ''}</dd></div>
            {open.notes && <div><dt className="t-foot" style={{ fontWeight: 600 }}>Notas</dt><dd style={{ margin: 0, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{open.notes}</dd></div>}
          </dl>
        )}
      </Sheet>
    </div>
  );
}

function OptRow({ label, help, on, disabled, onChange }: { label: string; help?: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="list-item" style={{ alignItems: help ? 'flex-start' : 'center' }}>
      <span className="grow"><span>{label}</span>{help && <span className="meta" style={{ display: 'block' }}>{help}</span>}</span>
      <button className="chip" aria-pressed={on} disabled={disabled} onClick={() => onChange(!on)}>{on ? 'sí' : 'no'}</button>
    </div>
  );
}

/** La sesión: fases, señales, pausa y parada, y el formulario final. */
export function MeditateSession() {
  const db = session.db!;
  const [, navigate] = useLocation();
  const setup = useRef(pending);
  const plan = setup.current?.plan ?? [];
  const prefs = setup.current?.prefs ?? med.prefs(db);
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);          // segundos dentro de la fase
  const [doneTotal, setDoneTotal] = useState(0);      // segundos totales hechos
  const [running, setRunning] = useState(true);
  const [stage, setStage] = useState<'run' | 'form'>('run');
  const [stepText, setStepText] = useState<string | null>(null);
  const [askStop, setAskStop] = useState(false);
  const rowId = useRef<number | null>(null);
  const release = useRef<() => void>(() => {});
  const total = useMemo(() => med.planSeconds(plan), [plan]);

  // Arranque: fila en la base, pantalla encendida, fondo, gong y primera indicación.
  useEffect(() => {
    if (!setup.current) { navigate('/meditar'); return; }
    pending = null;
    rowId.current = med.start(db, plan, Math.floor(Date.now() / 1000));
    void keepAwake().then((r) => { release.current = r; });
    if (prefs.background.startsWith('track:')) { const t = track(prefs.background.slice(6)); if (t) { player.setLoop(true); void player.playTrack(t); } }
    else if (prefs.background.startsWith('sound:')) void player.play(prefs.background.slice(6) as SoundId);
    if (prefs.gong) void gong();
    if (prefs.vibrate) vibrate('phase');
    if (prefs.voice) window.setTimeout(() => speak(plan[0].say ?? plan[0].cue), prefs.gong ? 2500 : 300);
    return () => { release.current(); hush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reloj de la sesión.
  useEffect(() => {
    if (!running || stage !== 'run' || plan.length === 0) return;
    const id = window.setInterval(() => {
      setElapsed((e) => e + 1);
      setDoneTotal((d) => d + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running, stage, plan.length]);

  // Pasos intermedios y cambios de fase.
  useEffect(() => {
    if (stage !== 'run' || plan.length === 0) return;
    const phase = plan[idx];
    const step = phase.steps.find((s) => s.at === elapsed);
    if (step) {
      setStepText(step.text);
      if (prefs.vibrate) vibrate('step');
      if (prefs.voice && step.say) speak(step.say);
    }
    if (elapsed >= phase.seconds) {
      if (idx + 1 >= plan.length) { finishRun(); return; }
      const next = plan[idx + 1];
      setIdx(idx + 1); setElapsed(0); setStepText(null);
      if (prefs.vibrate) vibrate(next.kind === 'closing_breaths' ? 'end' : 'phase');
      if (prefs.gong && next.kind === 'closing_breaths') void gong();
      if (prefs.voice) window.setTimeout(() => speak(next.say ?? next.cue), prefs.gong && next.kind === 'closing_breaths' ? 2500 : 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  const finishRun = () => {
    setRunning(false);
    hush();
    setStage('form');
    void player.stop();
  };
  const stopEarly = () => {
    if (prefs.gong) void gong(true);
    if (prefs.vibrate) vibrate('end');
    finishRun();
  };
  const togglePause = () => {
    if (running) { hush(); if (prefs.vibrate) vibrate('step'); }
    setRunning(!running);
  };

  if (plan.length === 0) return null;
  if (stage === 'form') return <EndForm rowId={rowId.current} doneSeconds={doneTotal} planned={total} />;

  const phase = plan[idx];
  const remaining = total - doneTotal;
  const breathing = phase.kind === 'deep_breaths' || phase.kind === 'closing_breaths';
  return (
    <div className="screen med-stage">
      <header className="topbar">
        <div className="content row" style={{ minHeight: 52 }}>
          <div className="grow"><div className="t-foot t-muted">{phase.title} · {fmtMMSS(phase.seconds)}</div></div>
          <div className="med-dots" aria-label={`Parte ${idx + 1} de ${plan.length}`}>{plan.map((_, i) => <span key={i} className={`dot ${i < idx ? 'is-done' : i === idx ? 'is-current' : 'is-blank'}`} />)}</div>
        </div>
      </header>
      <div className="content med-body">
        {breathing ? <Breath /> : (
          <div className="med-text-wrap">
            <p className="med-text">{stepText ?? phase.cue}</p>
            {phase.eyesClosed && <p className="t-foot t-faint" style={{ textAlign: 'center' }}>{HELP.MED_EYES_CLOSED}</p>}
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <p className="med-time num" aria-live="off">{running ? fmtMMSS(phase.seconds - elapsed) : HELP.MED_PAUSED}</p>
          <p className="t-foot t-faint num" style={{ margin: '4px 0 0' }}>{fmtMMSS(remaining)} {HELP.MED_PART_LEFT}</p>
        </div>
      </div>
      <div className="content med-foot row">
        <button className="btn btn-secondary" onClick={togglePause}><Icon name={running ? 'pause' : 'play'} size={18} /> {running ? HELP.MED_PAUSE : HELP.MED_RESUME}</button>
        <button className="btn btn-text" onClick={() => setAskStop(true)}>{HELP.MED_STOP}</button>
      </div>
      <Confirm open={askStop} onClose={() => setAskStop(false)} title={HELP.MED_STOP_CONFIRM_TITLE} body={HELP.MED_STOP_CONFIRM_BODY} confirmLabel={HELP.MED_STOP} onConfirm={stopEarly} />
    </div>
  );
}

/** Al terminar: cómo te sientes, si hubo algo desagradable (con su nota), notas y guardar. */
function EndForm({ rowId, doneSeconds, planned }: { rowId: number | null; doneSeconds: number; planned: number }) {
  const db = session.db!;
  const [, navigate] = useLocation();
  const [feeling, setFeeling] = useState<number | null>(null);
  const [unpleasant, setUnpleasant] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const repeat = useMemo(() => med.unpleasantAmongLast(db, 3) >= 1, [db]);
  const save = () => {
    if (rowId !== null) med.finish(db, rowId, { now: Math.floor(Date.now() / 1000), doneSeconds, feeling, unpleasant: unpleasant === true, notes });
    bumpData();
    announce('Sesión guardada.');
    navigate('/meditar');
  };
  return (
    <div className="screen">
      <Topbar title={HELP.MED_DONE_TITLE} />
      <div className="content screen-body stack-lg">
        <p className="t-muted">{fmtMMSS(doneSeconds)} de {fmtMMSS(planned)}. {HELP.MED_DONE_HELP}</p>
        <div className="list" role="radiogroup" aria-label={HELP.MED_DONE_TITLE}>
          {med.FEELINGS.map((f) => (
            <button key={f.value} role="radio" aria-checked={feeling === f.value} className={`list-item ${feeling === f.value ? 'is-current' : ''}`} onClick={() => setFeeling(f.value)}>
              <span className={`dot ${feeling === f.value ? 'is-done' : 'is-blank'}`} style={{ width: 18, height: 18 }} /><span className="grow">{f.label}</span>
            </button>
          ))}
        </div>
        <section className="stack" aria-labelledby="h-unpl">
          <h2 id="h-unpl" className="t-lead" style={{ fontWeight: 600 }}>{HELP.MED_UNPLEASANT_Q}</h2>
          <p className="t-foot t-muted">{HELP.MED_UNPLEASANT_HELP}</p>
          <div className="row" style={{ gap: 8 }}>
            <button className="chip" aria-pressed={unpleasant === false} onClick={() => setUnpleasant(false)}>{HELP.MED_UNPLEASANT_NO}</button>
            <button className="chip" aria-pressed={unpleasant === true} onClick={() => setUnpleasant(true)}>{HELP.MED_UNPLEASANT_YES}</button>
          </div>
          {unpleasant && <div className="notice stack" role="status"><p>{HELP.MED_UNPLEASANT_NOTE}</p>{repeat && <p>{HELP.MED_UNPLEASANT_REPEAT}</p>}</div>}
        </section>
        <div className="field">
          <label>{HELP.MED_NOTES}</label>
          <TextEditor value={notes} minHeight={96} placeholder={HELP.MED_NOTES_HINT} onChange={setNotes} />
        </div>
        <button className="btn btn-primary btn-block" onClick={save}>{HELP.MED_SAVE}</button>
      </div>
    </div>
  );
}
