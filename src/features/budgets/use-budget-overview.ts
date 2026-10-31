import { useMemo } from 'react';

import type { Category } from '@/db/schema';
import {
  buildBudgetProgress,
  compareByUrgency,
  computeCategorySpending,
  hasLimit,
  resolveBudgetLimits,
  summarizeBudgets,
  type BudgetSummary,
  type LimitedBudgetProgress,
} from '@/domain/budget';
import { useCategories } from '@/features/categories/use-categories';
import { useMonthTransactions } from '@/features/transactions/use-transactions';

import { useBudgetRows } from './use-budgets';

export interface BudgetEntry {
  category: Category;
  progress: LimitedBudgetProgress;
}

export interface BudgetOverview {
  /** Catégories de dépenses actives : « Créer un budget » propose celles qui n'ont pas encore de plafond. */
  categories: Category[];
  /** Budgets du mois (catégories avec plafond), du plus urgent au moins urgent. */
  entries: BudgetEntry[];
  /** Budgets dépassés ou presque atteints (« À surveiller »). */
  watched: BudgetEntry[];
  /** Budgets dans les limites. */
  withinLimits: BudgetEntry[];
  summary: BudgetSummary;
}

/** Budgets d'un mois (`YYYY-MM`) : plafonds en vigueur, dépenses, état de chaque budget et résumé. Se met à jour toute seule. */
export function useBudgetOverview(month: string): BudgetOverview {
  const categories = useCategories('expense');
  const budgetRows = useBudgetRows();
  const monthTransactions = useMonthTransactions(month);

  return useMemo(() => {
    const progress = buildBudgetProgress(
      categories.map((category) => category.id),
      resolveBudgetLimits(budgetRows, month),
      computeCategorySpending(monthTransactions, month),
    );
    const entries: BudgetEntry[] = [];
    progress.forEach((item, index) => {
      if (hasLimit(item)) entries.push({ category: categories[index], progress: item });
    });
    entries.sort((a, b) => compareByUrgency(a.progress, b.progress));

    return {
      categories,
      entries,
      watched: entries.filter((entry) => entry.progress.status !== 'ok'),
      withinLimits: entries.filter((entry) => entry.progress.status === 'ok'),
      summary: summarizeBudgets(entries.map((entry) => entry.progress)),
    };
  }, [categories, budgetRows, monthTransactions, month]);
}
