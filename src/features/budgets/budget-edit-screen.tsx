import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppScreen, Button, EmptyState, ScreenHeader, useToast } from '@/components/ui';
import { useCategoryMap } from '@/features/categories/use-categories';
import { useSelectedMonth } from '@/hooks/use-selected-month';
import { space } from '@/theme/layout';

import { BudgetForm } from './budget-form';
import { getCurrentLimit, setBudget } from './repository';

/** Modifier la limite d'un budget (design/screens/10-edit-budget). La catégorie et la période ne changent pas. */
export function BudgetEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { month } = useSelectedMonth();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const category = useCategoryMap().get(categoryId);

  // Plafond actuel, lu une seule fois à l'ouverture (lecture directe : un hook renverrait d'abord une liste vide).
  const [currentLimit] = useState(() => getCurrentLimit(categoryId, month));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/budget');
  }

  if (!category || currentLimit === null) {
    return (
      <AppScreen bottomInset>
        <ScreenHeader title={t('budget.editTitle')} onBack={close} backLabel={t('budget.back')} />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.screen }}>
          <EmptyState icon="budgets" title={t('budget.notFound')} />
          <Button label={t('budget.back')} variant="secondary" onPress={close} />
        </View>
      </AppScreen>
    );
  }

  return (
    <BudgetForm
      mode="edit"
      month={month}
      category={category}
      initialCents={currentLimit}
      onClose={close}
      onSubmit={({ categoryId: id, amountCents }) => {
        setBudget(id, month, amountCents);
        close();
        toast.show({ message: t('budget.updated') });
      }}
    />
  );
}
