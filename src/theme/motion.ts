/**
 * Jetons de mouvement (design/MOTION.md). Les maquettes sont statiques : sauf mention « DÉCIDÉ », ces valeurs sont
 * des PROPOSITIONS à valider sur appareil, regroupées ici pour pouvoir toutes les ajuster au même endroit.
 *
 * Principes (DÉCIDÉS) : le mouvement explique d'où vient un élément ; pas de rebond ; rien ne pousse la mise en page ;
 * la fermeture est plus rapide que l'ouverture. Ce fichier ne dépend pas de Reanimated pour rester testable ;
 * `useMotion()` (src/hooks/use-motion.ts) en fait des animations.
 */

/** Courbes cubic-bezier [x1, y1, x2, y2] (« emphasized » de Material 3). */
export const curves = {
  /** Déplacements, changements de taille. */
  standard: [0.2, 0, 0, 1],
  /** Apparitions. */
  enter: [0.05, 0.7, 0.1, 1],
  /** Disparitions. */
  exit: [0.3, 0, 0.8, 0.15],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type CurveName = keyof typeof curves;

/** Durées en millisecondes. */
export const durations = {
  /** Bouton pressé / relâché (DÉCIDÉ : enfoncement 1 dp, aucun rebond). */
  press: 80,
  release: 160,
  /** Pastille d'onglet : glisse et change de largeur (DÉCIDÉ : 220 ms). */
  tabSlide: 220,
  /** Libellé d'onglet : fondu (DÉCIDÉ), durée et décalage proposés. */
  tabLabel: 120,
  tabLabelDelay: 80,
  /** + → × (rotation de 45°) et contour citron. */
  fabRotate: 200,
  scrimIn: 180,
  scrimOut: 160,
  /** Panneau du menu + : depuis le bouton. */
  menuIn: 220,
  menuOut: 160,
  menuItemIn: 160,
  menuItemStagger: 30,
  /** Popovers (« ⋯ », sélecteur de période) : la surface part du bouton et s'agrandit. */
  dropdownIn: 220,
  dropdownOut: 160,
  /** Panneau inférieur. */
  sheetIn: 280,
  sheetOut: 220,
  sheetResize: 250,
  /** Notification : visible ≈ 3 s (DÉCIDÉ). */
  toastIn: 200,
  toastOut: 160,
  toastVisible: 3000,
  /** Graphique et progression : une seule fois à l'affichage. */
  chartBar: 400,
  chartBarStagger: 40,
  progressFill: 300,
  /** Squelettes. */
  skeletonFadeIn: 150,
  /** Fondu court conservé quand les animations sont réduites (≤ 100 ms). */
  reducedFade: 100,
} as const satisfies Record<string, number>;

export type DurationName = keyof typeof durations;

/** Déplacements et échelles de départ. */
export const motionDistances = {
  /** Panneau du menu + : translation verticale de départ et échelle de départ (origine : bas à droite). */
  menuTranslateY: 8,
  menuScaleFrom: 0.92,
  /** Lignes du menu + : translation de départ. */
  menuItemTranslateY: 6,
  /** Menu déroulant : échelle de départ (origine : haut à droite). */
  dropdownScaleFrom: 0.95,
  /** Notification : translation de départ. */
  toastTranslateY: 8,
  /** Bouton pressé : enfoncement. */
  pressTranslateY: 1,
  /** Rotation de l'icône + vers ×. */
  fabRotateDegrees: 45,
  /** Panneau inférieur : fermeture si glissement > 30 % de la hauteur. */
  sheetDismissRatio: 0.3,
} as const;

/**
 * Animations pilotées par un ressort (Reanimated `withSpring`) plutôt que par une durée fixe.
 *
 * Pourquoi : un ressort relancé en cours de route (second toucher) repart de la POSITION courante et garde la
 * VITESSE courante quand le nouvel objectif est dans le même sens ; une animation `withTiming` repart de la position
 * mais avec une vitesse remise à zéro et une nouvelle durée complète. Limite réelle de Reanimated 4 : si le nouvel
 * objectif est dans le sens CONTRAIRE du mouvement en cours, la vitesse est annulée (le mouvement s'arrête net puis repart),
 * il n'y a pas d'inversion par inertie. La position, elle, ne saute jamais.
 * Le popover (`MorphingPopover`) n'utilise PAS ce mécanisme : son moteur conserve la vitesse à l'inversion
 * (voir `components/ui/popover-motion.ts`).
 *
 * Ressort amorti critique (`dampingRatio: 1`) et `overshootClamping` : aucun rebond. `duration` de Reanimated est une
 * durée « perçue » : la durée réelle est environ 1,5 fois plus longue, donc on la dérive des durées de ce fichier.
 */
export const SPRING_REAL_DURATION_RATIO = 1.5;

/** Durée perçue à donner à `withSpring` pour obtenir à peu près la durée réelle `ms`. */
export function springPerceivedDuration(ms: number): number {
  return Math.max(1, Math.round(ms / SPRING_REAL_DURATION_RATIO));
}
