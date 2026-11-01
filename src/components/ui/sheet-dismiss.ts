/**
 * Règles du glissement de fermeture d'un panneau inférieur (BottomSheet), isolées en fonctions pures pour être testées sans rendu.
 * Les valeurs sont celles qui étaient déjà validées sur téléphone : ce fichier ne change aucun comportement.
 */

/** Au-dessus de ce glissement vers le bas (px/s), le panneau se ferme même s'il n'a pas parcouru assez de sa hauteur. */
export const DISMISS_VELOCITY = 900;
/** Résistance quand on tire vers le haut : le panneau suit à 12 %. */
export const UPWARD_RESISTANCE = 0.12;

/** Écart appliqué au panneau pour un glissement de `translationY` : libre vers le bas, freiné vers le haut. */
export function sheetDragOffset(translationY: number): number {
  'worklet';
  return translationY >= 0 ? translationY : translationY * UPWARD_RESISTANCE;
}

/**
 * Le panneau se ferme-t-il au relâchement ? Oui s'il a parcouru plus de `ratio` de sa hauteur (30 % par défaut dans le design) OU
 * si le geste est assez rapide vers le bas. Sinon il revient en place avec la vitesse du geste.
 */
export function sheetShouldDismiss(dragOffset: number, velocityY: number, sheetHeight: number, ratio: number): boolean {
  'worklet';
  return dragOffset > sheetHeight * ratio || velocityY > DISMISS_VELOCITY;
}
