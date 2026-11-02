import { RefreshControl } from 'react-native';

import { useTheme } from '@/theme/use-theme';

interface DataRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
  /** Faux : le geste est désactivé (réorganisation en cours : le glissement a la priorité). */
  enabled?: boolean;
}

/** `RefreshControl` aux couleurs du design : indicateur encre sur fond de surface, identique sur tous les écrans de données. */
export function DataRefreshControl({ refreshing, onRefresh, enabled = true }: DataRefreshControlProps) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      enabled={enabled}
      colors={[colors.ink]}
      tintColor={colors.ink}
      progressBackgroundColor={colors.surface}
    />
  );
}
