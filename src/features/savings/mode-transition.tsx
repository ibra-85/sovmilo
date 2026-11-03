import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useMotion } from '@/hooks/use-motion';
import { motionDistances } from '@/theme/motion';

interface ModeTransitionProps<Mode extends string> {
  /** Mode voulu. Le contenu change de mode APRÈS la sortie de l'ancien : jamais deux contenus visibles en même temps. */
  mode: Mode;
  /** Reçoit le mode actuellement AFFICHÉ et `changing` (vrai pendant la transition : les actions doivent alors être inactives). */
  children: (shown: Mode, changing: boolean) => ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Transition de mode d'un écran (Épargne ↔ Réorganiser) : l'ancien contenu s'estompe et glisse de 6 dp (100 ms), le contenu
 * du nouveau mode est alors monté et entre de la même façon (160 ms). Séquentiel : un seul contenu à la fois, donc aucune carte en
 * double, et la liste n'est remplacée qu'une fois invisible (pas de saut visible). Inversable en route : si le mode redevient
 * l'ancien avant la fin de la sortie, le contenu revient sans être remplacé. Animations réduites : remplacement immédiat.
 *
 * Les configurations d'animation sont calculées ici, sur le thread JS ; le seul appel qui revient du thread UI est `scheduleOnRN`.
 */
export function ModeTransition<Mode extends string>({ mode, children, style }: ModeTransitionProps<Mode>) {
  const { reduced, timing } = useMotion();
  const outConfig = useMemo(() => timing('exit', 'modeOut', 'fade'), [timing]);
  const inConfig = useMemo(() => timing('enter', 'modeIn', 'fade'), [timing]);
  const [shown, setShown] = useState(mode);
  const progress = useSharedValue(1);

  // Animations réduites : pas de transition, le contenu suit le mode tout de suite.
  if (reduced && shown !== mode) setShown(mode);

  const swap = useCallback((next: Mode) => setShown(next), []);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
    } else if (mode !== shown) {
      progress.set(
        withTiming(0, outConfig, (finished) => {
          if (finished) scheduleOnRN(swap, mode);
        }),
      );
    } else {
      progress.set(withTiming(1, inConfig));
    }
  }, [reduced, mode, shown, progress, outConfig, inConfig, swap]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * motionDistances.modeTranslateY }],
  }));

  return <Animated.View style={[style, animated]}>{children(shown, shown !== mode)}</Animated.View>;
}
