import { useState, type FormEvent } from 'react';
import { session } from '../app/session';
import { useSession } from '../app/useSession';
import { WrongPassword } from '../crypto/container';
import { fmtDateLong, today } from '../domain/dates';
import { T } from '../text/texts';
import { WaveMark } from '../ui/Wave';

export function Lock() {
  const s = useSession();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setError(null);
    try {
      await session.unlock(pw);
      setPw('');
    } catch (err) {
      setError(err instanceof WrongPassword ? T.LOCK_WRONG : String(err));
    } finally {
      setBusy(false);
    }
  };

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
        <div className="field">
          <label htmlFor="pw">{T.LOCK_PASSWORD}</label>
          <div className="pw-wrap">
            <input id="pw" className="input" type={show && s.prefs.passwordFeedback ? 'text' : 'password'} autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="pw-help" />
            <button type="button" className="btn btn-text" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Ocultar' : 'Mostrar'}</button>
          </div>
          {error && <span className="error" role="alert">{error}</span>}
        </div>
        <button className="btn btn-primary btn-block" disabled={busy || !pw}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? T.LOCK_DERIVING : 'Entrar'}
        </button>
        <p id="pw-help" className="t-foot t-faint" style={{ textAlign: 'center' }}>
          Todo se guarda cifrado en este dispositivo. Si olvidas la contraseña, los datos no se pueden recuperar.
        </p>
      </form>
      <RestoreLink />
    </div>
  );
}

function RestoreLink() {
  return (
    <p className="t-foot">
      <a href="/restaurar" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('remanso:restore')); }}>Restaurar una copia de seguridad</a>
    </p>
  );
}
