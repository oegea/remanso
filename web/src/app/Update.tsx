/**
 * Aviso de versión nueva. El service worker se registra en modo «prompt»: la versión nueva
 * se descarga en segundo plano y espera; aquí se avisa y la persona decide cuándo
 * actualizar (nunca a mitad de una entrada o de una sesión). Además se comprueba si hay
 * novedades al volver a la aplicación y cada hora, porque en un iPhone instalado en la
 * pantalla de inicio la página puede vivir días sin recargarse.
 */
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { HELP } from '../text/help';

const CHECK_EVERY = 60 * 60 * 1000;

export function UpdateBanner() {
  const [later, setLater] = useState(false);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return;
      const check = () => { if (document.visibilityState === 'visible') void r.update().catch(() => {}); };
      window.setInterval(check, CHECK_EVERY);
      document.addEventListener('visibilitychange', check);
      window.addEventListener('focus', check);
    },
  });
  // Si llega otra versión después de haber pulsado «Luego», se vuelve a avisar.
  useEffect(() => { if (!needRefresh) setLater(false); }, [needRefresh]);
  if (!needRefresh || later) return null;
  return (
    <div className="update" role="status">
      <span className="grow">{HELP.UPDATE_READY}</span>
      <button className="btn btn-text" onClick={() => setLater(true)}>{HELP.UPDATE_LATER}</button>
      <button className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>{HELP.UPDATE_NOW}</button>
    </div>
  );
}
