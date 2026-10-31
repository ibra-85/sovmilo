/**
 * Espacements, rayons et dimensions fixes (design/DESIGN.md §4), organisés PAR RÔLE.
 *
 * Toutes les valeurs sont celles MESURÉES sur les maquettes validées (gabarit 393 × 852 dp). Les repères « espacement 24 »
 * et « rayon 23 » d'une image d'inspiration sont des recommandations visuelles, pas des règles : ils ne remplacent aucune
 * mesure des maquettes (voir docs/design-deviations.md). Les rayons imbriqués suivent « rayon intérieur ≈ rayon
 * extérieur − marge interne » (barre 20 − 7 = onglet 13 ; menu 18 − 6 = ligne 12 ; segmenté 14 − 4 = option 10–11).
 */

/** Échelle brute d'espacement (dp), pour les cas sans rôle propre. */
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

/** Espacements par rôle (dp). */
export const space = {
  /** Marge latérale d'écran (contenu, en-têtes, barre, boutons). */
  screen: 20,
  /** Au-dessus d'un titre de section (Accueil, Budgets). */
  section: 30,
  /** Entre un titre de section et son contenu. */
  sectionTitle: 10,
  /** Au-dessus d'un groupe de jour (Opérations) : le regroupement se fait par l'espace, sans séparateur. */
  dayGroup: 26,
  dayGroupTitle: 4,
  /** Padding vertical d'une ligne de liste. */
  listRow: 10,
  /** Gouttière entre l'icône et le texte d'une ligne. */
  gutter: 14,
  /** Ligne de champ de formulaire : hauteur minimale. Le filet entre deux champs est indenté de `fieldDividerInset`. */
  fieldMinHeight: 58,
  fieldDividerInset: 64,
  /** Carrousel de catégories : les tuiles touchent visuellement le bord et s'effacent. */
  carouselEdge: 14,
  carouselGap: 6,
} as const;

/** Rayons par rôle (dp). */
export const radius = {
  /** Panneau inférieur (haut) et panneau flottant au-dessus du clavier. */
  sheet: 26,
  /** Surface de contenu : cartes d'Accueil, de Budgets, résumé. */
  surface: 20,
  /** Barre de navigation flottante. */
  nav: 20,
  /** Pastille de l'onglet actif : nav 20 − padding 7. */
  navTab: 13,
  /** Menu + (panneau d'actions). */
  menu: 18,
  /** Ligne d'action du menu + : menu 18 − padding 6. */
  menuItem: 12,
  /** Menu contextuel « ⋯ ». */
  contextMenu: 16,
  /** Groupe de champs. */
  group: 18,
  /** Tuile de catégorie (58 dp). */
  tile: 17,
  /** Grande tuile d'icône des écrans de détail (70 dp). */
  tileHero: 22,
  /** Bouton principal (54 dp). */
  button: 15,
  /** Champ de saisie, recherche, segmenté, notification, bouton secondaire / de dialogue, ligne de budget. */
  field: 14,
  /** Bouton retour 44 dp, pastille d'icône 48 dp du sélecteur. */
  iconButton: 13,
  /** Option de segmenté : 14 − padding 4. */
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
  /**
   * Zone tactile minimale d'une cible (recommandation Android : 48 dp). Un élément visuellement plus petit
   * (bouton retour 44 dp, onglet inactif) garde cette zone grâce à `touchSlop`.
   */
  minTouch: 48,
  /** En-tête d'écran (56–60). */
  header: 56,
  /** Barre de navigation flottante et bouton + (même hauteur). */
  navHeight: 60,
  fabSize: 60,
  navFabGap: 10,
  navPadding: 7,
  /** Onglet actif : pastille de 44 dp de haut dans une barre de 60 dp (60 − 2 × 7 = 46, 1 dp de bordure de chaque côté). */
  navTabHeight: 44,
  /** Largeur visible d'un onglet inactif (zone tactile : 48 dp). */
  navTabInactiveWidth: 44,
  /** Distance entre la barre de navigation et le bord bas. */
  navBottom: 32,
  /** Espace réservé en bas des listes pour ne pas passer sous la barre. */
  bottomReserve: 132,
  /** Hauteur du fondu sous la barre. */
  navFade: 150,
  buttonHeight: 54,
  buttonSecondaryHeight: 52,
  buttonCompactHeight: 36,
  iconButton: 44,
  /** Icône d'opération (rond). */
  rowIcon: 44,
  /** Icône d'une ligne de budget. */
  budgetIcon: 40,
  fieldIcon: 36,
  categoryTile: 58,
  categoryTileWidth: 74,
  progressThin: 4,
  progressThick: 8,
  segmentedOption: 38,
  /** Menu + : largeur, ligne d'action, distance au-dessus du bas. */
  actionMenuWidth: 256,
  actionMenuRow: 52,
  actionMenuBottom: 104,
  contextMenuWidth: 232,
  contextMenuRow: 50,
  /** Notification : distance au-dessus du bas (au-dessus du bouton principal). */
  toastBottom: 110,
} as const;

/** `hitSlop` qui porte une cible visuelle de `visible` dp à la zone tactile minimale. */
export function touchSlop(visibleWidth: number, visibleHeight: number = visibleWidth) {
  const horizontal = Math.max(0, Math.ceil((sizes.minTouch - visibleWidth) / 2));
  const vertical = Math.max(0, Math.ceil((sizes.minTouch - visibleHeight) / 2));
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}
