import { parseAmountToCents } from './money';
import type { PaymentMethod, TransactionType } from './types';

/** Une opération telle que l'écran Historique la manipule : le nom de catégorie est déjà traduit dans la langue active. */
export interface HistoryItem {
  type: TransactionType;
  amountCents: number;
  categoryId: string | null;
  paymentMethod: PaymentMethod;
  /** Date au format `YYYY-MM-DD`. */
  occurredOn: string;
  note: string | null;
  /** Nom de la catégorie dans la langue active ; vide pour un virement vers l'épargne. */
  categoryName: string;
}

export interface HistoryFilters {
  /** Texte libre : cherché dans la note, le nom de la catégorie et le montant. */
  query: string;
  type: TransactionType | null;
  paymentMethod: PaymentMethod | null;
  categoryId: string | null;
}

export const EMPTY_FILTERS: HistoryFilters = { query: '', type: null, paymentMethod: null, categoryId: null };

/**
 * Met un texte sous une forme comparable : minuscules, sans accents, espaces simplifiés.
 * « Éléctricité » ≈ « electricite » ; en russe « ё » ≈ « е » (la décomposition Unicode retire le tréma).
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nombre de filtres actifs parmi type / paiement / catégorie (la recherche texte est comptée à part). */
export function countActiveFilters(filters: HistoryFilters): number {
  return [filters.type, filters.paymentMethod, filters.categoryId].filter((value) => value !== null).length;
}

/**
 * Garde les opérations qui respectent TOUS les filtres. Pour le texte, chaque mot tapé doit se retrouver
 * dans la note ou le nom de catégorie, ou être un montant égal à celui de l'opération (« 12,50 »).
 * L'ordre d'origine est conservé.
 */
export function filterHistory<T extends HistoryItem>(items: readonly T[], filters: HistoryFilters): T[] {
  const words = normalizeSearch(filters.query)
    .split(' ')
    .filter((word) => word !== '');
  const wantedAmounts = words.map((word) => parseAmountToCents(word));

  return items.filter((item) => {
    if (filters.type !== null && item.type !== filters.type) return false;
    if (filters.paymentMethod !== null && item.paymentMethod !== filters.paymentMethod) return false;
    if (filters.categoryId !== null && item.categoryId !== filters.categoryId) return false;
    if (words.length === 0) return true;

    const haystack = normalizeSearch(`${item.categoryName} ${item.note ?? ''}`);
    return words.every((word, index) => haystack.includes(word) || wantedAmounts[index] === item.amountCents);
  });
}

export interface MonthGroup<T> {
  /** `YYYY-MM`. */
  month: string;
  items: T[];
}

/** Regroupe par mois (`occurredOn`). Les mois et les éléments gardent l'ordre d'entrée (trié du plus récent au plus ancien en amont). */
export function groupByMonth<T extends { occurredOn: string }>(items: readonly T[]): MonthGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const month = item.occurredOn.slice(0, 7);
    const group = groups.get(month);
    if (group) group.push(item);
    else groups.set(month, [item]);
  }
  return [...groups].map(([month, groupItems]) => ({ month, items: groupItems }));
}

export interface DayGroup<T> {
  /** `YYYY-MM-DD`. */
  day: string;
  items: T[];
  /** Total net du jour : revenus − dépenses − virements vers l'épargne (PROPOSITION du design : net). */
  netCents: number;
}

/** Regroupe par jour (`occurredOn`) en gardant l'ordre d'entrée (du plus récent au plus ancien en amont). */
export function groupByDay<T extends { occurredOn: string; type: TransactionType; amountCents: number }>(
  items: readonly T[],
): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const item of items) {
    let group = groups.get(item.occurredOn);
    if (!group) {
      group = { day: item.occurredOn, items: [], netCents: 0 };
      groups.set(item.occurredOn, group);
    }
    group.items.push(item);
    group.netCents += item.type === 'income' ? item.amountCents : -item.amountCents;
  }
  return [...groups.values()];
}
