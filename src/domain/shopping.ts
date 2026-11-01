import { parseAmountToCents } from './money';

/**
 * Listes de courses : règles pures (aucune dépendance à la base ni à l'écran), testées.
 *
 * Deux grandeurs numériques, jamais de flottant :
 *  - quantité = ENTIER en millièmes d'unité (`quantityMilli`) : 1,5 kg → 1500 ; 3 pièces → 3000 ;
 *  - prix unitaire = ENTIER en centimes (`unitPriceCents`), facultatif.
 * Le total d'une ligne est un entier de centimes, arrondi UNE fois, à la moitié supérieure (voir `lineTotalCents`).
 * Ces prix sont des ESTIMATIONS de courses : ils ne sont jamais des opérations financières.
 */

export const SHOPPING_UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'pack'] as const;
export type ShoppingUnit = (typeof SHOPPING_UNITS)[number];

export const DEFAULT_SHOPPING_UNIT: ShoppingUnit = 'piece';

export const MAX_LIST_NAME_LENGTH = 60;
export const MAX_ITEM_NAME_LENGTH = 80;

/** 9 999,999 : large pour des courses, et le produit avec le prix maximal reste un entier sûr (≈ 10¹⁵ < 9·10¹⁵). */
export const MAX_QUANTITY_MILLI = 9_999_999;
/** 999 999,99 € par unité. */
export const MAX_UNIT_PRICE_CENTS = 99_999_999;

/** Décimales admises pour la quantité : des fractions seulement là où elles ont un sens (kg, L). */
const UNIT_DECIMALS: Record<ShoppingUnit, number> = { piece: 0, pack: 0, g: 0, ml: 0, kg: 3, l: 3 };

/**
 * Le prix se rapporte à `PRICE_PER` unités de l'unité choisie : au kg pour une quantité en grammes, au litre pour des
 * millilitres (un prix « par gramme » serait inutilisable avec des centimes). Pour les autres unités, par unité.
 */
const PRICE_PER: Record<ShoppingUnit, number> = { piece: 1, pack: 1, kg: 1, l: 1, g: 1000, ml: 1000 };

/** Pas des boutons − / + du formulaire, en millièmes. */
const UNIT_STEP_MILLI: Record<ShoppingUnit, number> = {
  piece: 1000,
  pack: 1000,
  kg: 500,
  l: 500,
  g: 50_000,
  ml: 100_000,
};

/** Quantité proposée quand on choisit une unité : 1 pièce, 1 kg, 250 g, 1 L, 500 mL, 1 paquet. */
const DEFAULT_QUANTITY_MILLI: Record<ShoppingUnit, number> = { piece: 1000, pack: 1000, kg: 1000, l: 1000, g: 250_000, ml: 500_000 };

export const defaultQuantityMilli = (unit: ShoppingUnit): number => DEFAULT_QUANTITY_MILLI[unit];
export const unitDecimals = (unit: ShoppingUnit): number => UNIT_DECIMALS[unit];
export const unitStepMilli = (unit: ShoppingUnit): number => UNIT_STEP_MILLI[unit];

/** Unité de référence du prix : « kg » pour des grammes, « l » pour des millilitres, sinon l'unité elle-même. */
export type PriceUnit = Exclude<ShoppingUnit, 'g' | 'ml'>;

export function priceUnitOf(unit: ShoppingUnit): PriceUnit {
  return unit === 'g' ? 'kg' : unit === 'ml' ? 'l' : unit;
}

export function isShoppingUnit(value: string): value is ShoppingUnit {
  return (SHOPPING_UNITS as readonly string[]).includes(value);
}

/** Espaces superflus retirés (début, fin, doublons, insécables compris) : « ␣␣Pain   complet␣ » → « Pain complet ». */
export function cleanShoppingName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export type NameProblem = 'empty' | 'too-long';

export function validateListName(raw: string): NameProblem | null {
  const name = cleanShoppingName(raw);
  if (name === '') return 'empty';
  return name.length > MAX_LIST_NAME_LENGTH ? 'too-long' : null;
}

export function validateItemName(raw: string): NameProblem | null {
  const name = cleanShoppingName(raw);
  if (name === '') return 'empty';
  return name.length > MAX_ITEM_NAME_LENGTH ? 'too-long' : null;
}

export type QuantityResult =
  | { ok: true; milli: number }
  | { ok: false; reason: 'invalid' | 'zero' | 'decimals' | 'too-large' };

/**
 * Texte saisi → quantité en millièmes. Accepte la virgule et le point (« 1,5 », « 1.5 », « ,5 », « 2, »), refuse zéro,
 * négatif, lettres, plusieurs séparateurs, et plus de décimales que l'unité n'en admet (2,5 pièces, 1,5 g).
 */
export function parseQuantity(input: string, unit: ShoppingUnit): QuantityResult {
  const compact = input.replace(/\s+/g, '');
  const match = /^(\d*)(?:[.,](\d*))?$/.exec(compact);
  if (!match || (match[1] === '' && (match[2] ?? '') === '')) return { ok: false, reason: 'invalid' };

  const integerPart = match[1] ?? '';
  const fractionPart = match[2] ?? '';
  if (fractionPart.replace(/0+$/, '').length > UNIT_DECIMALS[unit]) return { ok: false, reason: 'decimals' };
  if (integerPart.length > 5) return { ok: false, reason: 'too-large' };

  const milli = Number(integerPart || '0') * 1000 + Number(fractionPart.slice(0, 3).padEnd(3, '0'));
  if (milli === 0) return { ok: false, reason: 'zero' };
  if (milli > MAX_QUANTITY_MILLI) return { ok: false, reason: 'too-large' };
  return { ok: true, milli };
}

/** Quantité → texte éditable : 1500 → « 1,5 », 3000 → « 3 », 250 → « 0,25 ». */
export function quantityToInputString(milli: number, decimalSeparator = ','): string {
  if (!Number.isSafeInteger(milli) || milli < 0) throw new RangeError(`Quantité invalide : ${milli}`);
  const units = Math.floor(milli / 1000);
  const fraction = String(milli % 1000).padStart(3, '0').replace(/0+$/, '');
  return fraction === '' ? String(units) : `${units}${decimalSeparator}${fraction}`;
}

/** Ajoute `deltaMilli` à une quantité, sans jamais sortir de ]0 ; MAX] (le « − » s'arrête au plus petit pas positif). */
export function stepQuantity(milli: number, deltaMilli: number): number {
  const next = milli + deltaMilli;
  if (next > MAX_QUANTITY_MILLI) return MAX_QUANTITY_MILLI;
  if (next <= 0) return milli;
  return next;
}

export type PriceResult = { ok: true; cents: number | null } | { ok: false; reason: 'invalid' | 'too-large' };

/**
 * Prix saisi → centimes. Vide (ou 0) = « pas de prix » : le prix est facultatif et l'article reste pleinement utilisable.
 * Même syntaxe que les montants de l'application (virgule française, point, espaces).
 */
export function parseUnitPrice(input: string): PriceResult {
  const compact = input.replace(/\s+/g, '');
  if (compact === '') return { ok: true, cents: null };
  const cents = parseAmountToCents(compact);
  if (cents === null) {
    // Une suite de chiffres très longue est un montant trop grand ; tout le reste (lettres, signe, séparateurs en trop) est invalide.
    return { ok: false, reason: /^\d{9,}/.test(compact) ? 'too-large' : 'invalid' };
  }
  if (cents === 0) return { ok: true, cents: null };
  if (cents > MAX_UNIT_PRICE_CENTS) return { ok: false, reason: 'too-large' };
  return { ok: true, cents };
}

export interface PricedLine {
  quantityMilli: number;
  unit: ShoppingUnit;
  unitPriceCents: number | null;
}

/**
 * Total estimé d'une ligne, en centimes entiers : quantité × prix unitaire, arrondi UNE fois à la moitié supérieure.
 * 250 g à 4,20 €/kg → 1,05 € ; 3 pièces à 0,333 € ne se produit pas (les prix sont en centimes) ; 0,5 kg à 3,35 €/kg → 1,68 €
 * (1,675 arrondi). `null` quand l'article n'a pas de prix : il n'entre dans aucun total.
 */
export function lineTotalCents(line: PricedLine): number | null {
  if (line.unitPriceCents === null) return null;
  const divisor = 1000 * PRICE_PER[line.unit];
  const product = line.quantityMilli * line.unitPriceCents;
  if (!Number.isSafeInteger(product)) throw new RangeError('Montant hors limites');
  return Math.floor((product + divisor / 2) / divisor);
}

export interface ShoppingItemLike extends PricedLine {
  checked: boolean;
  sortOrder: number;
  createdAt: string;
  checkedAt: string | null;
}

export interface ShoppingEstimate {
  /** Somme des totaux des lignes AVEC prix. Jamais un total « complet » quand `partial` est vrai. */
  cents: number;
  pricedCount: number;
  unpricedCount: number;
  /** Vrai si au moins un article n'a pas de prix : le total est un minimum, pas un montant définitif. */
  partial: boolean;
}

export interface ShoppingSummary<T extends ShoppingItemLike> {
  total: number;
  remaining: number;
  checked: number;
  /** À acheter : triés dans l'ordre d'ajout. */
  todo: T[];
  /** Déjà pris : le dernier coché en premier. */
  done: T[];
  /** Estimation des articles RESTANT à acheter (ceux déjà pris ne comptent plus). */
  estimate: ShoppingEstimate;
}

/** Sépare les articles à acheter / déjà pris et estime le reste à acheter. */
export function summarizeItems<T extends ShoppingItemLike>(items: readonly T[]): ShoppingSummary<T> {
  const todo = items.filter((item) => !item.checked).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  const done = items.filter((item) => item.checked).sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? '') || a.sortOrder - b.sortOrder);

  let cents = 0;
  let pricedCount = 0;
  for (const item of todo) {
    const total = lineTotalCents(item);
    if (total === null) continue;
    cents += total;
    pricedCount += 1;
  }
  if (!Number.isSafeInteger(cents)) throw new RangeError('Montant hors limites');
  const unpricedCount = todo.length - pricedCount;

  return {
    total: items.length,
    remaining: todo.length,
    checked: done.length,
    todo,
    done,
    estimate: { cents, pricedCount, unpricedCount, partial: unpricedCount > 0 },
  };
}
