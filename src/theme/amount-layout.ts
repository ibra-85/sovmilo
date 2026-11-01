import { formatMoneyParts } from '@/domain/money';
import type { AppLocale } from '@/domain/types';

import { effectiveFontScale, fitAmountScale } from './amount-fit';
import { maxFontScale, typography, type TypographyVariant } from './typography';

/**
 * Tailles de montant du design (design/DESIGN.md §3.2) :
 *  `input` 60 (saisie) · `hero` 56 (détail d'un budget) · `detail` 52 (détail d'une opération)
 *  `home` 46 (Accueil) · `summary` 44 (Budgets) · `total` 22 (total secondaire) · `row` 16 (ligne de liste).
 */
export type AmountSize = 'input' | 'hero' | 'detail' | 'home' | 'summary' | 'total' | 'row';

interface SizeSpec {
  variant: TypographyVariant;
  /** Taille du symbole € quand il est plus petit et grisé (grands montants) ; absent = même style que le nombre. */
  unitSize?: number;
  /**
   * Plus petite échelle acceptée quand le montant ne tient pas (1 = taille de base). Les grands montants focaux peuvent
   * descendre loin ; une ligne de liste ne descend pas sous 14 sp (16 × 0,875) : au-delà, l'écran change de structure.
   */
  minScale: number;
}

export const amountSizes: Record<AmountSize, SizeSpec> = {
  input: { variant: 'amountInput', unitSize: 34, minScale: 0.5 },
  hero: { variant: 'amountHero', unitSize: 34, minScale: 0.5 },
  detail: { variant: 'amountDetail', unitSize: 32, minScale: 0.5 },
  home: { variant: 'amountHome', unitSize: 30, minScale: 0.55 },
  summary: { variant: 'amountSummary', unitSize: 30, minScale: 0.55 },
  total: { variant: 'amountTotal', minScale: 0.7 },
  row: { variant: 'amountRow', minScale: 0.875 },
};

/** Espace insécable : le symbole € reste toujours collé à son nombre (jamais seul sur la ligne suivante). */
export const NO_BREAK_SPACE = ' ';

/** Interlettrage du symbole € des grands montants (voir `amountUnit` dans la typographie), en em. */
const UNIT_TRACKING_EM = -0.01;

interface LayoutAmountInput {
  cents: number;
  locale: AppLocale;
  size: AmountSize;
  signed?: boolean;
  fraction?: 'always' | 'auto';
  maxWidth?: number;
  /** Échelle de texte du système (`useWindowDimensions().fontScale`). */
  fontScale: number;
}

/**
 * Mise en forme et ajustement d'un montant, sans rien afficher : sert à `AmountText` et aux écrans qui doivent choisir
 * leur structure selon la place (« est-ce que ce montant tient à côté de l'icône, ou faut-il le passer dessous ? »).
 * `fit.fits` est faux quand même à l'échelle minimale la place manque.
 */
export function layoutAmount({ cents, locale, size, signed = false, fraction = 'always', maxWidth, fontScale }: LayoutAmountInput) {
  const spec = amountSizes[size];
  const parts = formatMoneyParts(cents, locale, { signed, fraction });
  const number = `${parts.sign}${parts.integer}${parts.decimal}${parts.fraction}`;
  const unitText = parts.currencyFirst ? `${parts.currency}${NO_BREAK_SPACE}` : `${NO_BREAK_SPACE}${parts.currency}`;

  const base = typography[spec.variant];
  const baseSize = base.fontSize as number;
  const baseTrackingEm = ((base.letterSpacing as number | undefined) ?? 0) / baseSize;
  const unitBase = spec.unitSize ?? baseSize;
  const unitTrackingEm = spec.unitSize ? UNIT_TRACKING_EM : baseTrackingEm;

  const fit =
    maxWidth === undefined
      ? { scale: 1, fits: true }
      : fitAmountScale({
          runs: [
            { text: number, size: baseSize, trackingEm: baseTrackingEm },
            { text: unitText, size: unitBase, trackingEm: unitTrackingEm },
          ],
          available: maxWidth,
          minScale: spec.minScale,
          fontScale: effectiveFontScale(fontScale, maxFontScale[spec.variant]),
        });
  return { number, unitText, parts, fit };
}
