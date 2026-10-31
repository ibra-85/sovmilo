import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import { tabContentStyle } from '@/components/navigation';
import {
  AppScreen,
  EmptyState,
  PeriodSelector,
  ScreenHeader,
  SearchField,
  SegmentedControl,
  Text,
  TransactionGroupHeader,
  TransactionRow,
} from '@/components/ui';
import type { Transaction } from '@/db/schema';
import { computeMonthTotals } from '@/domain/budget';
import { formatMonthLabel, formatShortDate, formatWeekday, shiftISODate } from '@/domain/dates';
import { EMPTY_FILTERS, filterHistory, groupByDay, type HistoryFilters } from '@/domain/history';
import { formatMoney } from '@/domain/money';
import { useCategoryMap } from '@/features/categories/use-categories';
import { categoryLabel } from '@/features/categories/category-label';
import { useTransactionPresenter } from '@/features/transactions/use-presenter';
import { useMonthOperations } from '@/features/transactions/use-transactions';
import { useSelectedMonth } from '@/hooks/use-selected-month';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { space } from '@/theme/layout';

type TypeFilter = 'all' | 'expense' | 'income';

type ListRow =
  | { kind: 'header'; key: string; day: string; netCents: number; first: boolean }
  | { kind: 'item'; key: string; transaction: Transaction };

/**
 * Opérations (design/screens/04-transactions) : titre + période, résumé du mois, recherche, filtre Tout / Dépenses /
 * Revenus, puis les opérations regroupées par jour, sans séparateur (le regroupement se fait par l'espace).
 *
 * Écart avec l'étape 2a : les filtres par moyen de paiement et par catégorie ne sont plus proposés (le design n'en dessine
 * pas) ; la recherche texte porte toujours sur la note, la catégorie et le montant. Voir docs/design-deviations.md.
 */
export function HistoryScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const today = useToday();
  const { month } = useSelectedMonth();
  const present = useTransactionPresenter();
  const categoryById = useCategoryMap();
  const operations = useMonthOperations(month);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const totals = useMemo(() => computeMonthTotals(operations, month), [operations, month]);

  const rows = useMemo<ListRow[]>(() => {
    const items = operations.map((transaction) => {
      const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
      return { ...transaction, categoryName: category ? categoryLabel(category, t) : '' };
    });
    const filters: HistoryFilters = {
      ...EMPTY_FILTERS,
      query,
      type: typeFilter === 'all' ? null : typeFilter,
    };
    const result: ListRow[] = [];
    groupByDay(filterHistory(items, filters)).forEach((group, index) => {
      result.push({ kind: 'header', key: `h-${group.day}`, day: group.day, netCents: group.netCents, first: index === 0 });
      for (const item of group.items) result.push({ kind: 'item', key: item.id, transaction: item });
    });
    return result;
  }, [operations, categoryById, query, typeFilter, t]);

  const monthLabel = formatMonthLabel(month, locale);
  const yesterday = shiftISODate(today, -1);
  const dayLabel = (day: string) =>
    day === today ? t('common.today') : day === yesterday ? t('common.yesterday') : formatWeekday(day, locale);

  const hasCriteria = query.trim() !== '' || typeFilter !== 'all';

  return (
    <AppScreen>
      <ScreenHeader title={t('history.title')} trailing={<PeriodSelector />} />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingHorizontal: space.screen }, tabContentStyle]}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingTop: 2, paddingBottom: 4 }}>
            <Text variant="secondary" tone="muted" accessibilityLabel={`${t('history.summary', {
              expenses: formatMoney(-totals.expenseCents, locale),
              income: formatMoney(totals.incomeCents, locale, { signed: true }),
            })}`}>
              {t('home.expenses')}{' '}
              <Text variant="secondaryStrong">{formatMoney(-totals.expenseCents, locale)}</Text>
              {' · '}
              {t('home.income')}{' '}
              <Text variant="secondaryStrong">{formatMoney(totals.incomeCents, locale, { signed: true })}</Text>
            </Text>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('history.searchPlaceholder')}
              clearLabel={t('history.searchClear')}
            />
            <SegmentedControl<TypeFilter>
              accessibilityLabel={t('history.filterLabel')}
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all', label: t('history.filterAll') },
                { value: 'expense', label: t('history.filterExpenses') },
                { value: 'income', label: t('history.filterIncome') },
              ]}
            />
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return (
              <View style={{ marginTop: row.first ? 20 : space.dayGroup, marginBottom: space.dayGroupTitle }}>
                <TransactionGroupHeader
                  day={dayLabel(row.day)}
                  date={formatShortDate(row.day, locale)}
                  totalCents={row.netCents}
                />
              </View>
            );
          }
          const shown = present(row.transaction, 'list');
          return (
            <TransactionRow
              kind={shown.kind}
              categoryIcon={shown.categoryIcon}
              title={shown.title}
              subtitle={shown.subtitle}
              cents={shown.cents}
              accessibilityLabel={shown.accessibilityLabel}
              accessibilityHint={t('history.rowHint')}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: row.transaction.id } })}
            />
          );
        }}
        ListEmptyComponent={
          hasCriteria ? (
            <EmptyState icon="search" title={t('history.noResultTitle')} text={t('history.noResultText')} />
          ) : (
            <EmptyState icon="transactions" title={t('history.emptyTitle')} text={t('history.emptyText', { month: monthLabel })} />
          )
        }
      />
    </AppScreen>
  );
}
