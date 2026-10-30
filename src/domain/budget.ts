import { isMonthKey } from './dates';
import type { TransactionType } from './types';

/** Ce dont le calcul a besoin d'une opération (les lignes supprimées doivent être filtrées en amont). */
export interface TransactionLike {
  type: TransactionType;
  amountCents: number;
  /** Date au format `YYYY-MM-DD`. */
  occurredOn: string;
}

export interface MonthTotals {
  incomeCents: number;
  expenseCents: number;
  /** Virements vers l'épargne : ils sortent du budget mais ne sont pas des dépenses. */
  savingsCents: number;
  /** Reste à dépenser = revenus − dépenses − virements vers l'épargne. Peut être négatif. */
  remainingCents: number;
  /** Nombre d'opérations du mois, tous types confondus. */
  operationCount: number;
}

/** Totaux d'un mois (`YYYY-MM`). Les opérations des autres mois sont ignorées. */
export function computeMonthTotals(transactions: readonly TransactionLike[], month: string): MonthTotals {
  if (!isMonthKey(month)) throw new RangeError(`Mois invalide (format YYYY-MM attendu) : ${month}`);

  let incomeCents = 0;
  let expenseCents = 0;
  let savingsCents = 0;
  let operationCount = 0;

  for (const tx of transactions) {
    if (!tx.occurredOn.startsWith(`${month}-`)) continue;
    if (!Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) {
      throw new RangeError(`Montant d'opération invalide (entier > 0 attendu) : ${tx.amountCents}`);
    }
    operationCount += 1;
    switch (tx.type) {
      case 'income':
        incomeCents += tx.amountCents;
        break;
      case 'expense':
        expenseCents += tx.amountCents;
        break;
      case 'transfer':
        savingsCents += tx.amountCents;
        break;
    }
  }

  return {
    incomeCents,
    expenseCents,
    savingsCents,
    remainingCents: incomeCents - expenseCents - savingsCents,
    operationCount,
  };
}
