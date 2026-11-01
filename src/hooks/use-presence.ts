import { useEffect, useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
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
 * monté pendant l'animation de sortie puis disparaît de l'arbre. Interruptible : un second toucher pendant
 * l'ouverture (ou la fermeture) repart de la valeur ET de la vitesse courantes (ressort Reanimated, sans rebond) ;
 * si le sens s'inverse, la vitesse est annulée mais la position ne saute jamais. Le callback de fin ne ferme
 * l'élément que si l'animation a réellement abouti : une animation interrompue ne le démonte pas. Aucune mise à jour d'état dans un effet : `mounted` passe à vrai pendant le rendu
 * (motif recommandé par React) et à faux depuis la fin de l'animation.
 */
export function usePresence(visible: boolean, spec: PresenceSpec) {
  const { spring } = useMotion();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const progress = useSharedValue(0);
  const enterDuration = spec.enter[1];
  const exitDuration = spec.exit[1];
  const kind = spec.kind ?? 'move';

  useEffect(() => {
    if (visible) {
      progress.value = withSpring(1, spring(enterDuration, kind));
    } else {
      progress.value = withSpring(0, spring(exitDuration, kind), (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, progress, spring, enterDuration, exitDuration, kind]);

  return { mounted, progress };
}
