import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { GLASS_SHEEN_HEIGHT, glassRecipes, type GlassRecipe, type GlassVariant } from '@/theme/glass';
import type { ShadowTokens } from '@/theme/shadows';
import { useTheme } from '@/theme/use-theme';

/** Style de fond + contour d'un élément flottant. À poser sur n'importe quelle vue (y compris une `Animated.View`). */
export function useGlassLook(variant: GlassVariant): { recipe: GlassRecipe; style: ViewStyle } {
  const { name } = useTheme();
  const recipe = glassRecipes[name][variant];
  return { recipe, style: { backgroundColor: recipe.fill, borderWidth: 1, borderColor: recipe.border } };
}

interface GlassOverlayProps {
  variant: GlassVariant;
  /** Rayon des coins de l'élément qui porte le verre (le reflet est découpé à la même forme). */
  radius: number;
  /** Panneau collé au bord bas de l'écran : coins bas droits. */
  squareBottom?: boolean;
}

/**
 * Reflet et liseré d'un élément flottant : une couche décorative posée dans l'élément (`position: absolute`), sans
 * toucher ni aux gestes ni aux lecteurs d'écran. Le reflet est un dégradé qui descend du bord supérieur (72 dp au plus) ;
 * le liseré est un trait d'un pixel, plus clair au centre, qui s'efface vers les coins.
 */
export function GlassOverlay({ variant, radius, squareBottom = false }: GlassOverlayProps) {
  const { name } = useTheme();
  const { sheen, rim } = glassRecipes[name][variant];
  const bottomRadius = squareBottom ? 0 : radius;
  // Identifiants fixes par thème et par variante : toutes les instances ont des dégradés identiques.
  const sheenId = `glass-sheen-${name}-${variant}`;
  const rimId = `glass-rim-${name}-${variant}`;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: GLASS_SHEEN_HEIGHT,
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: bottomRadius,
        borderBottomRightRadius: bottomRadius,
        overflow: 'hidden',
      }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sheen.color} stopOpacity={sheen.opacity} />
            <Stop offset="1" stopColor={sheen.color} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={rimId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={rim.color} stopOpacity={0} />
            <Stop offset="0.5" stopColor={rim.color} stopOpacity={rim.opacity} />
            <Stop offset="1" stopColor={rim.color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${sheenId})`} />
        <Rect x="0" y="0" width="100%" height="1" fill={`url(#${rimId})`} />
      </Svg>
    </View>
  );
}

export interface GlassSurfaceProps extends ViewProps {
  variant: GlassVariant;
  radius: number;
  /** Ombres de l'élément (jetons `shadows`). */
  shadow?: ShadowTokens[keyof ShadowTokens];
  squareBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Surface flottante « verre » : fond semi-opaque + contour lumineux + reflet + ombres douces. Les éléments animés par
 * Reanimated (panneau inférieur, menus) appliquent plutôt `useGlassLook` à leur propre vue animée et y posent un `GlassOverlay`.
 */
export function GlassSurface({ variant, radius, shadow, squareBottom = false, style, children, ...rest }: GlassSurfaceProps) {
  const { style: look } = useGlassLook(variant);

  return (
    <View
      style={[
        look,
        {
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderBottomLeftRadius: squareBottom ? 0 : radius,
          borderBottomRightRadius: squareBottom ? 0 : radius,
          boxShadow: shadow,
        },
        style,
      ]}
      {...rest}>
      <GlassOverlay variant={variant} radius={radius} squareBottom={squareBottom} />
      {children}
    </View>
  );
}
