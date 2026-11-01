import type { StyleProp, ViewStyle } from 'react-native';

import { radius, sizes, touchSlop } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { buttonLook, buttonLookToStyle, type ButtonVariant } from './button-look';
import { Icon, type IconName } from './icon';
import { Pressable } from './pressable';
import { Spinner } from './spinner';
import { Text } from './text';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** `compact` : 36 dp, pour « + Créer un budget ». La zone tactile reste de 48 dp. */
  size?: 'default' | 'compact';
  icon?: IconName;
  /** Action en cours : le libellé reste, l'icône devient un indicateur, le bouton ne répond plus. */
  loading?: boolean;
  disabled?: boolean;
  /** Lu par TalkBack à la place du libellé (ex. « Enregistrer la dépense »). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bouton du design system (PremiumButton, boutons secondaire, destructif et compact).
 * La matière (reflet, contour, ombres) et les états viennent de `buttonLook` ; ce composant ne fait que l'assembler.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const compact = size === 'compact';
  const inactive = disabled || loading;
  const height = compact
    ? sizes.buttonCompactHeight
    : variant === 'primary'
      ? sizes.buttonHeight
      : sizes.buttonSecondaryHeight;
  const iconSize = compact ? 18 : 20;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={compact ? touchSlop(sizes.minTouch, height) : undefined}
      onPress={onPress}
      style={({ pressed, focused }) => [
        {
          minHeight: height,
          borderRadius: compact ? radius.pill : variant === 'primary' ? radius.button : radius.field,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: compact ? 14 : 20,
          // Un libellé russe long peut passer sur deux lignes : la hauteur est un minimum, pas une contrainte.
          paddingVertical: compact ? 0 : 8,
          alignSelf: compact ? 'flex-start' : 'stretch',
        },
        buttonLookToStyle(buttonLook(theme, variant, { pressed, disabled: disabled && !loading, focused })),
        style,
      ]}>
      {({ pressed, focused }) => {
        const look = buttonLook(theme, variant, { pressed, disabled: disabled && !loading, focused });
        return (
          <>
            {loading ? (
              <Spinner size={iconSize} color={look.textColor} />
            ) : icon ? (
              <Icon name={icon} size={iconSize} color={look.textColor} weight="strong" />
            ) : null}
            <Text
              variant={compact ? 'secondaryStrong' : 'bodyStrong'}
              style={{ color: look.textColor, flexShrink: 1, textAlign: 'center' }}>
              {label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}
