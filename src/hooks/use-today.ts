import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toISODate } from '@/domain/dates';

/**
 * Date du jour (`YYYY-MM-DD`). Se met à jour quand l'application revient au premier plan :
 * si elle est restée ouverte pendant la nuit, l'accueil passe bien au nouveau jour (ou au nouveau mois).
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toISODate(new Date()));
    });
    return () => subscription.remove();
  }, []);

  return today;
}
