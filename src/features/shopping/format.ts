import type { TFunction } from 'i18next';

import { formatMoney } from '@/domain/money';
import { priceUnitOf, type ShoppingUnit } from '@/domain/shopping';
import { INTL_LOCALES, type AppLocale } from '@/domain/types';

const numberFormats = new Map<AppLocale, Intl.NumberFormat>();

function numberFormat(locale: AppLocale): Intl.NumberFormat {
  let format = numberFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(INTL_LOCALES[locale], { maximumFractionDigits: 3 });
    numberFormats.set(locale, format);
  }
  return format;
}

/**
 * Quantité à afficher : « × 3 » pour des pièces, « 1,5 kg », « 250 g », « 2 L »… La division par 1000 ne sert qu'à
 * l'AFFICHAGE d'un entier de millièmes (trois décimales au plus, toujours exactes). L'espace avant l'unité est insécable.
 */
export function formatQuantity(milli: number, unit: ShoppingUnit, locale: AppLocale, t: TFunction): string {
  const amount = numberFormat(locale).format(milli / 1000);
  return unit === 'piece' ? `× ${amount}` : `${amount} ${t(`shopping.unitShort.${unit}`)}`;
}

/** Prix unitaire à afficher : « 1,20 €/L ». Pour des grammes, le prix est au kg ; pour des millilitres, au litre. */
export function formatUnitPrice(cents: number, unit: ShoppingUnit, locale: AppLocale, t: TFunction): string {
  return `${formatMoney(cents, locale)}/${t(`shopping.priceShort.${priceUnitOf(unit)}`)}`;
}

/** Détail sous le nom d'un article : quantité, puis prix unitaire s'il est renseigné. */
export function formatItemDetails(
  item: { quantityMilli: number; unit: ShoppingUnit; unitPriceCents: number | null },
  locale: AppLocale,
  t: TFunction,
): string {
  const quantity = formatQuantity(item.quantityMilli, item.unit, locale, t);
  return item.unitPriceCents === null ? quantity : `${quantity} · ${formatUnitPrice(item.unitPriceCents, item.unit, locale, t)}`;
}
