import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { budgets } from '@/db/schema';
import type { BudgetRow } from '@/domain/budget';

/**
 * Toutes les lignes de plafonds, y compris supprimées : `resolveBudgetLimits` s'en sert pour savoir
 * à partir de quel mois un plafond a été retiré.
 */
export function useBudgetRows(): BudgetRow[] {
  const { data } = useLiveQuery(db.select().from(budgets));
  return useMemo(
    () =>
      data.map((row) => ({
        categoryId: row.categoryId,
        month: row.month,
        amountCents: row.amountCents,
        deleted: row.deletedAt !== null,
      })),
    [data],
  );
}
