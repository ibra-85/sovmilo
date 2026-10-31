import { type StyleProp, type TextStyle } from 'react-native';

import { formatMoney, formatMoneyParts } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';
import { typography, type TypographyVariant } from '@/theme/typography';

import { Text, type TextTone } from './text';

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
}

const sizes: Record<AmountSize, SizeSpec> = {
  input: { variant: 'amountInput', unitSize: 34 },
  hero: { variant: 'amountHero', unitSize: 34 },
  detail: { variant: 'amountDetail', unitSize: 32 },
  home: { variant: 'amountHome', unitSize: 30 },
  summary: { variant: 'amountSummary', unitSize: 30 },
  total: { variant: 'amountTotal' },
  row: { variant: 'amountRow' },
};

export interface AmountTextProps {
  /** Montant en centimes entiers (négatif = dépense). */
  cents: number;
  size?: AmountSize;
  /** Affiche « + » devant les montants positifs (revenus, résultat du mois). Les négatifs ont toujours leur signe. */
  signed?: boolean;
  /** `auto` masque « ,00 » des montants ronds (« 312 € ») sans jamais arrondir les autres. */
  fraction?: 'always' | 'auto';
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  /** Lu par TalkBack à la place du montant complet (ex. « Montant : 42,80 euros »). */
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Montant du design system : signe écrit (vrai signe moins), chiffres tabulaires, séparateur de milliers en espace
 * fine, et — sur les grands montants — symbole € plus petit et grisé. Toute la mise en forme vient de
 * `formatMoneyParts` (domaine, testé) : ce composant ne calcule rien.
 */
export function AmountText({
  cents,
  size = 'row',
  signed = false,
  fraction = 'always',
  tone = 'default',
  align,
  accessibilityLabel,
  style,
}: AmountTextProps) {
  const locale = useLocale();
  const spec = sizes[size];
  const parts = formatMoneyParts(cents, locale, { signed, fraction });
  const number = `${parts.sign}${parts.integer}${parts.decimal}${parts.fraction}`;
  const unit = ` ${parts.currency}`;

  const currency = (
    <Text
      variant="amountUnit"
      tone={spec.unitSize ? 'muted' : tone}
      style={spec.unitSize ? { fontSize: spec.unitSize, lineHeight: spec.unitSize } : typography[spec.variant]}>
      {parts.currencyFirst ? `${parts.currency} ` : unit}
    </Text>
  );

  return (
    <Text
      variant={spec.variant}
      tone={tone}
      accessible
      accessibilityLabel={accessibilityLabel ?? formatMoney(cents, locale, { signed })}
      style={[{ textAlign: align }, style]}>
      {parts.currencyFirst && currency}
      {number}
      {!parts.currencyFirst && currency}
    </Text>
  );
}
