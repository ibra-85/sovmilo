import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

import { refreshAllData } from '@/db/refresh-data';
import { useToast } from '@/components/ui';
import { useTheme } from '@/theme/use-theme';

import { usePullRefresh } from './use-pull-refresh';

/**
 * « Tirer pour actualiser » d'un écran de données : relit RÉELLEMENT toutes les requêtes SQLite en direct (`refreshLiveData`),
 * attend leur rendu, et signale l'échec d'une requête par une notification. Rien n'est écrit en base ; filtres, recherche, mois
 * consulté et ordre restent ceux de l'écran (ils vivent dans son état, pas dans les données).
 *
 * `refreshControl` est un VRAI `RefreshControl` de React Native, à passer tel quel à la prop `refreshControl` d'un `ScrollView` ou
 * d'un `FlatList`. Ne jamais le remplacer par un composant maison : sur Android, React Native clone cet élément et lui donne le
 * défilement comme ENFANT (`cloneElement(refreshControl, { style }, <ScrollView/>)` : un composant qui n'affiche pas ses enfants
 * fait disparaître tout le contenu de l'écran, c'était la cause du Hotfix 6.2.1).
 *
 * `before` : travail propre à l'écran, fait AVANT la relecture (relire la date du jour, compléter les échéances de Factures) ;
 * s'il échoue, l'actualisation échoue. `enabled: false` (réorganisation en cours) rend le geste sans effet.
 */
export function useDataRefresh(options: { enabled?: boolean; before?: () => void | Promise<void> } = {}) {
  const { enabled = true, before } = options;
  const { t } = useTranslation();
  const toast = useToast();
  const { colors } = useTheme();

  const task = useCallback(() => refreshAllData(before), [before]);

  const onError = useCallback(() => toast.show({ message: t('common.refreshFailed') }), [toast, t]);

  const { refreshing, onRefresh } = usePullRefresh(task, { enabled, onError });

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      enabled={enabled}
      colors={[colors.ink]}
      tintColor={colors.ink}
      progressBackgroundColor={colors.surface}
    />
  );

  return { refreshing, onRefresh, refreshControl };
}
