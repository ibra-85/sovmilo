import { and, desc, isNull, like } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { transactions, type Transaction } from '@/db/schema';
import type { TransactionLike } from '@/domain/budget';

/** Les 3 champs nécessaires au calcul des totaux d'un mois (`YYYY-MM`), hors opérations supprimées. */
export function useMonthTransactions(month: string): TransactionLike[] {
  const { data } = useLiveQuery(
    db
      .select({ type: transactions.type, amountCents: transactions.amountCents, occurredOn: transactions.occurredOn })
      .from(transactions)
      .where(and(isNull(transactions.deletedAt), like(transactions.occurredOn, `${month}-%`))),
    [month],
  );
  return data;
}

/** Dernières opérations, de la plus récente à la plus ancienne (à date égale : la dernière saisie d'abord). */
export function useRecentTransactions(limit: number): Transaction[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(transactions)
      .where(isNull(transactions.deletedAt))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
      .limit(limit),
    [limit],
  );
  return data;
}
