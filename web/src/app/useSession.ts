import { useSyncExternalStore } from 'react';
import { session, type SessionState } from './session';

export function useSession(): SessionState {
  return useSyncExternalStore(
    (l) => session.subscribe(l),
    () => session.state,
    () => session.state,
  );
}

/** Acceso a la base con re-render cuando cambie algo (versión incremental). */
let version = 0;
const listeners = new Set<() => void>();
export function bumpData() {
  version++;
  for (const l of listeners) l();
}
export function useDataVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => version,
  );
}
