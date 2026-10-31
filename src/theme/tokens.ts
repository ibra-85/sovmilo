/**
 * Couleurs du design system « Precision Glass » (design/DESIGN.md §2).
 *
 * Source de vérité unique des couleurs : les composants ne contiennent AUCUN code couleur, ils lisent ces jetons
 * via `useTheme()`. Le nom entre parenthèses est le jeton CSS de la maquette HTML, pour retrouver la valeur d'origine.
 *
 * Statuts (voir design/DESIGN.md) : toutes les valeurs sont OBSERVÉES dans les maquettes, sauf `danger*` (couleurs
 * d'alerte PROVISOIRES, à confirmer) et `accent` en clair (#DDF35D, absent des vues validées : jeton de réserve).
 */

export interface ColorTokens {
  /** Fond d'application (--bg). */
  bg: string;
  /** Surface « chrome » : barre de navigation (--sf). */
  chrome: string;
  /** Surface élevée / secondaire (--sf2). */
  chromeRaised: string;
  /** Texte principal (--tx). */
  text: string;
  /** Texte secondaire (--tx2). */
  textMuted: string;
  /** Encre des icônes (--ink). */
  ink: string;
  /** Surface de contenu : cartes, groupes, tuiles (--s1). */
  surface: string;
  /** Bordure de surface (--s1bd). */
  surfaceBorder: string;
  /** Surface secondaire : pastilles d'icône, segmenté, piste (--s2). */
  surfaceMuted: string;
  /** Filet de séparation (--hair / --sep). */
  hairline: string;
  /** Piste d'une barre de progression (--track). */
  progressTrack: string;
  /** Remplissage d'une barre de progression : neutre, jamais coloré par catégorie (--fill). */
  progressFill: string;
  /** Champ de saisie (--inp). */
  field: string;
  /** Contour d'un champ actif (--inpbd). */
  fieldFocusBorder: string;
  /** Curseur de saisie (--caret). */
  caret: string;
  /** Contour pointillé de la tuile « Créer » (--dash). */
  dashed: string;
  /** Squelette de chargement (--sk). */
  skeleton: string;
  /** Voile derrière le menu + (--scrim). */
  scrim: string;
  /** Voile derrière un panneau inférieur (--scrim2). */
  scrimSheet: string;
  /** Panneau inférieur (--sheet). */
  sheet: string;
  /** Surface du bouton + (--fab). */
  fab: string;
  /** Icône du bouton + (--fabic). */
  fabIcon: string;
  /** Contour du bouton + au repos (--fabbd). */
  fabBorder: string;
  /** Contour du bouton + quand le menu est ouvert (--fabopenbd). */
  fabBorderOpen: string;
  /** Fond du bouton + pressé. */
  fabPressed: string;
  /** Bouton principal : fond (--pri). Graphite en clair, citron en sombre. */
  primary: string;
  /** Bouton principal : texte (--pritx). */
  onPrimary: string;
  /** Sélection : contour (--selbd). */
  selectedBorder: string;
  /** Sélection : icône (--selic). */
  selectedIcon: string;
  /** Sélection : halo de 3–4 dp (--selring). */
  selectedRing: string;
  /** Pastille de l'onglet actif (--chip). */
  tabActive: string;
  /** Pastille de la 1re action du menu + (--aic1). */
  actionHighlightBg: string;
  actionHighlightIcon: string;
  /** Pastille d'une ligne de revenu (--incbg / --incic). */
  incomeBg: string;
  incomeIcon: string;
  /** Pastille de succès d'une notification (--okbg / --okic). */
  successBg: string;
  successIcon: string;
  /** Fond d'une notification (--tst). */
  toast: string;
  /** PROVISOIRE : texte et icône d'alerte, dépassement de budget, action destructive (--err). */
  danger: string;
  /** PROVISOIRE : fond d'alerte doux (--errsoft). */
  dangerSoft: string;
  /** PROVISOIRE : liseré d'une ligne dépassée (--errline). */
  dangerLine: string;
  /** PROVISOIRE : bordure d'un bouton destructif (--errbd). */
  dangerBorder: string;
  /** Citron : accent discret. En sombre il porte l'action principale. */
  accent: string;
}

const light: ColorTokens = {
  bg: '#F6F6F8',
  chrome: '#FFFFFF',
  chromeRaised: '#E9EAEE',
  text: '#202227',
  textMuted: '#6A6E76',
  ink: '#202227',
  surface: '#FFFFFF',
  surfaceBorder: 'rgba(32,34,39,0.07)',
  surfaceMuted: '#F1F2F5',
  hairline: 'rgba(32,34,39,0.07)',
  progressTrack: '#ECEDF1',
  progressFill: '#202227',
  field: '#F4F5F7',
  fieldFocusBorder: '#202227',
  caret: '#202227',
  dashed: 'rgba(32,34,39,0.28)',
  skeleton: '#E4E5E9',
  scrim: 'rgba(32,34,39,0.16)',
  scrimSheet: 'rgba(32,34,39,0.30)',
  sheet: '#FFFFFF',
  fab: '#FFFFFF',
  fabIcon: '#202227',
  fabBorder: '#D8DAE0',
  fabBorderOpen: '#CDDC6A',
  fabPressed: '#F1F2F5',
  primary: '#202227',
  onPrimary: '#FFFFFF',
  selectedBorder: '#202227',
  selectedIcon: '#202227',
  selectedRing: 'rgba(32,34,39,0.08)',
  tabActive: '#F1F2F5',
  actionHighlightBg: '#F2F8D2',
  actionHighlightIcon: '#202227',
  incomeBg: '#EDEFE4',
  incomeIcon: '#202227',
  successBg: '#EEF0F3',
  successIcon: '#202227',
  toast: '#FFFFFF',
  danger: '#B4261E',
  dangerSoft: '#FDF4F3',
  dangerLine: 'rgba(180,38,30,0.10)',
  dangerBorder: 'rgba(180,38,30,0.18)',
  accent: '#DDF35D',
};

const dark: ColorTokens = {
  bg: '#090A0C',
  chrome: '#15171A',
  chromeRaised: '#22252A',
  text: '#F5F6F7',
  textMuted: '#8F949C',
  ink: '#F5F6F7',
  surface: '#121417',
  surfaceBorder: 'rgba(255,255,255,0.07)',
  surfaceMuted: '#1C1F23',
  hairline: 'rgba(255,255,255,0.06)',
  progressTrack: '#24272C',
  progressFill: '#E9EBEE',
  field: '#1F2226',
  fieldFocusBorder: '#E8FF70',
  caret: '#E8FF70',
  dashed: 'rgba(255,255,255,0.22)',
  skeleton: '#17191C',
  scrim: 'rgba(0,0,0,0.50)',
  scrimSheet: 'rgba(0,0,0,0.55)',
  sheet: '#16181B',
  fab: '#292D29',
  fabIcon: '#E8FF70',
  fabBorder: 'rgba(232,255,112,0.20)',
  fabBorderOpen: 'rgba(232,255,112,0.34)',
  fabPressed: '#232723',
  primary: '#E8FF70',
  onPrimary: '#090A0C',
  selectedBorder: '#E8FF70',
  selectedIcon: '#E8FF70',
  selectedRing: 'rgba(232,255,112,0.10)',
  tabActive: '#22252A',
  actionHighlightBg: 'rgba(232,255,112,0.10)',
  actionHighlightIcon: '#E8FF70',
  incomeBg: 'rgba(232,255,112,0.10)',
  incomeIcon: '#E8FF70',
  successBg: 'rgba(232,255,112,0.12)',
  successIcon: '#E8FF70',
  toast: '#24272C',
  danger: '#FF8A7A',
  dangerSoft: 'rgba(255,138,122,0.06)',
  dangerLine: 'rgba(255,138,122,0.12)',
  dangerBorder: 'rgba(255,138,122,0.22)',
  accent: '#E8FF70',
};

export const colorTokens = { light, dark } as const;

export type ThemeName = keyof typeof colorTokens;
