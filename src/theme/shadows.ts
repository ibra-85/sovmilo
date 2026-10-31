import type { BoxShadowValue } from 'react-native';

import type { ThemeName } from './tokens';

/**
 * Matières « Precision Glass » : couches d'ombres et de reflets d'un pixel (design/DESIGN.md §5.2), exprimées
 * avec la propriété `boxShadow` de React Native (ombres portées ET intérieures, plusieurs couches empilées).
 *
 * Les recettes reprennent les valeurs CSS des maquettes. Rendu réel non vérifié sur Android (les ombres
 * intérieures demandent Android 10 / API 29 ou plus ; en dessous, seules les ombres portées s'affichent).
 */

const drop = (offsetX: number, offsetY: number, blurRadius: number, color: string, spreadDistance = 0): BoxShadowValue => ({
  offsetX,
  offsetY,
  blurRadius,
  spreadDistance,
  color,
});

const inner = (offsetX: number, offsetY: number, blurRadius: number, color: string, spreadDistance = 0): BoxShadowValue => ({
  ...drop(offsetX, offsetY, blurRadius, color, spreadDistance),
  inset: true,
});

export interface ShadowTokens {
  /** Tuile / surface secondaire (catégories, bouton retour). */
  tile: BoxShadowValue[];
  /** Surface posée, niveau 1 (cartes, groupes). */
  surface: BoxShadowValue[];
  /** Barre de navigation flottante. */
  nav: BoxShadowValue[];
  /** Pastille de l'onglet actif. */
  navTab: BoxShadowValue[];
  /** Bouton +. */
  fab: BoxShadowValue[];
  fabPressed: BoxShadowValue[];
  /** Bouton principal. */
  primary: BoxShadowValue[];
  primaryPressed: BoxShadowValue[];
  /** Menu + et menu « ⋯ ». */
  menu: BoxShadowValue[];
  /** Panneau inférieur. */
  sheet: BoxShadowValue[];
  /** Notification. */
  toast: BoxShadowValue[];
}

const G = (alpha: number) => `rgba(32,34,39,${alpha})`; // graphite, ombres du mode clair
const K = (alpha: number) => `rgba(0,0,0,${alpha})`;
const W = (alpha: number) => `rgba(255,255,255,${alpha})`;

const light: ShadowTokens = {
  tile: [inner(0, 1, 0, '#FFFFFF'), drop(0, 1, 2, G(0.06)), drop(0, 4, 10, G(0.04))],
  surface: [inner(0, 1, 0, '#FFFFFF'), drop(0, 1, 2, G(0.06)), drop(0, 12, 30, G(0.06))],
  nav: [inner(0, 1, 0, '#FFFFFF'), inner(0, -1, 0, G(0.03)), drop(0, 1, 2, G(0.06)), drop(0, 12, 30, G(0.1))],
  navTab: [inner(0, 1, 0, '#FFFFFF'), drop(0, 1, 2, G(0.08)), drop(0, 2, 6, G(0.04))],
  fab: [inner(0, 1, 0, '#FFFFFF'), inner(0, -1, 0, G(0.07)), drop(0, 1, 2, G(0.1)), drop(0, 10, 24, G(0.1))],
  fabPressed: [inner(0, 2, 4, G(0.1)), drop(0, 1, 1, G(0.1))],
  primary: [inner(0, 1, 0, W(0.16)), inner(0, 0, 0, K(0.35), 1), drop(0, 1, 2, G(0.22)), drop(0, 8, 18, G(0.16))],
  primaryPressed: [inner(0, 1, 0, W(0.1)), inner(0, 0, 0, K(0.35), 1), drop(0, 1, 1, G(0.22))],
  menu: [inner(0, 1, 0, '#FFFFFF'), drop(0, 2, 6, G(0.08)), drop(0, 20, 44, G(0.16))],
  sheet: [inner(0, 1, 0, '#FFFFFF'), drop(0, -10, 40, G(0.18))],
  toast: [drop(0, 1, 2, G(0.06)), drop(0, 10, 26, G(0.12))],
};

const dark: ShadowTokens = {
  tile: [inner(0, 1, 0, W(0.05)), drop(0, 1, 2, K(0.5))],
  surface: [inner(0, 1, 0, W(0.04)), drop(0, 10, 28, K(0.35))],
  nav: [inner(0, 1, 0, W(0.08)), inner(0, -1, 0, K(0.4)), drop(0, 1, 1, K(0.6)), drop(0, 14, 34, K(0.55))],
  navTab: [inner(0, 1, 0, W(0.09)), drop(0, 1, 2, K(0.55)), drop(0, 2, 6, K(0.25))],
  fab: [inner(0, 1, 0, W(0.1)), inner(0, -1, 0, K(0.45)), drop(0, 1, 1, K(0.6)), drop(0, 12, 28, K(0.55))],
  fabPressed: [inner(0, 2, 4, K(0.55)), drop(0, 1, 1, K(0.3))],
  // Pas de halo citron : ombre noire seulement (validé).
  primary: [
    inner(0, 1, 0, W(0.55)),
    inner(0, -1, 0, K(0.15)),
    inner(0, 0, 0, K(0.18), 1),
    drop(0, 1, 2, K(0.6)),
    drop(0, 8, 18, K(0.45)),
  ],
  primaryPressed: [inner(0, 1, 0, W(0.35)), inner(0, 0, 0, K(0.18), 1), drop(0, 1, 1, K(0.6))],
  menu: [inner(0, 1, 0, W(0.07)), drop(0, 2, 6, K(0.5)), drop(0, 20, 44, K(0.6))],
  sheet: [inner(0, 1, 0, W(0.07)), drop(0, -10, 40, K(0.6))],
  toast: [inner(0, 1, 0, W(0.06)), drop(0, 10, 26, K(0.5))],
};

export const shadowTokens: Record<ThemeName, ShadowTokens> = { light, dark };
