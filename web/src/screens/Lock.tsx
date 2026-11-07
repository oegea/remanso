import { useEffect, useRef, useState, type FormEvent } from 'react';
import { session, BiometricStale } from '../app/session';
import { useSession } from '../app/useSession';
import { WrongPassword } from '../crypto/container';
import { BiometricCancelled, BiometricUnavailable, methodName } from '../crypto/biometric';
import { fmtWait, lockedUntil, TooManyTries } from '../app/lockout';
import { HELP } from '../text/help';
import { fmtDateLong, today } from '../domain/dates';
import { T } from '../text/texts';
import { WaveMark } from '../ui/Wave';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { announce } from '../ui/Live';
import { FINE_POINTER } from '../ui/env';
import { RestoreForm } from './FirstUse';

const m = (s: string) => s.replace('{m}', methodName());
/** La oferta del atajo (con la clave en claro retenida) no espera más que esto. */
const OFFER_MAX_MS = 90_000;

/**
 * Pantalla de bloqueo. Con el atajo biométrico dado de alta, al abrir la aplicación o al
 * volver tras el bloqueo por inactividad se pide la verificación directamente; si la
 * persona bloqueó a propósito («Bloquear ahora»), hace falta un toque. La contraseña
 * siempre está debajo. Tras entrar con contraseña en un dispositivo compatible se ofrece
 * una vez activar el atajo.
 */
export function Lock() {
  const s = useSession();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [until, setUntil] = useState(() => lockedUntil());
  const [now, setNow] = useState(() => Date.now());
  const waiting = until > now;
  const [bio, setBio] = useState<'idle' | 'trying'>('idle');
  const [bioMsg, setBioMsg] = useState<string | null>(null);
  const [offer, setOffer] = useState<null | 'ask' | 'enrolling'>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [restore, setRestore] = useState(false);
  const trying = useRef(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [waiting]);

  const tryBiometric = async () => {
    if (trying.current || busy) return;
    trying.current = true;
    setBio('trying'); setBioMsg(null);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      await session.unlockWithBiometric(ctl.signal);
    } catch (e) {
      if (e instanceof BiometricCancelled) { /* queda el botón; la contraseña sigue debajo */ }
      else if (e instanceof BiometricStale) setBioMsg(HELP.BIO_STALE);
      else if (e instanceof BiometricUnavailable) setBioMsg(m(HELP.BIO_FAIL));
      else setBioMsg(m(HELP.BIO_FAIL));
    } finally {
      if (abort.current === ctl) abort.current = null;
      trying.current = false;
      setBio('idle');
    }
  };
  // Al abrir, o al volver tras la inactividad, se pide la verificación sin esperar un toque
  // (sólo con la pestaña a la vista; si no, en cuanto vuelva). Tras «Bloquear ahora», no.
  useEffect(() => {
    if (!s.biometric || s.lockReason === 'manual') return;
    if (document.visibilityState === 'visible') { void tryBiometric(); return; }
    const once = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', once); void tryBiometric(); } };
    document.addEventListener('visibilitychange', once);
    return () => { document.removeEventListener('visibilitychange', once); abort.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw || waiting || busy) return;
    abort.current?.abort();
    setBusy(true);
    setError(null);
    try {
      const ask = await session.shouldOfferBiometric();
      await session.unlock(pw, { hold: ask });
      setPw('');
      if (ask) setOffer('ask');
    } catch (err) {
      if (err instanceof TooManyTries) { setUntil(err.until); setNow(Date.now()); setError(null); }
      else if (err instanceof WrongPassword) { setError(T.LOCK_WRONG); const u = lockedUntil(); if (u) { setUntil(u); setNow(Date.now()); } }
      else setError(T.LOCK_OPEN_FAILED);
    } finally {
      setBusy(false);
    }
  };

  // La oferta tiene la clave en claro retenida: se cierra sola pasado un rato o al irse a
  // segundo plano, entrando como si se hubiera pulsado «Ahora no» (sin recordarlo).
  const later = (remember: boolean) => { if (remember) session.declineBiometric(); setOffer(null); session.enter(); };
  useEffect(() => {
    if (offer === null) return;
    const id = window.setTimeout(() => later(false), OFFER_MAX_MS);
    const hide = () => { if (document.visibilityState === 'hidden') later(false); };
    document.addEventListener('visibilitychange', hide);
    return () => { window.clearTimeout(id); document.removeEventListener('visibilitychange', hide); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer !== null]);

  const enroll = async () => {
    if (offer === 'enrolling') return;
    setOffer('enrolling'); setOfferError(null);
    try {
      await session.enrollBiometric();
      announce(m(HELP.BIO_ENABLED));
      setOffer(null);
      session.enter();
    } catch (e) {
      if (e instanceof BiometricUnavailable) { session.declineBiometric(); setOfferError(HELP.BIO_UNSUPPORTED); }
      else setOfferError(e instanceof BiometricCancelled ? HELP.BIO_CANCELLED_OFFER : HELP.BIO_FAIL_OFFER);
      setOffer('ask');
    }
  };

  const bioLabel = m(HELP.BIO_BUTTON);
  return (
    <div className="lock">
      <div>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <WaveMark className="t-faint" />
          <h1 className="t-title">{T.APP_NAME}</h1>
        </div>
        <p className="t-muted">{fmtDateLong(today())}</p>
      </div>
      <form onSubmit={submit}>
        {s.biometric && (
          <div className="stack" style={{ gap: 8, marginBottom: 8 }}>
            <button type="button" className="btn btn-primary btn-block" disabled={bio === 'trying' || busy} onClick={() => void tryBiometric()} autoFocus={!FINE_POINTER}>
              {bio === 'trying' ? <span className="spinner" aria-hidden="true" /> : <Icon name="lock" size={18} />} {bioLabel}
            </button>
            {bioMsg && <span className="error" role="alert">{bioMsg}</span>}
            <p className="t-foot t-muted" style={{ textAlign: 'center', margin: 0 }}>{HELP.BIO_OR_PASSWORD}</p>
          </div>
        )}
        <div className="field">
          <label htmlFor="pw">{T.LOCK_PASSWORD}</label>
          <div className="pw-wrap">
            <input id="pw" className="input" type={show && s.prefs.passwordFeedback ? 'text' : 'password'} autoComplete="current-password" autoFocus={FINE_POINTER && !s.biometric} value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="pw-help" />
            <button type="button" className="btn btn-text" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Ocultar' : 'Mostrar'}</button>
          </div>
          {error && !waiting && <span className="error" role="alert">{error}</span>}
          {waiting && <span className="error" role="status">{HELP.LOCK_WAIT.replace('{t}', fmtWait(until - now))}</span>}
        </div>
        <button className={`btn btn-block ${s.biometric ? 'btn-secondary' : 'btn-primary'}`} disabled={busy || !pw || waiting}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? T.LOCK_DERIVING : 'Entrar'}
        </button>
        <p id="pw-help" className="t-foot t-faint" style={{ textAlign: 'center' }}>
          Todo se guarda cifrado en este dispositivo. Si olvidas la contraseña, los datos no se pueden recuperar.
        </p>
      </form>
      <p className="t-foot">
        <a href="/restaurar" onClick={(e) => { e.preventDefault(); setRestore(true); }}>Restaurar una copia de seguridad</a>
      </p>
      <Sheet open={restore} onClose={() => setRestore(false)} title="Restaurar" closeLabel="Cancelar">
        <RestoreForm blob={null} setBlob={() => {}} onBack={() => setRestore(false)} onDone={() => { setRestore(false); announce('Copia restaurada.'); }} />
      </Sheet>
      <Sheet open={offer !== null} onClose={() => later(false)} title={m(HELP.BIO_OFFER_TITLE)} closeLabel="Cerrar" footer={
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" disabled={offer === 'enrolling'} onClick={() => later(true)}>{HELP.BIO_LATER}</button>
          <button className="btn btn-primary" disabled={offer === 'enrolling'} onClick={() => void enroll()}>{offer === 'enrolling' ? <span className="spinner" aria-hidden="true" /> : null} {offer === 'enrolling' ? HELP.BIO_PREPARING : HELP.BIO_ENABLE}</button>
        </div>
      }>
        <div className="stack">
          {HELP.BIO_OFFER_BODY.map((p) => <p key={p} className="t-muted">{p}</p>)}
          {offerError && <p className="error" role="alert">{offerError}</p>}
        </div>
      </Sheet>
    </div>
  );
}
