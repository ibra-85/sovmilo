import { useCallback } from 'react';

import { useToast } from '@/components/ui';

/**
 * Durée pendant laquelle le bouton « Annuler » reste disponible. Plus longue que les 3 s d'une notification simple
 * (design) : une action doit rester atteignable, surtout pour une personne peu à l'aise avec les écrans.
 */
export const UNDO_DURATION_MS = 6000;

export interface UndoRequest {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * Affiche un message de confirmation avec un bouton d'annulation. S'appuie sur la notification du design system
 * (`ToastProvider`, monté dans `src/app/_layout.tsx`) : il n'y a plus qu'un seul système de notifications.
 */
export function useUndo() {
  const { show } = useToast();
  return useCallback(
    (request: UndoRequest) => show({ ...request, durationMs: UNDO_DURATION_MS }),
    [show],
  );
}
