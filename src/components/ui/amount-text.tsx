import { useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';

import { formatMoney } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';
import { amountSizes, layoutAmount, type AmountSize } from '@/theme/amount-layout';
import { typography } from '@/theme/typography';

import { Text, type TextTone } from './text';

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
  /**
   * Largeur disponible (dp) : le montant est réduit jusqu'à `minScale` pour y tenir. Sans elle, c'est le filet natif
   * (`adjustsFontSizeToFit`) qui réduit au besoin. Le parent connaît sa place : il la donne quand il peut.
   */
  maxWidth?: number;
  /** Lu par TalkBack à la place du montant complet (ex. « Montant : 42,80 euros »). */
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Montant du design system : signe écrit (vrai signe moins), chiffres tabulaires, séparateur de milliers en espace
 * fine, et — sur les grands montants — symbole € plus petit et grisé. Toute la mise en forme vient de
 * `formatMoneyParts` (domaine, testé) : ce composant ne calcule rien d'autre que la taille.
 *
 * Robustesse (gros montants) : le montant tient TOUJOURS sur une ligne, symbole inclus (espace insécable). Si `maxWidth` est
 * donné, la taille est calculée (`theme/amount-fit.ts`, testé) ; dans tous les cas `adjustsFontSizeToFit` réduit encore
 * si la place manque, plutôt que de couper le texte ou de renvoyer le € à la ligne.
 */
export function AmountText({
  cents,
  size = 'row',
  signed = false,
  fraction = 'always',
  tone = 'default',
  align,
  maxWidth,
  accessibilityLabel,
  style,
}: AmountTextProps) {
  const locale = useLocale();
  const { fontScale } = useWindowDimensions();
  const spec = amountSizes[size];
  const { number, unitText, parts, fit } = layoutAmount({ cents, locale, size, signed, fraction, maxWidth, fontScale });
  const base = typography[spec.variant];
  const baseSize = base.fontSize as number;
  const scale = fit.scale;
  const px = (value: number) => Math.round(value * scale * 2) / 2;

  const numberStyle: TextStyle | undefined =
    scale === 1
      ? undefined
      : {
          fontSize: px(baseSize),
          lineHeight: px(base.lineHeight as number),
          letterSpacing: base.letterSpacing === undefined ? undefined : px(base.letterSpacing as number),
        };

  const unitStyle: TextStyle = spec.unitSize
    ? { fontSize: px(spec.unitSize), lineHeight: px(spec.unitSize) }
    : { ...typography[spec.variant], ...numberStyle };

  const currency = (
    <Text variant="amountUnit" tone={spec.unitSize ? 'muted' : tone} style={unitStyle}>
      {unitText}
    </Text>
  );

  return (
    <Text
      variant={spec.variant}
      tone={tone}
      accessible
      accessibilityLabel={accessibilityLabel ?? formatMoney(cents, locale, { signed })}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      style={[{ textAlign: align, flexShrink: 1 }, numberStyle, style]}>
      {parts.currencyFirst && currency}
      {number}
      {!parts.currencyFirst && currency}
    </Text>
  );
}
