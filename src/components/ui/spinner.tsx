import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from './icon';

interface SpinnerProps {
  size?: number;
  color?: string;
}

/**
 * Indicateur de chargement : le seul mouvement continu de l'application, parce qu'il signale une action en cours.
 * Quand les animations sont réduites, il reste fixe (l'état « occupé » est annoncé par le composant parent).
 */
export function Spinner({ size = 20, color }: SpinnerProps) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    turn.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduced, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <Animated.View style={style} accessible={false} importantForAccessibility="no-hide-descendants">
      <Icon name="spinner" size={size} color={color} weight="strong" />
    </Animated.View>
  );
}
