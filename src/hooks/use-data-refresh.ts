import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { refreshAllData } from '@/db/refresh-data';
import { useToast } from '@/components/ui';

import { usePullRefresh } from './use-pull-refresh';

/**
 * « Tirer pour actualiser » d'un écran de données : relit RÉELLEMENT toutes les requêtes SQLite en direct (`refreshLiveData`),
 * attend leur rendu, et signale l'échec d'une requête par une notification. Rien n'est écrit en base ; filtres, recherche, mois
 * consulté et ordre restent ceux de l'écran (ils vivent dans son état, pas dans les données).
 *
 * `before` : travail propre à l'écran, fait AVANT la relecture (relire la date du jour, compléter les échéances de Factures) ;
 * s'il échoue, l'actualisation échoue. `enabled: false` (réorganisation en cours) rend le geste sans effet.
 */
export function useDataRefresh(options: { enabled?: boolean; before?: () => void | Promise<void> } = {}) {
  const { enabled = true, before } = options;
  const { t } = useTranslation();
  const toast = useToast();

  const task = useCallback(() => refreshAllData(before), [before]);

  const onError = useCallback(() => toast.show({ message: t('common.refreshFailed') }), [toast, t]);

  return usePullRefresh(task, { enabled, onError });
}
