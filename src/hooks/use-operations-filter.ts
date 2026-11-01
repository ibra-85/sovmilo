import { useCallback, useSyncExternalStore } from 'react';

/** Filtre de l'onglet Opérations : tout, dépenses seules ou revenus seuls. */
export type OperationsTypeFilter = 'all' | 'expense' | 'income';

/**
 * Filtre de type de l'onglet Opérations, partagé : l'Accueil peut l'activer (toucher « Revenus » ou « Dépenses ») avant
 * d'ouvrir l'onglet, qui reste ensuite modifiable normalement. Même principe que `use-selected-month` : un petit état de
 * module, aucune nouvelle route ni nouvel écran. Oublié à la fermeture de l'application.
 */
let current: OperationsTypeFilter = 'all';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Change le filtre depuis n'importe où (écran d'Accueil, filtre d'Opérations). */
export function setOperationsTypeFilter(next: OperationsTypeFilter): void {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export function useOperationsTypeFilter(): [OperationsTypeFilter, (next: OperationsTypeFilter) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'all' as OperationsTypeFilter,
  );
  const set = useCallback((next: OperationsTypeFilter) => setOperationsTypeFilter(next), []);
  return [value, set];
}
