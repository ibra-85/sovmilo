import type { BoxShadowValue, ViewStyle } from 'react-native';

import { darken } from '@/theme/color-utils';
import type { Theme } from '@/theme/use-theme';

/**
 * Apparence d'un bouton selon sa variante et son état (design/DESIGN.md §6). Fonction pure : testée sans rendu.
 *
 *  - `primary`     : graphite en clair, citron en sombre ; matière en couches (reflet, contour, double ombre) ;
 *  - `secondary`   : surface de contenu + bordure + ombre de tuile ;
 *  - `destructive` : fond d'alerte DOUX, jamais un grand bouton rouge plein (décision validée).
 *
 * États : repos, pressé (teinte −6 %, ombre portée réduite), désactivé (couleurs dédiées, sans ombre), focus (anneau).
 * Désactivé et chargement sont des PROPOSITIONS du design (non dessinés).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface ButtonState {
  pressed: boolean;
  disabled: boolean;
  focused: boolean;
}

export interface ButtonLook {
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  boxShadow: BoxShadowValue[];
}

/** Anneau de focus de 3 dp, sans espace : visible au clavier, au D-pad et avec TalkBack. */
function focusRing(theme: Theme): BoxShadowValue {
  return { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3, color: theme.colors.fieldFocusBorder };
}

export function buttonLook(theme: Theme, variant: ButtonVariant, state: ButtonState): ButtonLook {
  const { colors, shadows } = theme;
  const ring = state.focused && !state.disabled ? [focusRing(theme)] : [];

  if (state.disabled) {
    return {
      backgroundColor: colors.disabled,
      textColor: colors.onDisabled,
      borderColor: variant === 'secondary' ? colors.surfaceBorder : undefined,
      boxShadow: ring,
    };
  }

  switch (variant) {
    case 'primary':
      return {
        backgroundColor: state.pressed ? darken(colors.primary, 0.06) : colors.primary,
        textColor: colors.onPrimary,
        boxShadow: [...(state.pressed ? shadows.primaryPressed : shadows.primary), ...ring],
      };
    case 'secondary':
      return {
        backgroundColor: state.pressed ? colors.surfaceMuted : colors.surface,
        textColor: colors.text,
        borderColor: colors.surfaceBorder,
        // Pressé : on garde le reflet, on retire l'ombre portée.
        boxShadow: [...(state.pressed ? shadows.tile.filter((layer) => layer.inset) : shadows.tile), ...ring],
      };
    case 'destructive':
      return {
        backgroundColor: state.pressed ? colors.dangerLine : colors.dangerSoft,
        textColor: colors.danger,
        borderColor: colors.dangerBorder,
        boxShadow: ring,
      };
  }
}

/** Style React Native correspondant (bordure d'un dp quand le bouton en a une). */
export function buttonLookToStyle(look: ButtonLook): ViewStyle {
  return {
    backgroundColor: look.backgroundColor,
    borderColor: look.borderColor,
    borderWidth: look.borderColor ? 1 : 0,
    boxShadow: look.boxShadow,
  };
}
