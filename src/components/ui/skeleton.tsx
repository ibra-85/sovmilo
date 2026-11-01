import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { rowMetrics } from './row-metrics';
import { Surface } from './surface';

interface SkeletonProps {
  width: DimensionValue;
  height: number;
  /** Rond (icône d'opération) au lieu du rayon 8 du design. */
  round?: boolean;
  borderRadius?: number;
}

/**
 * Bloc de remplissage pendant le chargement (jeton `skeleton`, rayon 8). Il apparaît en fondu (150 ms) pour ne pas
 * clignoter quand les données arrivent vite, puis reste STATIQUE : pas de reflet qui balaie, pas de pulsation
 * (principe « pas de mouvement permanent » de design/MOTION.md). Ignoré des lecteurs d'écran : l'état de chargement
 * est annoncé par le conteneur (`ListSkeleton`).
 */
export function Skeleton({ width, height, round = false, borderRadius = radius.progress }: SkeletonProps) {
  const { colors } = useTheme();
  const { timing } = useMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, timing('enter', 'skeletonFadeIn', 'fade'));
  }, [opacity, timing]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: round ? radius.full : borderRadius, backgroundColor: colors.skeleton },
        style,
      ]}
    />
  );
}

/** Squelette d'une ligne d'opération : mêmes icône, espacements et hauteur que `TransactionRow`. */
export function TransactionRowSkeleton({ titleWidth = '58%' }: { titleWidth?: DimensionValue }) {
  const { icon, paddingVertical, height } = rowMetrics.transaction;
  return (
    <View
      style={{ height, paddingVertical, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Skeleton width={icon} height={icon} round />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width={titleWidth} height={14} />
        <Skeleton width="36%" height={11} />
      </View>
      <Skeleton width={64} height={14} />
    </View>
  );
}

/** Squelette d'une ligne de budget : même surface, mêmes marges et même hauteur que `BudgetRow`. */
export function BudgetRowSkeleton() {
  const { icon, padding, height, gap, bar } = rowMetrics.budget;
  return (
    <Surface
      variant="card"
      radiusToken="field"
      style={{ height, padding, flexDirection: 'row', gap: 14 }}>
      <Skeleton width={icon} height={icon} borderRadius={radius.pill} />
      <View style={{ flex: 1, gap }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="100%" height={bar} />
        <Skeleton width="42%" height={11} />
      </View>
    </Surface>
  );
}

interface ListSkeletonProps {
  kind: 'transactions' | 'budgets';
  count?: number;
  /** « Chargement… » : annoncé une seule fois par TalkBack. */
  accessibilityLabel: string;
}

/** Plusieurs lignes de squelette, annoncées comme un seul élément « Chargement ». */
export function ListSkeleton({ kind, count = 4, accessibilityLabel }: ListSkeletonProps) {
  const widths = ['58%', '44%', '66%', '52%', '48%'] as const;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      importantForAccessibility="yes"
      style={{ gap: kind === 'budgets' ? 10 : 0 }}>
      {Array.from({ length: count }, (_, index) =>
        kind === 'budgets' ? (
          <BudgetRowSkeleton key={index} />
        ) : (
          <TransactionRowSkeleton key={index} titleWidth={widths[index % widths.length]} />
        ),
      )}
    </View>
  );
}
