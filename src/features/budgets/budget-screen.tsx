import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import type { Category } from '@/db/schema';
import {
  buildBudgetProgress,
  computeCategorySpending,
  resolveBudgetLimits,
  type BudgetStatus,
  type CategoryBudgetProgress,
} from '@/domain/budget';
import { formatMonthLabel } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { categoryLabel } from '@/features/categories/category-label';
import { useCategories } from '@/features/categories/use-categories';
import { useMonthTransactions } from '@/features/transactions/use-transactions';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';

import { useBudgetRows } from './use-budgets';

/** Couleur de la barre et du contour selon l'état : sauge (ok), ocre (> 80 %), corail (dépassé). */
const BAR_CLASS: Record<BudgetStatus, string> = { ok: 'bg-sage', warning: 'bg-amber', over: 'bg-coral' };
const BORDER_CLASS: Record<BudgetStatus, string> = { ok: 'border-line', warning: 'border-amber', over: 'border-coral' };

/** Onglet Budget : un plafond mensuel par catégorie de dépenses, avec barre de progression et alertes à 80 % et 100 %. */
export function BudgetScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();

  const month = useToday().slice(0, 7);
  const categories = useCategories('expense');
  const budgetRows = useBudgetRows();
  const monthTransactions = useMonthTransactions(month);

  const progress = useMemo(
    () =>
      buildBudgetProgress(
        categories.map((category) => category.id),
        resolveBudgetLimits(budgetRows, month),
        computeCategorySpending(monthTransactions, month),
      ),
    [categories, budgetRows, monthTransactions, month],
  );

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 px-4 pb-6 pt-4">
        <View className="gap-1">
          <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
            {t('budget.title')}
          </Text>
          <Text className="text-lg font-medium text-muted">
            {t('budget.subtitle')} · {formatMonthLabel(month, locale)}
          </Text>
          <Text className="text-base text-muted">{t('budget.help')}</Text>
        </View>

        {progress.map((entry, index) => (
          <BudgetRow
            key={entry.categoryId}
            category={categories[index]}
            progress={entry}
            onPress={() => router.push({ pathname: '/budget-limit/[categoryId]', params: { categoryId: entry.categoryId } })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function BudgetRow({
  category,
  progress,
  onPress,
}: {
  category: Category;
  progress: CategoryBudgetProgress;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const name = categoryLabel(category, t);
  const { limitCents, spentCents, remainingCents, percent, status } = progress;

  const spent = formatMoney(spentCents, locale);
  const summary = limitCents === null ? t('budget.noLimit') : t('budget.spentOf', { spent, limit: formatMoney(limitCents, locale) });

  let statusText: string | null = null;
  if (status === 'over' && remainingCents !== null) {
    statusText = `⚠️ ${t('budget.statusOver')} · ${t('budget.overBy', { amount: formatMoney(-remainingCents, locale) })}`;
  } else if (status === 'warning' && remainingCents !== null) {
    statusText = `⚠️ ${t('budget.statusWarning')} · ${t('budget.remaining', { amount: formatMoney(remainingCents, locale) })}`;
  } else if (status === 'ok' && remainingCents !== null) {
    statusText = t('budget.remaining', { amount: formatMoney(remainingCents, locale) });
  } else if (spentCents > 0) {
    statusText = t('budget.spentOnly', { spent });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, summary, statusText].filter(Boolean).join(', ')}
      onPress={onPress}
      className={`gap-3 rounded-3xl border-2 bg-surface p-4 active:opacity-70 ${status ? BORDER_CLASS[status] : 'border-line'}`}>
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${category.color}33` }}>
          <Text className="text-2xl">{category.icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-ink" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-base text-muted">{summary}</Text>
        </View>
        <Text className="text-xl text-muted">›</Text>
      </View>

      {status !== null && percent !== null && (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('budget.progress', { percent })}
          accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100) }}
          className="h-3 overflow-hidden rounded-full bg-line">
          <View className={`h-full rounded-full ${BAR_CLASS[status]}`} style={{ width: `${Math.min(percent, 100)}%` }} />
        </View>
      )}

      {statusText !== null && <Text className="text-base font-semibold text-ink">{statusText}</Text>}
    </Pressable>
  );
}
