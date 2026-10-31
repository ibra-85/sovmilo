/**
 * Espacements, rayons et dimensions fixes (design/DESIGN.md §4).
 *
 * Valeurs OBSERVÉES sur le gabarit 393 × 852 dp, sauf les deux ajustements demandés par le propriétaire après
 * le handoff (repères visuels complémentaires), marqués « AJUSTÉ » :
 *  - rythme entre sections : 24 dp (la maquette mesurait 30 dp au-dessus d'un titre de section) ;
 *  - rayon principal des surfaces : 23 dp (la maquette mesurait 20 dp), ce qui entraîne la barre de navigation
 *    (23) et son onglet actif (16) pour garder la règle « rayon intérieur ≈ rayon extérieur − marge interne ».
 */

/** Échelle d'espacement (dp). */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Rayons par rôle (dp). Les valeurs entre parenthèses sont celles de la maquette quand elles ont été ajustées. */
export const radius = {
  /** Panneau inférieur (haut) et panneau flottant au-dessus du clavier. */
  sheet: 26,
  /** AJUSTÉ (20) : surfaces de contenu (cartes d'Accueil, de Budgets, résumé). */
  surface: 23,
  /** AJUSTÉ (20) : barre de navigation flottante. */
  nav: 23,
  /** AJUSTÉ (13) : pastille de l'onglet actif = nav 23 − padding 7. */
  navTab: 16,
  /** Menu + (panneau d'actions). */
  menu: 18,
  /** Ligne d'action du menu + : menu 18 − padding 6. */
  menuItem: 12,
  /** Groupe de champs. */
  group: 18,
  /** Tuile de catégorie (58 dp). */
  tile: 17,
  /** Menu contextuel « ⋯ ». */
  contextMenu: 16,
  /** Bouton principal (54 dp). */
  button: 15,
  /** Champ de saisie, recherche, segmenté, notification, boutons de dialogue, ligne de budget, bouton secondaire. */
  field: 14,
  /** Bouton retour 44 dp, pastille d'icône 48 dp du sélecteur. */
  iconButton: 13,
  /** Option de segmenté : 14 − padding 4 = 10 (11 observé pour le segmenté 14). */
  option: 11,
  /** Pastille d'icône 40 dp, sélecteur de période, bouton « Créer un budget ». */
  pill: 12,
  /** Pastille d'icône de champ 36 dp. */
  iconPad: 11,
  /** Pastille d'action du menu 36 dp. */
  actionPad: 10,
  /** Bouts des barres de progression. */
  progress: 8,
  /** Cercles (icône d'opération, bouton +). */
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;

/** Dimensions fixes (dp). */
export const sizes = {
  /** Marge latérale d'écran. */
  screenMargin: 20,
  /** Rythme entre sections majeures (AJUSTÉ, voir l'en-tête). */
  sectionGap: spacing.xl,
  /** Zone tactile minimale. */
  minTouch: 48,
  /** En-tête d'écran (56–60). */
  header: 56,
  /** Barre de navigation flottante et bouton + (même hauteur). */
  navHeight: 60,
  fabSize: 60,
  navFabGap: 10,
  navPadding: 7,
  /** Distance entre la barre de navigation et le bord bas. */
  navBottom: 32,
  /** Espace réservé en bas des listes pour ne pas passer sous la barre. */
  bottomReserve: 132,
  /** Hauteur du fondu sous la barre. */
  navFade: 150,
  buttonHeight: 54,
  buttonSecondaryHeight: 52,
  iconButton: 44,
  /** Icône d'opération (rond). */
  rowIcon: 44,
  /** Icône d'une ligne de budget. */
  budgetIcon: 40,
  fieldRowMinHeight: 58,
  categoryTile: 58,
  categoryTileWidth: 74,
  progressThin: 4,
  progressThick: 8,
} as const;
