import { useCallback, useSyncExternalStore } from 'react';

import { monthKey } from '@/domain/dates';

import { useToday } from './use-today';

/**
 * Mois consulté (`YYYY-MM`), partagé par Accueil, Opérations et Budgets : choisir « septembre » dans l'un le change
 * dans les autres, comme le sélecteur de période du design. `null` = « le mois en cours », qui suit le calendrier
 * (l'application ouverte la nuit du 31 passe seule au mois suivant). Le choix est oublié à la fermeture de l'application.
 */
let selectedMonth: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSelectedMonth() {
  const today = useToday();
  const stored = useSyncExternalStore(
    subscribe,
    () => selectedMonth,
    () => null,
  );
  const currentMonth = today.slice(0, 7);
  const month = stored ?? currentMonth;

  const setMonth = useCallback((next: string) => {
    selectedMonth = next === monthKey(new Date()) ? null : next;
    listeners.forEach((listener) => listener());
  }, []);

  return { month, currentMonth, isCurrentMonth: month === currentMonth, setMonth };
}
