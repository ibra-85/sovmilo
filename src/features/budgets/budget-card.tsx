import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BudgetRow, Surface } from '@/components/ui';
import { categoryLabel } from '@/features/categories/category-label';

import type { BudgetEntry } from './use-budget-overview';

/** Ouvre le détail d'un budget (route `budget-detail/[categoryId]`). */
export function useOpenBudget() {
  const router = useRouter();
  return (categoryId: string) => router.push({ pathname: '/budget-detail/[categoryId]', params: { categoryId } });
}

/** Carte qui regroupe des lignes de budget (Accueil : « Budgets à surveiller », Budgets : « À surveiller », « Dans les limites »). */
export function BudgetCard({ entries }: { entries: readonly BudgetEntry[] }) {
  const { t } = useTranslation();
  const open = useOpenBudget();

  return (
    <Surface style={{ padding: 6 }}>
      {entries.map(({ category, progress }) => (
        <BudgetRow
          key={category.id}
          embedded
          name={categoryLabel(category, t)}
          categoryIcon={category.icon}
          spentCents={progress.spentCents}
          limitCents={progress.limitCents}
          remainingCents={progress.remainingCents}
          percent={progress.percent}
          status={progress.status}
          onPress={() => open(category.id)}
        />
      ))}
    </Surface>
  );
}
