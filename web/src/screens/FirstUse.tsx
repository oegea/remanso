import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { session } from '../app/session';
import { T } from '../text/texts';
import { WaveMark } from '../ui/Wave';
import { readHeader, WrongPassword } from '../crypto/container';
import { Welcome } from './Welcome';
import { HEALTH_NOTICE, PRIVACY_NOTICE } from '../text/about';
import { FINE_POINTER } from '../ui/env';

export function FirstUse() {
  const [step, setStep] = useState<'welcome' | 0 | 1 | 2>('welcome');
  const [restore, setRestore] = useState<Uint8Array | null>(null);
  useEffect(() => {
    const f = () => setStep(2);
    window.addEventListener('remanso:restore', f);
    return () => window.removeEventListener('remanso:restore', f);
  }, []);
  return (
    <div className="lock" style={{ justifyContent: 'flex-start', paddingTop: 'max(48px, 10dvh)' }}>
      <div className="row" style={{ gap: 8 }}>
        <WaveMark className="t-faint" />
        <h1 className="t-title">{T.APP_NAME}</h1>
      </div>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'left' }}>
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.section key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.24 }}>
              <Welcome onDone={() => setStep(0)} onSkip={() => setStep(0)} />
            </motion.section>
          )}
          {step === 0 && (
            <motion.section key="intro" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.24 }} className="stack-lg">
              <h2 className="t-lead" style={{ fontWeight: 600 }}>Antes de empezar</h2>
              <div className="notice stack">{HEALTH_NOTICE.map((p) => <p key={p}>{p}</p>)}</div>
              <div className="notice stack"><p>{PRIVACY_NOTICE}</p></div>
              <button className="btn btn-primary btn-block" onClick={() => setStep(1)}>Entendido</button>
              <button className="btn btn-text btn-block" onClick={() => setStep(2)}>Tengo una copia de seguridad</button>
            </motion.section>
          )}
          {step === 1 && (
            <motion.section key="pw" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.24 }}>
              <PasswordForm />
            </motion.section>
          )}
          {step === 2 && (
            <motion.section key="restore" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.24 }}>
              <RestoreForm blob={restore} setBlob={setRestore} onBack={() => setStep(0)} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (a.length < 8) return setError(T.CREATE_TOO_SHORT);
    if (a !== b) return setError(T.CREATE_MISMATCH);
    setBusy(true);
    setError(null);
    try {
      await session.create(a);
    } catch (err) {
      setError(String(err));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="stack">
      <h2 className="t-lead" style={{ fontWeight: 600 }}>Tu contraseña</h2>
      <p className="t-muted">Mínimo 8 caracteres. No se guarda en ningún sitio: si la olvidas, los datos no se pueden recuperar.</p>
      <div className="field">
        <label htmlFor="pw1">{T.CREATE_PASSWORD}</label>
        <input id="pw1" className="input" type="password" autoComplete="new-password" autoFocus={FINE_POINTER} value={a} onChange={(e) => setA(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pw2">{T.CREATE_REPEAT}</label>
        <input id="pw2" className="input" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
        {error && <span className="error" role="alert">{error}</span>}
      </div>
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? T.CREATE_WORKING : 'Crear'}</button>
    </form>
  );
}

export function RestoreForm({ blob, setBlob, onBack, onDone }: { blob: Uint8Array | null; setBlob: (b: Uint8Array | null) => void; onBack: () => void; onDone?: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string>('');
  const pick = async (f: File | undefined) => {
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    try {
      const h = readHeader(bytes);
      const saved = typeof h.meta.saved_at === 'number' ? new Date(h.meta.saved_at * 1000).toLocaleString('es-ES') : '';
      setMeta(`Copia válida${saved ? ' · guardada el ' + saved : ''}`);
      setBlob(bytes);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message));
      setBlob(null);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!blob) return;
    setBusy(true);
    setError(null);
    try {
      await session.restore(blob, pw);
      onDone?.();
    } catch (err) {
      setError(err instanceof WrongPassword ? T.LOCK_WRONG : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="stack">
      <h2 className="t-lead" style={{ fontWeight: 600 }}>Restaurar una copia</h2>
      <p className="t-muted">Elige un archivo <code>.remanso</code> y escribe la contraseña con la que se creó. Sustituirá los datos de este dispositivo.</p>
      <div className="field">
        <label htmlFor="file">Archivo</label>
        <input id="file" className="input" type="file" accept=".remanso,application/octet-stream" onChange={(e) => void pick(e.target.files?.[0])} />
        {meta && <span className="help">{meta}</span>}
      </div>
      <div className="field">
        <label htmlFor="rpw">{T.LOCK_PASSWORD}</label>
        <input id="rpw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {error && <span className="error" role="alert">{error}</span>}
      </div>
      <button className="btn btn-primary btn-block" disabled={busy || !blob || !pw}>{busy ? T.LOCK_DERIVING : 'Restaurar'}</button>
      <button type="button" className="btn btn-text btn-block" onClick={onBack}>Volver</button>
    </form>
  );
}
