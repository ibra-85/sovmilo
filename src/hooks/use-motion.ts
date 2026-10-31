import { useCallback } from 'react';
import { Easing, ReduceMotion, useReducedMotion, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

import { curves, durations, springPerceivedDuration, type CurveName, type DurationName } from '@/theme/motion';

/** `move` : translation, échelle, rotation, taille (supprimés si les animations sont réduites). `fade` : opacité seule. */
export type MotionKind = 'move' | 'fade';

/**
 * Pont entre les jetons de mouvement (src/theme/motion.ts) et Reanimated.
 *
 * Animations réduites (réglage Android « Supprimer les animations ») — design/MOTION.md :
 *  - un changement de position, d'échelle ou de taille devient instantané (durée 0) ;
 *  - un fondu est conservé mais ramené à 100 ms au plus.
 *
 * Usage : `opacity.value = withTiming(1, timing('enter', 'toastIn', 'fade'))`.
 * `timing` garde la même identité tant que le réglage ne change pas : on peut l'utiliser dans un tableau de dépendances.
 */
export function useMotion() {
  const reduced = useReducedMotion();

  const timing = useCallback(
    (curve: CurveName, duration: DurationName, kind: MotionKind = 'move'): WithTimingConfig => {
      const base = durations[duration];
      const effective = !reduced ? base : kind === 'fade' ? Math.min(base, durations.reducedFade) : 0;
      const [x1, y1, x2, y2] = curves[curve];
      return { duration: effective, easing: Easing.bezier(x1, y1, x2, y2) };
    },
    [reduced],
  );

  /**
   * Ressort sans rebond pour une bascule d'état (ouvert / fermé, onglet actif) : interruptible, la position courante
   * est conservée et la vitesse aussi quand l'objectif reste dans le même sens (voir `theme/motion.ts`).
   * Animations réduites : un déplacement devient instantané, un fondu dure 100 ms au plus.
   */
  const spring = useCallback(
    (duration: DurationName, kind: MotionKind = 'move'): WithSpringConfig => {
      const base = durations[duration];
      const ms = reduced && kind === 'fade' ? Math.min(base, durations.reducedFade) : base;
      return {
        duration: springPerceivedDuration(ms),
        dampingRatio: 1,
        overshootClamping: true,
        // Nous décidons nous-mêmes du comportement « animations réduites » ci-dessus.
        reduceMotion: reduced && kind === 'move' ? ReduceMotion.Always : ReduceMotion.Never,
      };
    },
    [reduced],
  );

  /** Durée en ms d'un décalage (stagger) : nulle quand les animations sont réduites. */
  const delay = useCallback(
    (duration: DurationName, count = 1): number => (reduced ? 0 : durations[duration] * count),
    [reduced],
  );

  return { reduced, timing, spring, delay };
}
