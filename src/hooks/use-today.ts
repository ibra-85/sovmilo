import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toISODate } from '@/domain/dates';

/**
 * Date du jour (`YYYY-MM-DD`) et moyen de la relire : se met à jour quand l'application revient au premier plan (si elle est
 * restée ouverte pendant la nuit, l'écran passe bien au nouveau jour ou au nouveau mois), ou sur demande avec `refresh`
 * (« tirer pour actualiser »), qui renvoie la date relue.
 */
export function useTodayClock(): { today: string; refresh: () => string } {
  const [today, setToday] = useState(() => toISODate(new Date()));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toISODate(new Date()));
    });
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(() => {
    const now = toISODate(new Date());
    setToday(now);
    return now;
  }, []);

  return { today, refresh };
}

/** Date du jour (`YYYY-MM-DD`), mise à jour au retour au premier plan. */
export function useToday(): string {
  return useTodayClock().today;
}
