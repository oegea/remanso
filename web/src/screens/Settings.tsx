import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { createPortal } from 'react-dom';
import { session } from '../app/session';
import { useSession } from '../app/useSession';
import { backupFileName, download, exportPlaintextZip } from '../app/backup';
import { Topbar } from '../ui/Topbar';
import { Icon } from '../ui/Icon';
import { Sheet, Confirm } from '../ui/Sheet';
import * as bio from '../crypto/biometric';
import { BiometricCancelled, BiometricUnavailable, methodName } from '../crypto/biometric';
import { announce } from '../ui/Live';
import { T } from '../text/texts';
import catalog from '../text/builtin.json';
import { RestoreForm } from './FirstUse';
import { storageEstimate } from '../db/store';
import { WrongPassword } from '../crypto/container';
import * as prompts from '../domain/prompts';
import { WEEKDAYS } from '../domain/dates';
import { bumpData } from '../app/useSession';
import * as safety from '../domain/safety';
import { Welcome } from './Welcome';
import { WaveMark } from '../ui/Wave';
import { ABOUT, HEALTH_NOTICE } from '../text/about';
import { HELP } from '../text/help';

type Technique = { clave: string; nombre: string; experimental: boolean; confianza: string; finalidad: string; explicacion: string; evidencia: string[]; limites?: string };

export function Settings() {
  const s = useSession();
  const [, navigate] = useLocation();
  const [sheet, setSheet] = useState<null | 'password' | 'restore' | 'export' | 'wipe' | 'about' | 'help' | 'techniques' | 'supervised' | 'biometric'>(null);
  const [agree, setAgree] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [tech, setTech] = useState<Technique | null>(null);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => { void storageEstimate().then(setEstimate); }, []);
  const prefs = s.prefs;
  const supervised = session.db ? safety.isSupervised(session.db) : false;

  const backup = async () => {
    const blob = await session.backupBlob();
    download(backupFileName(), blob);
    announce(T.BACKUP_DONE);
  };

  return (
    <div className="screen">
      <Topbar title={T.SETTINGS} />
      <div className="content screen-body stack-lg">
        <Group title="Aspecto">
          <Row label={T.SETTINGS_THEME}>
            <div className="row" role="radiogroup" aria-label={T.SETTINGS_THEME}>
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button key={t} className="chip" role="radio" aria-checked={prefs.theme === t} aria-pressed={prefs.theme === t} onClick={() => void session.setPrefs({ theme: t })}>
                  {t === 'system' ? 'sistema' : t === 'light' ? T.SETTINGS_LIGHT : T.SETTINGS_DARK}
                </button>
              ))}
            </div>
          </Row>
        </Group>

        <Group title="Preguntas y revisiones">
          <p className="t-foot t-muted" style={{ padding: '12px 0 4px' }}>{HELP.SETTINGS_REVIEWS_INTRO}</p>
          {prompts.SCHEDULES.map(([sched, label]) => {
            const on = session.db ? prompts.setEnabled(session.db, sched) : false;
            return (
              <Row key={sched} label={label + (sched === 'open' ? ' (experimental)' : '')}>
                <button className="chip" aria-pressed={on} onClick={() => { if (!session.db) return; if (on) prompts.disableSet(session.db, sched); else prompts.installSet(session.db, sched); bumpData(); setTick((x) => x + 1); }}>{on ? 'sí' : 'no'}</button>
              </Row>
            );
          })}
          <Row label={T.SETTINGS_WEEKLY_DAY}>
            <select className="input" style={{ width: 'auto' }} aria-label={T.SETTINGS_WEEKLY_DAY} value={prefs.weeklyReviewDay} onChange={(e) => void session.setPrefs({ weeklyReviewDay: Number(e.target.value) })}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </Row>
          <ActionRow label={HELP.SETTINGS_GO_REVIEW} onClick={() => navigate('/revision')} />
        </Group>

        <Group title="Seguridad">
          <Row label={T.SETTINGS_LOCK} help="Al bloquearse, la clave se olvida y hay que escribir la contraseña." wrap>
            <div className="row">
              {[0, 5, 10, 30].map((m) => (
                <button key={m} className="chip" aria-pressed={prefs.lockAfterMinutes === m} onClick={() => void session.setPrefs({ lockAfterMinutes: m })}>
                  {m === 0 ? T.SETTINGS_NEVER : `${m} ${T.SETTINGS_MINUTES}`}
                </button>
              ))}
            </div>
          </Row>
          <Row label={T.SETTINGS_PW_FEEDBACK}>
            <button className="chip" aria-pressed={prefs.passwordFeedback} onClick={() => void session.setPrefs({ passwordFeedback: !prefs.passwordFeedback })}>
              {prefs.passwordFeedback ? T.SETTINGS_YES : T.SETTINGS_NO}
            </button>
          </Row>
          <BiometricRow onEnable={() => setSheet('biometric')} />
          <ActionRow label={T.SETTINGS_CHANGE_PW} onClick={() => setSheet('password')} />
          <ActionRow label="Bloquear ahora" onClick={() => void session.lock('manual')} icon="lock" />
        </Group>

        <Group title="Datos">
          <p className="t-foot t-muted" style={{ padding: '12px 0 4px' }}>Todo vive en este navegador, cifrado{estimate ? ` (${(estimate.usage / 1024 / 1024).toFixed(1)} MB usados)` : ''}. Guarda copias fuera del dispositivo con regularidad.</p>
          <ActionRow label={T.SETTINGS_BACKUP} help="Descarga un archivo .remanso cifrado con tu contraseña." onClick={() => void backup()} icon="download" />
          <ActionRow label="Restaurar una copia" help="Sustituye los datos de este dispositivo por los de un archivo .remanso." onClick={() => setSheet('restore')} icon="upload" />
          <ActionRow label={T.SETTINGS_EXPORT} help="Markdown y JSON legibles por cualquier programa. Sin cifrar." onClick={() => setSheet('export')} />
          <ActionRow label={T.SETTINGS_CHECK} onClick={() => { try { session.db?.check(); announce(T.CHECK_OK); } catch (e) { announce(String(e)); } }} />
          <ActionRow label="Borrar todos los datos de este dispositivo" onClick={() => setSheet('wipe')} danger />
        </Group>

        <Group title="Técnicas y avisos">
          <ActionRow label={T.SETTINGS_TECHNIQUES} help="Qué hace cada técnica, de dónde viene y qué calidad tiene su evidencia." onClick={() => setSheet('techniques')} />
          <Row label={T.SUPERVISED_LABEL} help={supervised ? T.SUPERVISED_ON_NOTE : T.SUPERVISED_HELP}>
            <button className="chip" aria-pressed={supervised} onClick={() => { if (!session.db) return; if (supervised) { safety.setSupervised(session.db, false); bumpData(); setTick((x) => x + 1); } else { setAgree(false); setSheet('supervised'); } }}>{supervised ? T.SETTINGS_YES : T.SETTINGS_NO}</button>
          </Row>
          <ActionRow label={T.SETTINGS_HELP_NOW} onClick={() => setSheet('help')} icon="help" />
          <ActionRow label={T.SETTINGS_ABOUT} onClick={() => setSheet('about')} icon="info" />
        </Group>
      </div>

      <ChangePassword open={sheet === 'password'} onClose={() => setSheet(null)} />
      <BiometricEnroll open={sheet === 'biometric'} onClose={() => setSheet(null)} />
      <Sheet open={sheet === 'restore'} onClose={() => setSheet(null)} title="Restaurar" closeLabel="Cancelar">
        <RestoreForm blob={null} setBlob={() => {}} onBack={() => setSheet(null)} onDone={() => { setSheet(null); announce('Copia restaurada.'); }} />
      </Sheet>
      <ExportSheet open={sheet === 'export'} onClose={() => setSheet(null)} />
      <Confirm open={sheet === 'wipe'} onClose={() => setSheet(null)} destructive title="¿Borrar todos los datos de este dispositivo?" body="No se puede deshacer. Si no tienes una copia de seguridad, se perderá todo." confirmLabel="Borrar" onConfirm={() => void session.wipe()} />
      <Sheet open={sheet === 'supervised'} onClose={() => setSheet(null)} title={T.SUPERVISED_CONFIRM_TITLE} closeLabel="Cancelar" footer={<button className="btn btn-primary btn-block" disabled={!agree} onClick={() => { if (session.db) { safety.setSupervised(session.db, true); bumpData(); setTick((x) => x + 1); } setSheet(null); }}>{T.SUPERVISED_CONFIRM_BTN}</button>}>
        <div className="stack">
          <div className="notice"><p>{T.SUPERVISED_CONFIRM_BODY}</p></div>
          <label className="row check" style={{ alignItems: 'flex-start' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{T.SUPERVISED_CONFIRM_CHECK}</span>
          </label>
        </div>
      </Sheet>
      <Sheet open={sheet === 'about'} onClose={() => setSheet(null)} title={T.SETTINGS_ABOUT}>
        <div className="stack t-muted">
          <p><strong className="t-lead" style={{ color: 'var(--ink)' }}>Remanso</strong> · versión web {ABOUT.version}</p>
          <p>Remanso es un cuaderno personal que nació de leer con calma lo que la ciencia publicada sabe sobre cómo cambiamos: cada técnica cita los estudios de los que procede y dice cuánta confianza merece (puedes verlos en «Técnicas y su evidencia»). No hay nada que vender ni nadie que quiera que vuelvas: tus actos y tu atención son tuyos.</p>
          <p>No hay servidores, cuentas ni telemetría. Todo se guarda en este dispositivo, cifrado con tu contraseña (Argon2id para derivar la clave y AES-256-GCM para los datos, con las primitivas del propio navegador; la base es SQLite en WebAssembly, la misma que en la versión de terminal). Nadie puede leerlo, ni siquiera quien lo escribió. Por eso, si olvidas la contraseña, no hay forma de recuperar nada: descarga copias de seguridad con regularidad.</p>
          <p>Remanso se ofrece como un regalo al mundo, libre y gratis, desde la convicción de que compartir con generosidad es de lo más valioso que podemos hacer unos por otros. Si te sirve, lo mejor que puedes hacer con él es pasarlo. Es software libre con licencia {ABOUT.licence}: puedes leer el código, cambiarlo y redistribuirlo, y así seguirá siendo. Código y última versión: <a href={ABOUT.sourceUrl} target="_blank" rel="noopener noreferrer">{ABOUT.sourceUrl.replace('https://', '')}</a>.</p>
          <p>La idea y el desarrollo son de <a href={ABOUT.website} target="_blank" rel="noopener noreferrer">{ABOUT.author}</a>, pero Remanso no existiría sin las investigadoras e investigadores que estudiaron la conducta humana con rigor y publicaron lo que aprendieron. Si te ha servido o quieres contactar por cualquier motivo: <a href={`mailto:${ABOUT.contact}`}>{ABOUT.contact}</a>.</p>
          <div className="notice stack">{HEALTH_NOTICE.map((p) => <p key={p}>{p}</p>)}</div>
          <button className="btn btn-secondary btn-block" onClick={() => { setSheet(null); setShowWelcome(true); }}>Ver la presentación de nuevo</button>
        </div>
      </Sheet>
      {/* Portal: `.page` lleva will-change y convertiría el overlay fijo en relativo a la página. */}
      {showWelcome && createPortal(
        <div className="welcome-overlay" role="dialog" aria-modal="true" aria-label="Presentación">
          <div className="row" style={{ width: '100%', maxWidth: 420, justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8 }}><WaveMark className="t-faint" /><span className="t-lead" style={{ fontWeight: 600 }}>{T.APP_NAME}</span></div>
            <button className="btn btn-text" onClick={() => setShowWelcome(false)}>Cerrar</button>
          </div>
          <Welcome onDone={() => setShowWelcome(false)} doneLabel="Cerrar" extraStep={{ title: 'Una nota de salud', body: HEALTH_NOTICE }} />
        </div>,
        document.body,
      )}
      <Sheet open={sheet === 'help'} onClose={() => setSheet(null)} title={T.SETTINGS_HELP_NOW}>
        <div className="notice stack">
          <p>{T.DERIVATION_BASE}</p>
          <p>{T.DERIVATION_SUICIDAL}</p>
        </div>
      </Sheet>
      <Sheet open={sheet === 'techniques'} onClose={() => { setSheet(null); setTech(null); }} title={tech ? tech.nombre : T.SETTINGS_TECHNIQUES}>
        {tech ? (
          <div className="stack t-muted">
            <p><span className="chip is-on">Confianza {tech.confianza.toLowerCase()}</span>{tech.experimental && <span className="chip" style={{ marginLeft: 8 }}>experimental</span>}</p>
            <p style={{ color: 'var(--ink)' }}>{tech.explicacion}</p>
            <p className="t-foot" style={{ fontWeight: 600 }}>{HELP.EVIDENCE_HEAD}</p>
            <ul className="stack" style={{ gap: 4 }}>{tech.evidencia.map((e) => <li key={e}>· {e}</li>)}</ul>
            {tech.limites && <><p className="t-foot" style={{ fontWeight: 600 }}>{HELP.LIMITS_HEAD}</p><p>{tech.limites}</p></>}
            <p className="t-foot">{HELP.CONFIDENCE_LEGEND}</p>
            <button className="btn btn-text" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => setTech(null)}>Ver todas las técnicas</button>
          </div>
        ) : (
          <div className="stack">
          <p className="t-muted">{HELP.TECHNIQUES_INTRO}</p>
          <div className="list">
            {(catalog.tecnicas as Technique[]).map((t) => (
              <button key={t.clave} className="list-item" onClick={() => setTech(t)}>
                <span className="grow">
                  <span>{t.nombre}</span>
                  <span className="meta" style={{ display: 'block' }}>{t.finalidad} · confianza {t.confianza.toLowerCase()}{t.experimental ? ' · experimental' : ''}</span>
                </span>
                <Icon name="forward" className="t-faint" />
              </button>
            ))}
          </div>
          <p className="t-foot t-muted">{HELP.CONFIDENCE_LEGEND}</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`g-${title}`}>
      <h2 id={`g-${title}`} className="list-head">{title}</h2>
      <div className="card" style={{ padding: '0 var(--sp-4)' }}>{children}</div>
    </section>
  );
}

function Row({ label, help, children, wrap }: { label: string; help?: string; children: React.ReactNode; wrap?: boolean }) {
  return (
    <div className="list-item" style={{ flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: help ? 'flex-start' : 'center' }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div>{label}</div>
        {help && <div className="meta">{help}</div>}
      </div>
      {children}
    </div>
  );
}

function ActionRow({ label, help, onClick, icon, danger }: { label: string; help?: string; onClick: () => void; icon?: 'lock' | 'download' | 'upload' | 'help' | 'info'; danger?: boolean }) {
  return (
    <button className="list-item" onClick={onClick} style={danger ? { color: 'var(--danger)' } : undefined}>
      <span className="grow">
        <span>{label}</span>
        {help && <span className="meta" style={{ display: 'block', color: 'var(--ink-2)' }}>{help}</span>}
      </span>
      <Icon name={icon ?? 'forward'} className="t-faint" />
    </button>
  );
}

function ChangePassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cur, setCur] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Con el atajo biométrico activo, tras cambiar la contraseña hay que vincularlo de nuevo desde un toque.
  const [rewrap, setRewrap] = useState(false);
  useEffect(() => { if (open) { setRewrap(false); setError(null); } }, [open]);
  // Si la pantalla se desmonta con la clave retenida (navegar a otra sección), se suelta.
  useEffect(() => () => session.dropHeld(), []);
  const mn = methodName();
  const submit = async () => {
    if (a.length < 8) return setError(T.CREATE_TOO_SHORT);
    if (a !== b) return setError(T.CREATE_MISMATCH);
    setBusy(true);
    setError(null);
    try {
      const r = await session.changePassword(cur, a);
      setCur(''); setA(''); setB('');
      if (r === 'rewrap') { setRewrap(true); return; }
      announce(T.PW_CHANGED);
      onClose();
    } catch (e) {
      setError(e instanceof WrongPassword ? T.LOCK_WRONG : T.LOCK_OPEN_FAILED);
    } finally {
      setBusy(false);
    }
  };
  const keep = async () => {
    setBusy(true); setError(null);
    try { await session.rewrapBiometric(); announce(HELP.BIO_KEPT); onClose(); }
    catch (e) { setError(e instanceof BiometricCancelled ? HELP.BIO_CANCELLED : HELP.BIO_FAIL.replace('{m}', mn)); }
    finally { setBusy(false); }
  };
  const drop = async () => { session.dropHeld(); await session.disableBiometric(true); announce(`${T.PW_CHANGED} ${HELP.BIO_PW_CHANGED_OFF}`); onClose(); };
  // Cerrar la hoja a medias equivale a quitar el atajo: la clave retenida no se queda en memoria.
  const close = () => { if (rewrap) void drop(); else onClose(); };
  return (
    <Sheet open={open} onClose={close} title={rewrap ? HELP.BIO_REWRAP_TITLE.replace('{m}', mn) : T.SETTINGS_CHANGE_PW} closeLabel={rewrap ? HELP.BIO_DROP : 'Cancelar'} footer={
      rewrap
        ? <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-secondary" disabled={busy} onClick={() => void drop()}>{HELP.BIO_DROP}</button><button className="btn btn-primary" disabled={busy} onClick={() => void keep()}>{busy ? HELP.BIO_PREPARING : HELP.BIO_KEEP}</button></div>
        : <button className="btn btn-primary btn-block" disabled={busy} onClick={() => void submit()}>{busy ? T.LOCK_DERIVING : 'Cambiar'}</button>
    }>
      {rewrap ? (
        <div className="stack"><p className="t-muted">{HELP.BIO_REWRAP_BODY}</p>{error && <span className="error" role="alert">{error}</span>}</div>
      ) : (
        <div className="stack">
          <div className="field"><label htmlFor="c0">{T.PW_CURRENT}</label><input id="c0" className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="field"><label htmlFor="c1">{T.PW_NEW}</label><input id="c1" className="input" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div className="field"><label htmlFor="c2">{T.PW_REPEAT}</label><input id="c2" className="input" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />{error && <span className="error" role="alert">{error}</span>}</div>
        </div>
      )}
    </Sheet>
  );
}

/** Fila «Entrar con Face ID…»: sí/no, con la disponibilidad real del navegador. */
function BiometricRow({ onEnable }: { onEnable: () => void }) {
  const s = useSession();
  const [avail, setAvail] = useState<bio.Availability | null>(null);
  useEffect(() => { void bio.available().then(setAvail); }, []);
  const label = HELP.BIO_ROW.replace('{m}', methodName());
  if (avail === 'no' && !s.biometric) return <Row label={label} help={HELP.BIO_NA}><button className="chip" disabled aria-pressed={false}>{T.SETTINGS_NO}</button></Row>;
  return (
    <Row label={label} help={avail === 'maybe' && !s.biometric ? `${HELP.BIO_ROW_HELP} ${HELP.BIO_MAYBE_HELP}` : HELP.BIO_ROW_HELP}>
      <button className="chip" aria-pressed={s.biometric} disabled={avail === null && !s.biometric} onClick={() => { if (s.biometric) { void session.disableBiometric(true).then(() => announce(HELP.BIO_DISABLED)); } else onEnable(); }}>
        {s.biometric ? T.SETTINGS_YES : T.SETTINGS_NO}
      </button>
    </Row>
  );
}

/**
 * Alta desde Ajustes en dos pasos: la contraseña (prueba de que es la persona; Argon2 tarda
 * unos segundos) y, ya comprobada, un toque que lanza la verificación del sistema. Así la
 * llamada WebAuthn sale de un gesto reciente, que algunos navegadores exigen.
 */
function BiometricEnroll({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [step, setStep] = useState<'password' | 'link'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mn = methodName();
  useEffect(() => { if (open) { setPw(''); setStep('password'); setError(null); } }, [open]);
  useEffect(() => () => session.dropHeld(), []);
  const close = () => { session.dropHeld(); onClose(); };
  const check = async () => {
    if (!pw || busy) return;
    setBusy(true); setError(null);
    try { await session.holdPassword(pw); setPw(''); setStep('link'); }
    catch (e) { setError(e instanceof WrongPassword ? T.LOCK_WRONG : T.LOCK_OPEN_FAILED); }
    finally { setBusy(false); }
  };
  const link = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await session.enrollBiometric(); announce(HELP.BIO_ENABLED.replace('{m}', mn)); onClose(); }
    catch (e) { setError(e instanceof BiometricCancelled ? HELP.BIO_CANCELLED : e instanceof BiometricUnavailable ? HELP.BIO_UNSUPPORTED : HELP.BIO_FAIL.replace('{m}', mn)); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={close} title={HELP.BIO_ROW.replace('{m}', mn)} closeLabel="Cancelar" footer={
      step === 'password'
        ? <button className="btn btn-primary btn-block" disabled={busy || !pw} onClick={() => void check()}>{busy ? T.LOCK_DERIVING : 'Continuar'}</button>
        : <button className="btn btn-primary btn-block" disabled={busy} onClick={() => void link()}>{busy ? HELP.BIO_PREPARING : HELP.BIO_LINK.replace('{m}', mn)}</button>
    }>
      <div className="stack">
        {HELP.BIO_OFFER_BODY.map((p) => <p key={p} className="t-muted">{p}</p>)}
        {step === 'password'
          ? <div className="field"><label htmlFor="bio-pw">{HELP.BIO_PW_PROMPT}</label><input id="bio-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void check(); }} />{error && <span className="error" role="alert">{error}</span>}</div>
          : <div className="stack"><p role="status">{HELP.BIO_PW_OK}</p>{error && <span className="error" role="alert">{error}</span>}</div>}
      </div>
    </Sheet>
  );
}

function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const go = () => {
    if (!session.db) return;
    const zip = exportPlaintextZip(session.db);
    download(backupFileName().replace('.remanso', '-exportacion.zip'), zip, 'application/zip');
    announce(T.EXPORT_DONE);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={T.SETTINGS_EXPORT} closeLabel="Cancelar" footer={
      step === 0
        ? <button className="btn btn-secondary btn-block" onClick={() => setStep(1)}>Entiendo, continuar</button>
        : <button className="btn btn-primary btn-block" onClick={go}>Descargar en claro</button>
    }>
      <div className="notice is-warn stack">
        <p>{T.EXPORT_CONFIRM}</p>
        {step === 1 && <p>El archivo zip contendrá todo tu diario y tus notas legibles por cualquiera que lo abra. Guárdalo en un lugar seguro o bórralo después de usarlo.</p>}
      </div>
    </Sheet>
  );
}
