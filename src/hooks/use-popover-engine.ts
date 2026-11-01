import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
  type FrameCallback,
  type FrameInfo,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { INITIAL_MOTION, omegaForSettle, stages, stepMotion } from '@/components/ui/popover-motion';
import { shouldUnmount } from '@/components/ui/popover-session';
import { useMotion } from '@/hooks/use-motion';
import { durations } from '@/theme/motion';

/** Durée d'une image supposée quand Reanimated n'en donne pas (première image après une pause). */
const NOMINAL_FRAME_MS = 1000 / 60;
/** Une image très longue (ralentissement) est ramenée à cette durée : la surface ne « saute » pas d'un coup. */
const MAX_FRAME_MS = 64;

interface PopoverEngineOptions {
  /** Appelé (thread JS) quand le moteur s'est calé sur « fermé » ET que « fermé » est toujours le dernier ordre : démontage sûr. */
  onSettledClosed: () => void;
}

/**
 * Moteur d'animation du popover : un avancement `progress` (0 = forme du déclencheur, 1 = menu ouvert) piloté sur le
 * thread UI par `stepMotion` (voir `components/ui/popover-motion.ts`), image par image, sans minuterie.
 *
 * Interruption : `setOpen` ne démarre AUCUNE nouvelle animation. Il change seulement la cible et le rythme ; position et
 * vitesse restent celles du moment, donc un second toucher en cours de route ralentit la surface, l'arrête puis
 * l'inverse (voir les tests). `epoch` numérote chaque changement de cible : un compte rendu « fermé et au repos » arrivé
 * trop tard, après une réouverture, est reconnu périmé et ignoré.
 *
 * La boucle d'images ne tourne que pendant un mouvement : elle s'arrête quand tout est au repos.
 * Animations réduites : même moteur, réglé sur 100 ms ; le composant n'anime alors que l'opacité (pas de mouvement spatial).
 */
export function usePopoverEngine({ onSettledClosed }: PopoverEngineOptions) {
  const { reduced } = useMotion();

  const progress = useSharedValue(INITIAL_MOTION.position);
  const velocity = useSharedValue(INITIAL_MOTION.velocity);
  const lead = useSharedValue(INITIAL_MOTION.lead);
  const leadVelocity = useSharedValue(INITIAL_MOTION.leadVelocity);
  const target = useSharedValue(0);
  const omega = useSharedValue(omegaForSettle(durations.dropdownIn));
  const epoch = useSharedValue(0);
  const idle = useSharedValue(true);

  // État côté JS : dernier ordre donné et sa génération.
  const desiredRef = useRef(false);
  const epochRef = useRef(0);
  const onSettledClosedRef = useRef(onSettledClosed);
  useEffect(() => {
    onSettledClosedRef.current = onSettledClosed;
  }, [onSettledClosed]);

  // Les lignes ne reçoivent les touchers qu'une fois la surface bien ouverte (voir `stages.interactiveAt`).
  const [interactive, setInteractive] = useState(false);

  // Retour du thread UI : tout est au repos. Périmé (la cible a changé depuis) → ignoré.
  const frameRef = useRef<FrameCallback | null>(null);
  const reportSettled = useCallback((settledEpoch: number, closed: boolean) => {
    if (settledEpoch !== epochRef.current) return; // une autre cible a été demandée entre-temps
    frameRef.current?.setActive(false);
    if (closed && shouldUnmount({ settledEpoch, currentEpoch: epochRef.current, intentOpen: desiredRef.current })) {
      onSettledClosedRef.current();
    }
  }, []);

  // Callback stable (sinon Reanimated le réenregistrerait à chaque rendu).
  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      if (idle.get()) return;
      const elapsed = Math.min(info.timeSincePreviousFrame ?? NOMINAL_FRAME_MS, MAX_FRAME_MS);
      const next = stepMotion(
        { position: progress.get(), velocity: velocity.get(), lead: lead.get(), leadVelocity: leadVelocity.get() },
        target.get(),
        omega.get(),
        elapsed / 1000,
      );
      progress.set(next.position);
      velocity.set(next.velocity);
      lead.set(next.lead);
      leadVelocity.set(next.leadVelocity);
      if (next.settled) {
        idle.set(true);
        scheduleOnRN(reportSettled, epoch.get(), target.get() === 0);
      }
    },
    [idle, progress, velocity, lead, leadVelocity, target, omega, epoch, reportSettled],
  );
  const frame = useFrameCallback(onFrame, false);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useAnimatedReaction(
    () => target.get() === 1 && progress.get() >= stages.interactiveAt,
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setInteractive, now);
    },
  );

  /**
   * Demande l'ouverture ou la fermeture. Sans effet si c'est déjà le dernier ordre. Renvoie la génération courante.
   * Peut être appelé directement depuis un gestionnaire de toucher : le mouvement part à l'image suivante.
   */
  const setOpen = useCallback(
    (open: boolean) => {
      if (desiredRef.current === open) return epochRef.current;
      desiredRef.current = open;
      epochRef.current += 1;
      target.set(open ? 1 : 0);
      // Fermer est plus rapide qu'ouvrir ; animations réduites : un fondu de 100 ms dans les deux sens.
      const settle = reduced ? durations.reducedFade : open ? durations.dropdownIn : durations.dropdownOut;
      omega.set(omegaForSettle(settle));
      epoch.set(epochRef.current);
      idle.set(false);
      frame.setActive(true);
      return epochRef.current;
    },
    [frame, target, omega, epoch, idle, reduced],
  );

  return {
    progress,
    interactive,
    setOpen,
    /** Dernier ordre donné (JS). */
    isOpenRequested: () => desiredRef.current,
    /** Génération du dernier ordre (JS). */
    currentEpoch: () => epochRef.current,
    reduced,
  };
}
