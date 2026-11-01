import { HugeiconsIcon } from '@hugeicons/react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { icons, type IconName } from './icons';

/**
 * Épaisseur du trait. Les icônes Hugeicons sont dessinées pour 1,5 ; on prend 1,8 (épaisseur des maquettes) pour
 * la lisibilité à 18–24 dp. `strong` : onglet actif, coche, + et × (2,1).
 */
const STROKE = { regular: 1.8, strong: 2.1 } as const;

interface IconProps {
  name: IconName;
  /** Taille d'affichage en dp : 24 (navigation, en-têtes), 18–20 (champs, menus, boutons). */
  size?: number;
  /** Couleur du trait ; par défaut l'encre du thème. */
  color?: string;
  weight?: keyof typeof STROKE;
  /** Texte lu par TalkBack. Sans lui l'icône est décorative et ignorée des lecteurs d'écran. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Icône du design system : seul point d'entrée vers Hugeicons (catalogue dans `icons.ts`). */
export function Icon({ name, size = 24, color, weight = 'regular', label, style }: IconProps) {
  const theme = useTheme();
  const labelled = label !== undefined;

  return (
    <HugeiconsIcon
      icon={icons[name]}
      size={size}
      color={color ?? theme.colors.ink}
      strokeWidth={STROKE[weight]}
      style={style}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
    />
  );
}

export type { IconName };
