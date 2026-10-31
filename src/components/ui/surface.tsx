import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, type RadiusToken } from '@/theme/layout';
import type { ShadowTokens } from '@/theme/shadows';
import { useTheme } from '@/theme/use-theme';

/**
 * Variantes de surface (design/DESIGN.md §5.1) :
 *  - `card`   : surface posée niveau 1 (cartes d'Accueil, de Budgets, groupes de lignes) ;
 *  - `tile`   : tuile (catégorie, bouton retour) ;
 *  - `muted`  : surface secondaire à plat (pastille d'icône, piste), sans ombre ni bordure ;
 *  - `danger` : ligne en alerte (budget dépassé) ; couleurs d'alerte provisoires.
 */
export type SurfaceVariant = 'card' | 'tile' | 'muted' | 'danger';

interface VariantSpec {
  radius: RadiusToken;
  shadow?: keyof ShadowTokens;
}

const variants: Record<SurfaceVariant, VariantSpec> = {
  card: { radius: 'surface', shadow: 'surface' },
  tile: { radius: 'tile', shadow: 'tile' },
  muted: { radius: 'field' },
  danger: { radius: 'field' },
};

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  /** Remplace le rayon de la variante (ex. `pill` pour une pastille d'icône de 40 dp). */
  radiusToken?: RadiusToken;
  style?: StyleProp<ViewStyle>;
}

/** Fond structurant du design system : couleur, bordure fine, reflet et ombres viennent des jetons du thème. */
export function Surface({ variant = 'card', radiusToken, style, ...rest }: SurfaceProps) {
  const { colors, shadows } = useTheme();
  const spec = variants[variant];

  const look: ViewStyle =
    variant === 'muted'
      ? { backgroundColor: colors.surfaceMuted }
      : variant === 'danger'
        ? { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerLine }
        : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder };

  const base: ViewStyle = {
    ...look,
    borderRadius: radius[radiusToken ?? spec.radius],
    ...(spec.shadow ? { boxShadow: shadows[spec.shadow] } : {}),
  };

  return <View style={[base, style]} {...rest} />;
}
