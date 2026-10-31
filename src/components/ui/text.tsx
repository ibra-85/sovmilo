import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import type { ColorTokens } from '@/theme/tokens';
import { maxFontScale, typography, type TypographyVariant } from '@/theme/typography';
import { useTheme } from '@/theme/use-theme';

/** Rôles de couleur du texte : jamais de code couleur dans un écran. */
export type TextTone = 'default' | 'muted' | 'danger' | 'onPrimary' | 'selected';

const toneToken: Record<TextTone, keyof ColorTokens> = {
  default: 'text',
  muted: 'textMuted',
  danger: 'danger',
  onPrimary: 'onPrimary',
  selected: 'selectedIcon',
};

export interface TextProps extends NativeTextProps {
  /** Rôle typographique (échelle de design/DESIGN.md §3.2). */
  variant?: TypographyVariant;
  tone?: TextTone;
}

/** Texte du design system : Inter, rôle typographique + rôle de couleur, taille système plafonnée pour les grands montants. */
export function Text({ variant = 'body', tone = 'default', style, maxFontSizeMultiplier, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <NativeText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? maxFontScale[variant]}
      style={[typography[variant], { color: colors[toneToken[tone]] }, style]}
      {...rest}
    />
  );
}
