import type { StyleProp, ViewStyle } from 'react-native';

import { radius, sizes, touchSlop } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { Pressable } from './pressable';

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  /** Obligatoire : un bouton sans texte doit toujours avoir un nom pour TalkBack (« Retour au budget », « Plus d'actions »…). */
  label: string;
  /** Ouvre un menu : annoncé « développé / réduit ». */
  expanded?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Bouton retour et bouton « ⋯ » : 44 dp, surface de contenu + bordure + ombre de tuile ; zone tactile portée à 48 dp. */
export function IconButton({ icon, onPress, label, expanded, disabled = false, style }: IconButtonProps) {
  const { colors, shadows } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      hitSlop={touchSlop(sizes.iconButton)}
      onPress={onPress}
      style={({ pressed, focused }) => [
        {
          width: sizes.iconButton,
          height: sizes.iconButton,
          borderRadius: radius.iconButton,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          boxShadow: [
            ...(pressed ? shadows.tile.filter((layer) => layer.inset) : shadows.tile),
            ...(focused
              ? [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3, color: colors.fieldFocusBorder }]
              : []),
          ],
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}>
      <Icon name={icon} size={22} color={colors.ink} />
    </Pressable>
  );
}
