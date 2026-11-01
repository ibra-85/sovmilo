import { View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

interface DividerProps {
  /** Retrait à gauche : 64 dp entre deux champs d'un groupe (sous l'icône), 0 pour un filet pleine largeur. */
  inset?: number;
}

/** Filet de séparation d'un pixel logique (jeton `hairline`). Les groupes de jours, eux, se séparent par l'espace. */
export function Divider({ inset = 0 }: DividerProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ height: 1, marginLeft: inset, backgroundColor: colors.hairline }}
    />
  );
}
