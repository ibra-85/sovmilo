import { and, desc, eq, isNull, like } from 'drizzle-orm';

import { db } from '@/db/client';
import { useLive } from '@/db/live';
import { transactions, type Transaction } from '@/db/schema';
import type { CategorizedTransactionLike } from '@/domain/budget';

/** Les champs nécessaires aux totaux et aux plafonds d'un mois (`YYYY-MM`), hors opérations supprimées. */
export function useMonthTransactions(month: string): CategorizedTransactionLike[] {
  const { data } = useLive(
    db
      .select({
        type: transactions.type,
        amountCents: transactions.amountCents,
        categoryId: transactions.categoryId,
        occurredOn: transactions.occurredOn,
      })
      .from(transactions)
      .where(and(isNull(transactions.deletedAt), like(transactions.occurredOn, `${month}-%`))),
    [month],
  );
  return data;
}

/** Dernières opérations, de la plus récente à la plus ancienne (à date égale : la dernière saisie d'abord). */
export function useRecentTransactions(limit: number): Transaction[] {
  const { data } = useLive(
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

/** Les opérations d'un mois (`YYYY-MM`), de la plus récente à la plus ancienne. */
export function useMonthOperations(month: string): Transaction[] {
  const { data } = useLive(
    db
      .select()
      .from(transactions)
      .where(and(isNull(transactions.deletedAt), like(transactions.occurredOn, `${month}-%`)))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt)),
    [month],
  );
  return data;
}

/** Toutes les opérations non supprimées, de la plus récente à la plus ancienne. Le tri et les filtres se font ensuite en mémoire. */
export function useAllTransactions(): Transaction[] {
  const { data } = useLive(
    db
      .select()
      .from(transactions)
      .where(isNull(transactions.deletedAt))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt)),
  );
  return data;
}

/**
 * Une opération par son identifiant (non supprimée), suivie en direct : le détail se met à jour après une modification.
 * `loaded` reste faux jusqu'à la première réponse de la base, pour ne pas afficher « introuvable » pendant le chargement.
 */
export function useTransaction(id: string): { transaction: Transaction | undefined; loaded: boolean } {
  const { data, updatedAt } = useLive(
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .limit(1),
    [id],
  );
  return { transaction: data[0], loaded: updatedAt !== undefined };
}
