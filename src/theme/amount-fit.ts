/**
 * Ajustement des montants à la place disponible. Fonctions pures, testées.
 *
 * Pourquoi : un montant de 2 010 200,00 € ne tient pas dans une demi-carte de l'Accueil à 16 sp. Plutôt que de laisser
 * le symbole € passer à la ligne (ou le texte être coupé), on calcule la plus grande taille qui tient, dans une limite
 * raisonnable ; en dessous de cette limite, l'écran change de structure (voir `BudgetRow`, `SummaryCell`).
 *
 * Largeurs : avances réelles d'Inter SemiBold lues dans le fichier de police (em = fraction de la taille du texte).
 * Les chiffres sont tabulaires (même largeur) : on prend le plus large (« 4 » : 0,666) arrondi à 0,67. Les largeurs sont
 * volontairement un peu majorées : `adjustsFontSizeToFit` dans `AmountText` rattrape un éventuel écart (filet de sécurité).
 */
const EM = {
  digit: 0.67,
  separator: 0.32, // , et .
  narrowSpace: 0.17, // U+202F : séparateur de milliers
  space: 0.26, // U+00A0 et espace
  sign: 0.68, // + et − (U+2212)
  currency: 0.68, // €
  other: 0.7,
} as const;

/** Marge de sécurité sur la largeur estimée (crénage, arrondis de mise en page). */
const SAFETY = 1.04;

function glyphEm(char: string): number {
  if (char >= '0' && char <= '9') return EM.digit;
  switch (char) {
    case ',':
    case '.':
      return EM.separator;
    case ' ':
      return EM.narrowSpace;
    case ' ':
    case ' ':
      return EM.space;
    case '+':
    case '−':
    case '-':
      return EM.sign;
    case '€':
      return EM.currency;
    default:
      return EM.other;
  }
}

/** Largeur d'un texte en « em » (multiple de sa taille), interlettrage compris. */
export function textWidthEm(text: string, trackingEm = 0): number {
  let total = 0;
  let count = 0;
  for (const char of text) {
    total += glyphEm(char) + trackingEm;
    count += 1;
  }
  return count === 0 ? 0 : total;
}

export interface AmountRun {
  text: string;
  /** Taille de base (sp) de ce morceau. */
  size: number;
  /** Interlettrage en em (négatif = serré). */
  trackingEm?: number;
}

/** Largeur estimée, en dp, d'un montant fait de plusieurs morceaux (nombre + symbole), à l'échelle `scale` des tailles. */
export function amountWidth(runs: readonly AmountRun[], scale = 1, fontScale = 1): number {
  const raw = runs.reduce((sum, run) => sum + textWidthEm(run.text, run.trackingEm ?? 0) * run.size, 0);
  return raw * scale * fontScale * SAFETY;
}

export interface FitInput {
  runs: readonly AmountRun[];
  /** Largeur disponible en dp. */
  available: number;
  /** Plus petite échelle acceptable (0,6 = 60 % de la taille de base). */
  minScale: number;
  /** Échelle de texte réellement appliquée par Android (réglage système, plafonné par le style). */
  fontScale?: number;
}

export interface FitResult {
  /** 1 = taille de base ; < 1 = réduit. Jamais en dessous de `minScale`. */
  scale: number;
  /** Faux si même à `minScale` le montant dépasse : l'écran doit changer de structure. */
  fits: boolean;
}

/** Plus grande échelle (par pas de 1/40, jamais au-dessus de 1) pour laquelle le montant tient dans la place disponible. */
export function fitAmountScale({ runs, available, minScale, fontScale = 1 }: FitInput): FitResult {
  const full = amountWidth(runs, 1, fontScale);
  if (full <= available || full === 0) return { scale: 1, fits: true };
  const exact = available / full;
  const stepped = Math.floor(exact * 40) / 40;
  if (stepped >= minScale) return { scale: stepped, fits: true };
  return { scale: minScale, fits: amountWidth(runs, minScale, fontScale) <= available };
}

/** Échelle de texte effectivement appliquée : celle du système, plafonnée par `maxFontSizeMultiplier` du style. */
export function effectiveFontScale(systemFontScale: number, maxMultiplier: number): number {
  return Math.min(Math.max(systemFontScale, 1), maxMultiplier);
}
