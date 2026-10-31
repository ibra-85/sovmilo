import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';
import { radius, sizes } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

interface ProgressBarProps {
  /** Part consommée en pourcentage ; au-delà de 100 la barre reste pleine. */
  percent: number;
  /** 4 dp (lignes, résumé) ou 8 dp (détail d'un budget). */
  thickness?: 'thin' | 'thick';
  /** Dépassement : seul cas où le remplissage change de couleur (jamais par catégorie). */
  over?: boolean;
}

/**
 * Barre de progression d'un budget (design « BudgetProgress ») : piste `progressTrack`, remplissage neutre. Elle se
 * remplit en 300 ms à l'affichage puis suit les changements. Purement visuelle : la valeur est annoncée par le texte de
 * la ligne (pourcentage et montants), la barre est donc masquée aux lecteurs d'écran.
 */
export function ProgressBar({ percent, thickness = 'thin', over = false }: ProgressBarProps) {
  const { colors } = useTheme();
  const { timing } = useMotion();
  const fill = useSharedValue(0);
  const target = Math.min(Math.max(percent, 0), 100) / 100;

  useEffect(() => {
    fill.value = withTiming(target, timing('standard', 'progressFill'));
  }, [target, fill, timing]);

  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const height = thickness === 'thin' ? sizes.progressThin : sizes.progressThick;

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{ height, borderRadius: radius.progress, overflow: 'hidden', backgroundColor: colors.progressTrack }}>
      <Animated.View
        style={[
          { height, borderRadius: radius.progress, backgroundColor: over ? colors.danger : colors.progressFill },
          style,
        ]}
      />
    </View>
  );
}
