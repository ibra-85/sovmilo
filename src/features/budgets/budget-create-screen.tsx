import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import { useSelectedMonth } from '@/hooks/use-selected-month';

import { BudgetForm } from './budget-form';
import { setBudget } from './repository';
import { useBudgetOverview } from './use-budget-overview';

/** Créer un budget (design/screens/09-create-budget) : seules les catégories sans budget ce mois-ci sont proposées. */
export function BudgetCreateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { month } = useSelectedMonth();
  const { categories, entries } = useBudgetOverview(month);

  const budgeted = new Set(entries.map((entry) => entry.category.id));
  const available = categories.filter((category) => !budgeted.has(category.id));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/budget');
  }

  return (
    <BudgetForm
      mode="create"
      month={month}
      availableCategories={available}
      onClose={close}
      onSubmit={({ categoryId, amountCents }) => {
        setBudget(categoryId, month, amountCents);
        close();
        toast.show({ message: t('budget.created') });
      }}
    />
  );
}
