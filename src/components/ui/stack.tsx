import { View, type ViewProps, type ViewStyle } from 'react-native';

import { spacing, type SpacingToken } from '@/theme/layout';

export interface StackProps extends ViewProps {
  /** Écart entre enfants, en jeton d'espacement (xs = 8, md = 16, xl = 24…). */
  gap?: SpacingToken;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  /** Retrait intérieur uniforme, en jeton d'espacement. */
  padding?: SpacingToken;
}

/** Colonne à écart régulier : primitive de mise en page, évite les marges codées en dur dans les écrans. */
export function Stack({ gap = 'md', align, justify, padding, style, ...rest }: StackProps) {
  return (
    <View
      style={[
        { gap: spacing[gap], alignItems: align, justifyContent: justify, padding: padding ? spacing[padding] : undefined },
        style,
      ]}
      {...rest}
    />
  );
}

/** Ligne à écart régulier, alignée au centre par défaut. */
export function Row({ gap = 'sm', align = 'center', justify, padding, style, ...rest }: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: spacing[gap],
          alignItems: align,
          justifyContent: justify,
          padding: padding ? spacing[padding] : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
}
