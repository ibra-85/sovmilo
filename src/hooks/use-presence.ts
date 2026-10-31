import { useEffect, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useMotion, type MotionKind } from '@/hooks/use-motion';
import type { CurveName, DurationName } from '@/theme/motion';

interface PresenceSpec {
  enter: readonly [CurveName, DurationName];
  exit: readonly [CurveName, DurationName];
  /** `fade` : seul l'opacité bouge (notification) ; `move` : le composant se déplace aussi. */
  kind?: MotionKind;
}

/**
 * Apparition / disparition animée d'un élément superposé (menu, panneau inférieur, notification).
 *
 * Renvoie `progress` (0 = caché, 1 = visible, à brancher sur les styles animés) et `mounted` : l'élément reste
 * monté pendant l'animation de sortie puis disparaît de l'arbre. Interruptible : rouvrir pendant la fermeture repart
 * de la valeur courante, sans saut. Aucune mise à jour d'état dans un effet : `mounted` passe à vrai pendant le rendu
 * (motif recommandé par React) et à faux depuis la fin de l'animation.
 */
export function usePresence(visible: boolean, spec: PresenceSpec) {
  const { timing } = useMotion();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const progress = useSharedValue(0);
  const [enterCurve, enterDuration] = spec.enter;
  const [exitCurve, exitDuration] = spec.exit;
  const kind = spec.kind ?? 'move';

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, timing(enterCurve, enterDuration, kind));
    } else {
      progress.value = withTiming(0, timing(exitCurve, exitDuration, kind), (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, progress, timing, enterCurve, enterDuration, exitCurve, exitDuration, kind]);

  return { mounted, progress };
}
