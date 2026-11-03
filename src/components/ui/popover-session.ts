import { pointInRect, type Rect } from './popover-layout';

/**
 * Logique d'état du popover, sans React ni Reanimated (testée) : que faire d'un toucher sur le fond, quand démonter la
 * fenêtre, et comment garantir qu'une action de menu ne s'exécute qu'une fois.
 */

export type ScrimTap = 'close' | 'reopen' | 'ignore';

/**
 * Toucher sur le fond (hors menu) :
 *  - menu ouvert ou en train de s'ouvrir : il se ferme, y compris si le toucher est sur le déclencheur (bascule) ;
 *  - menu en train de se fermer : un toucher sur le déclencheur le ROUVRE tout de suite (l'inertie de la fermeture est
 *    conservée par le moteur) ; ailleurs, rien (il se ferme déjà) ;
 *  - une action vient d'être choisie : le menu se ferme pour de bon, on ne le rouvre pas.
 */
export function resolveScrimTap(input: {
  intentOpen: boolean;
  actionPending: boolean;
  point: { x: number; y: number };
  anchor: Rect | null;
  slop: number;
}): ScrimTap {
  if (input.intentOpen) return 'close';
  if (input.actionPending || !input.anchor) return 'ignore';
  return pointInRect(input.point.x, input.point.y, input.anchor, input.slop) ? 'reopen' : 'ignore';
}

/** Retour d'Android pendant que la surface existe : il ferme le menu s'il est ouvert, et dans tous les cas n'atteint pas l'écran. */
export function resolvePopoverBack(input: { intentOpen: boolean }): 'close' | 'absorb' {
  return input.intentOpen ? 'close' : 'absorb';
}

export type RowPress = 'select' | 'close' | 'ignore';

/**
 * Toucher sur une ligne du menu :
 *  - menu en train de se fermer : ignoré (le choix, ou la fermeture, est déjà en cours) ;
 *  - menu ouvert depuis moins de `SELECT_ARM_MS` : c'est le second toucher d'un double toucher sur le déclencheur (en mode
 *    `cover`, la 1ʳᵉ ligne est exactement sous le bouton) → il se comporte comme un toucher sur le déclencheur : le menu se ferme,
 *    aucune action ne part ;
 *  - sinon : la ligne est choisie.
 */
export function resolveRowPress(input: { intentOpen: boolean; armed: boolean }): RowPress {
  if (!input.intentOpen) return 'ignore';
  return input.armed ? 'select' : 'close';
}

/**
 * Le moteur signale « fermé et au repos » avec le numéro de génération qu'il a lu. La fenêtre n'est démontée que si ce
 * numéro est encore le dernier demandé et que l'intention est toujours « fermé » : un message en retard d'une fermeture
 * déjà annulée par une réouverture ne peut jamais démonter un menu ouvert.
 */
export function shouldUnmount(input: { settledEpoch: number; currentEpoch: number; intentOpen: boolean }): boolean {
  return !input.intentOpen && input.settledEpoch === input.currentEpoch;
}

export interface ActionGate {
  /** Mémorise l'action choisie. Faux si une action est déjà en attente (deuxième toucher rapide) : rien n'est enregistré. */
  select: (action: () => void) => boolean;
  /** Exécute l'action en attente, une seule fois (la fermeture est terminée). Faux s'il n'y en avait pas. */
  flush: () => boolean;
  /** Une action attend-elle la fin de la fermeture ? */
  pending: () => boolean;
  /** À l'ouverture suivante. */
  reset: () => void;
}

/**
 * Une action de menu est exécutée UNE fois, APRÈS la fermeture : la navigation ou le dialogue qu'elle déclenche ne se
 * superpose donc pas au menu qui se referme (pas de flash, pas de transition cassée).
 */
export function createActionGate(): ActionGate {
  let action: (() => void) | null = null;
  let taken = false;
  return {
    select(next) {
      if (taken) return false;
      taken = true;
      action = next;
      return true;
    },
    flush() {
      const run = action;
      action = null;
      if (!run) return false;
      run();
      return true;
    },
    pending: () => action !== null,
    reset() {
      action = null;
      taken = false;
    },
  };
}
