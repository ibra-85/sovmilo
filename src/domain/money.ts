import { DEFAULT_CURRENCY, INTL_LOCALES, type AppLocale } from './types';

/**
 * Tous les montants de l'application sont des ENTIERS en centimes (jamais de float pour l'argent).
 * Ce fichier fait la frontière entre ce que l'utilisatrice tape / voit et ces centimes.
 */

/** 999 999 999,99 € : large pour un budget familial, et très en dessous de la limite des entiers JS. */
export const MAX_AMOUNT_CENTS = 99_999_999_999;

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Montant invalide (centimes entiers attendus) : ${cents}`);
  }
}

/**
 * Convertit un texte saisi en centimes. Renvoie `null` si le texte n'est pas un montant valide.
 *
 * Accepte la virgule française et le point : « 12,50 », « 12.5 », « 1 234,5 », « ,5 », « 12, ».
 * Si les deux séparateurs apparaissent, le dernier est le séparateur décimal : « 1.234,50 » et « 1,234.50 » valent 1234,50.
 * Refuse : texte vide, négatif, lettres, plus de 2 décimales, montant supérieur à `MAX_AMOUNT_CENTS`.
 */
export function parseAmountToCents(input: string): number | null {
  const compact = input.replace(/\s/g, ''); // \s couvre aussi l'espace insécable que produit Intl en français
  if (!/^[0-9.,]+$/.test(compact)) return null;

  const lastSeparator = Math.max(compact.lastIndexOf(','), compact.lastIndexOf('.'));
  let integerPart = compact;
  let fractionPart = '';

  if (lastSeparator !== -1) {
    const decimalSeparator = compact[lastSeparator];
    integerPart = compact.slice(0, lastSeparator);
    fractionPart = compact.slice(lastSeparator + 1);
    // Avant le séparateur décimal, seul l'AUTRE séparateur est admis (séparateur de milliers).
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    if (integerPart.includes(decimalSeparator)) return null;
    integerPart = integerPart.split(thousandsSeparator).join('');
  }

  if (!/^\d*$/.test(integerPart) || !/^\d{0,2}$/.test(fractionPart)) return null;
  if (integerPart === '' && fractionPart === '') return null;

  const cents = Number(integerPart || '0') * 100 + Number(fractionPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

/** Séparateur décimal de la langue (« , » en français et en russe). */
export function getDecimalSeparator(locale: AppLocale): string {
  const part = new Intl.NumberFormat(INTL_LOCALES[locale]).formatToParts(1.1).find((p) => p.type === 'decimal');
  return part?.value ?? ',';
}

/** Centimes → texte éditable : 1250 → « 12,50 », 1200 → « 12 ». */
export function centsToInputString(cents: number, decimalSeparator = ','): string {
  assertCents(cents);
  if (cents < 0) throw new RangeError(`Montant négatif non éditable : ${cents}`);
  const units = Math.floor(cents / 100);
  const remainder = cents % 100;
  return remainder === 0 ? String(units) : `${units}${decimalSeparator}${String(remainder).padStart(2, '0')}`;
}

/** Symbole de la devise dans la langue (« € »), pour l'afficher à côté du montant en cours de saisie. */
export function getCurrencySymbol(locale: AppLocale, currency = DEFAULT_CURRENCY): string {
  const part = new Intl.NumberFormat(INTL_LOCALES[locale], { style: 'currency', currency })
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return part?.value ?? currency;
}

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Centimes → montant localisé : « 1 234,50 € » en français, « 1 234,50 € » en russe (espaces insécables).
 * `signed` ajoute « + » devant les montants positifs (liste des opérations). Les négatifs ont toujours leur signe.
 */
export function formatMoney(
  cents: number,
  locale: AppLocale,
  options: { currency?: string; signed?: boolean } = {},
): string {
  assertCents(cents);
  const { currency = DEFAULT_CURRENCY, signed = false } = options;
  const key = `${locale}|${currency}|${signed}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALES[locale], {
      style: 'currency',
      currency,
      signDisplay: signed ? 'exceptZero' : 'auto',
    });
    formatters.set(key, formatter);
  }
  // La division n'est utilisée que pour l'AFFICHAGE : un entier de centimes / 100 s'arrondit toujours correctement à 2 décimales.
  return formatter.format(cents / 100);
}

// ---------------------------------------------------------------------------
// Pavé numérique : la saisie est une chaîne canonique « 12.5 » (point décimal, 2 décimales max).
// ---------------------------------------------------------------------------

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'decimal' | 'backspace';

const MAX_INTEGER_DIGITS = 9;
const MAX_FRACTION_DIGITS = 2;

/** Applique une touche du pavé à la saisie en cours et renvoie la nouvelle saisie. */
export function applyKeypadKey(current: string, key: KeypadKey): string {
  if (key === 'backspace') return current.slice(0, -1);

  if (key === 'decimal') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }

  const dot = current.indexOf('.');
  if (dot !== -1) {
    return current.length - dot - 1 >= MAX_FRACTION_DIGITS ? current : current + key;
  }
  if (current === '0') return key; // pas de zéro initial : « 0 » puis « 5 » donne « 5 »
  return current.length >= MAX_INTEGER_DIGITS ? current : current + key;
}

/** Saisie du pavé → texte affiché dans la langue : « 1234.5 » → « 1 234,5 » ; saisie vide → « 0 ». */
export function formatKeypadValue(value: string, locale: AppLocale): string {
  const dot = value.indexOf('.');
  const integerText = dot === -1 ? value : value.slice(0, dot);
  const grouped = new Intl.NumberFormat(INTL_LOCALES[locale], { maximumFractionDigits: 0 }).format(
    Number(integerText || '0'),
  );
  return dot === -1 ? grouped : grouped + getDecimalSeparator(locale) + value.slice(dot + 1);
}

/** Saisie du pavé → centimes (0 si la saisie est vide). */
export function keypadValueToCents(value: string): number {
  return parseAmountToCents(value) ?? 0;
}
