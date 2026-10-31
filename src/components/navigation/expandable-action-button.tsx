import { useEffect } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Pressable } from '@/components/ui';
import { useMotion } from '@/hooks/use-motion';
import { radius, sizes } from '@/theme/layout';
import { motionDistances } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

interface ExpandableActionButtonProps {
  open: boolean;
  onPress: () => void;
  /** « Actions rapides » / « Fermer les actions rapides » (design : libellé + état déplié pour TalkBack). */
  label: string;
}

/**
 * Bouton + circulaire (60 dp). Ouvert : l'icône pivote de 45° (le + devient ×) et le contour passe au citron
 * renforcé, en 200 ms, en même temps. Pressé : enfoncement de 1 dp et matière « pressée ».
 */
export function ExpandableActionButton({ open, onPress, label }: ExpandableActionButtonProps) {
  const { colors, shadows } = useTheme();
  const { timing } = useMotion();

  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, timing('standard', 'fabRotate'));
  }, [open, progress, timing]);

  const rotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * motionDistances.fabRotateDegrees}deg` }],
  }));
  const ring = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [colors.fabBorder, colors.fabBorderOpen]),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: sizes.fabSize,
        height: sizes.fabSize,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.fabPressed : colors.fab,
        boxShadow: pressed ? shadows.fabPressed : shadows.fab,
      })}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.full, borderWidth: 1.5 },
          ring,
        ]}
      />
      <Animated.View pointerEvents="none" style={rotation}>
        <Icon name="plus" size={26} color={colors.fabIcon} weight="strong" />
      </Animated.View>
    </Pressable>
  );
}
