import type { TextStyle } from 'react-native';

/**
 * Typographie : une seule famille, Inter, en trois graisses (400, 500, 600 : pas de 700), cyrillique inclus.
 * Échelle OBSERVÉE dans les maquettes (design/DESIGN.md §3.2). Les interlignes des textes courants sont une
 * PROPOSITION (×1,3 environ) : la maquette ne fixe que celui des montants (1,0).
 */

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

type FontWeightName = keyof typeof fontFamilies;

interface VariantSpec {
  size: number;
  weight: FontWeightName;
  /** Interlettrage en em (valeur de la maquette). */
  tracking?: number;
  /** Interligne en multiple de la taille. */
  leading?: number;
  /** Chiffres alignables : tous les montants. */
  tabular?: boolean;
  /** Plafond du réglage « taille de police » d'Android (les grands montants débordent sinon). */
  maxScale?: number;
}

const specs = {
  // --- Montants (chiffres tabulaires, interligne 1,0) ---
  /** Saisie d'un montant (ajout, budget) : 60 sp. */
  amountInput: { size: 60, weight: 'semibold', tracking: -0.045, leading: 1, tabular: true, maxScale: 1.1 },
  /** Montant focal du détail d'un budget : 56 sp. */
  amountHero: { size: 56, weight: 'semibold', tracking: -0.045, leading: 1, tabular: true, maxScale: 1.1 },
  /** Montant focal du détail d'une opération : 52 sp. */
  amountDetail: { size: 52, weight: 'semibold', tracking: -0.045, leading: 1, tabular: true, maxScale: 1.1 },
  /** Montant focal de l'Accueil : 46 sp. */
  amountHome: { size: 46, weight: 'semibold', tracking: -0.04, leading: 1, tabular: true, maxScale: 1.15 },
  /** Montant focal de Budgets : 44 sp. */
  amountSummary: { size: 44, weight: 'semibold', tracking: -0.04, leading: 1, tabular: true, maxScale: 1.15 },
  /** Total secondaire : 22 sp. */
  amountTotal: { size: 22, weight: 'semibold', tracking: -0.02, leading: 1.2, tabular: true },
  /** Montant d'une ligne de liste : 16 sp. */
  amountRow: { size: 16, weight: 'semibold', tabular: true, leading: 1.3 },
  /** Symbole € des grands montants (30–34 sp, gris). */
  amountUnit: { size: 32, weight: 'medium', tracking: -0.01, leading: 1, tabular: true, maxScale: 1.1 },

  // --- Titres ---
  /** Titre d'écran racine (Opérations, Budgets) : 26 sp. */
  titleRoot: { size: 26, weight: 'semibold', tracking: -0.035, leading: 1.2 },
  /** Logotype « Sovmilo » de l'Accueil : 24 sp. */
  logotype: { size: 24, weight: 'semibold', tracking: -0.03, leading: 1.2 },
  /** Nom focal (détail) : 22 sp. */
  titleFocal: { size: 22, weight: 'semibold', tracking: -0.02, leading: 1.25 },
  /** Titre d'écran secondaire (avec retour) : 20 sp. */
  titleScreen: { size: 20, weight: 'semibold', tracking: -0.02, leading: 1.25 },
  /** Titre de section : 19 sp. */
  titleSection: { size: 19, weight: 'semibold', tracking: -0.02, leading: 1.25 },
  /** Titre de panneau ou de dialogue : 18 sp. */
  titleSheet: { size: 18, weight: 'semibold', tracking: -0.015, leading: 1.3 },

  // --- Corps ---
  /** Valeur de champ forte : 17 sp. */
  fieldValue: { size: 17, weight: 'medium', tracking: -0.015, leading: 1.3 },
  /** Corps et libellé de ligne : 16 sp. */
  body: { size: 16, weight: 'medium', leading: 1.35 },
  /** Bouton, montant de ligne : 16 sp en 600. */
  bodyStrong: { size: 16, weight: 'semibold', leading: 1.35 },
  /** Libellé de groupe (« Catégorie ») : 15 sp. */
  label: { size: 15, weight: 'semibold', leading: 1.3 },
  /** Texte secondaire, période : 14 sp. */
  secondary: { size: 14, weight: 'medium', leading: 1.35 },
  /** Onglet actif, option sélectionnée : 14 sp en 600. */
  secondaryStrong: { size: 14, weight: 'semibold', tracking: -0.005, leading: 1.35 },
  /** Légende : 13 sp. */
  caption: { size: 13, weight: 'regular', leading: 1.35 },
  captionMedium: { size: 13, weight: 'medium', leading: 1.35 },
  /** Micro (heure, étiquettes de graphique) : 12 sp. */
  micro: { size: 12, weight: 'medium', leading: 1.35 },
} as const satisfies Record<string, VariantSpec>;

export type TypographyVariant = keyof typeof specs;

function toStyle(spec: VariantSpec): TextStyle {
  return {
    fontFamily: fontFamilies[spec.weight],
    fontSize: spec.size,
    lineHeight: Math.round(spec.size * (spec.leading ?? 1.35)),
    letterSpacing: spec.tracking === undefined ? undefined : Number((spec.tracking * spec.size).toFixed(2)),
    fontVariant: spec.tabular ? ['tabular-nums'] : undefined,
    includeFontPadding: false, // Android : sans cela, les grands chiffres reçoivent une marge verticale parasite
  };
}

/** Styles React Native prêts à l'emploi, un par rôle typographique. */
export const typography: Record<TypographyVariant, TextStyle> = Object.fromEntries(
  Object.entries(specs).map(([name, spec]) => [name, toStyle(spec)]),
) as Record<TypographyVariant, TextStyle>;

/** Plafond de mise à l'échelle par rôle (undefined = réglage système sans limite). */
export const maxFontScale: Partial<Record<TypographyVariant, number>> = Object.fromEntries(
  Object.entries(specs)
    .filter(([, spec]) => 'maxScale' in spec)
    .map(([name, spec]) => [name, (spec as VariantSpec).maxScale]),
);
