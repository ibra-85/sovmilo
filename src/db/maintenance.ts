import { useSyncExternalStore } from 'react';

/**
 * « Maintenance » de la base : sauvegarde ou restauration en cours. Tant qu'elle dure, une seule opération à la fois, et rien ne doit
 * redémarrer l'interface (mise à jour) ni lancer une seconde opération. Module sans dépendance native : testé à part.
 */
export type MaintenanceKind = 'backup' | 'restore';

let current: MaintenanceKind | null = null;
const listeners = new Set<() => void>();

/** Démarre une maintenance. Faux (rien n'est démarré) si une autre est déjà en cours. */
export function beginMaintenance(kind: MaintenanceKind): boolean {
  if (current !== null) return false;
  current = kind;
  listeners.forEach((listener) => listener());
  return true;
}

export function endMaintenance(): void {
  if (current === null) return;
  current = null;
  listeners.forEach((listener) => listener());
}

export function currentMaintenance(): MaintenanceKind | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMaintenance(): MaintenanceKind | null {
  return useSyncExternalStore(subscribe, currentMaintenance, () => null);
}
