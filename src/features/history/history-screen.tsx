import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { OutlineButton } from '@/components/outline-button';
import { Screen } from '@/components/screen';
import { formatMonthLabel } from '@/domain/dates';
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterHistory,
  groupByMonth,
  type HistoryFilters,
} from '@/domain/history';
import { PAYMENT_METHODS, type PaymentMethod, type TransactionType } from '@/domain/types';
import { categoryLabel } from '@/features/categories/category-label';
import { useCategoryMap } from '@/features/categories/use-categories';
import { TransactionRow } from '@/features/transactions/transaction-row';
import { useAllTransactions } from '@/features/transactions/use-transactions';
import { useLocale } from '@/i18n/use-locale';
import { useThemeColors } from '@/theme/colors';

const TYPE_OPTIONS: TransactionType[] = ['expense', 'income', 'transfer'];

/** Onglet Historique : toutes les opérations par mois, avec recherche texte et filtres type / paiement / catégorie. */
export function HistoryScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();

  const transactions = useAllTransactions();
  const categoryById = useCategoryMap();

  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  const activeCount = countActiveFilters(filters);
  const hasCriteria = activeCount > 0 || filters.query.trim() !== '';

  // Le nom traduit de la catégorie est ajouté ici : la recherche porte sur ce que l'utilisatrice lit à l'écran.
  const items = useMemo(
    () =>
      transactions.map((transaction) => {
        const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
        return { ...transaction, categoryName: category ? categoryLabel(category, t) : '' };
      }),
    [transactions, categoryById, t], // `t` change avec la langue : les noms de catégories suivent
  );

  const sections = useMemo(
    () => groupByMonth(filterHistory(items, filters)).map((group) => ({ month: group.month, data: group.items })),
    [items, filters],
  );

  const categoryOptions = useMemo(
    // Dépenses d'abord (« expense » < « income »), puis l'ordre d'affichage habituel.
    () => [...categoryById.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder),
    [categoryById],
  );

  const typeLabel = (type: TransactionType) =>
    type === 'expense' ? t('add.typeExpense') : type === 'income' ? t('add.typeIncome') : t('add.typeSavings');

  const setFilter = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const panel = panelOpen ? (
    <View className="gap-4 pb-3">
      <FilterGroup title={t('history.filterType')}>
        <Chip label={t('common.all')} selected={filters.type === null} onPress={() => setFilter('type', null)} />
        {TYPE_OPTIONS.map((type) => (
          <Chip key={type} label={typeLabel(type)} selected={filters.type === type} onPress={() => setFilter('type', type)} />
        ))}
      </FilterGroup>

      <FilterGroup title={t('history.filterPayment')}>
        <Chip label={t('common.all')} selected={filters.paymentMethod === null} onPress={() => setFilter('paymentMethod', null)} />
        {PAYMENT_METHODS.map((method: PaymentMethod) => (
          <Chip
            key={method}
            label={t(`paymentMethods.${method}`)}
            selected={filters.paymentMethod === method}
            onPress={() => setFilter('paymentMethod', method)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title={t('history.filterCategory')}>
        <Chip label={t('common.all')} selected={filters.categoryId === null} onPress={() => setFilter('categoryId', null)} />
        {categoryOptions.map((category) => (
          <Chip
            key={category.id}
            label={`${category.icon} ${categoryLabel(category, t)}`}
            selected={filters.categoryId === category.id}
            onPress={() => setFilter('categoryId', category.id)}
          />
        ))}
      </FilterGroup>
    </View>
  ) : null;

  return (
    <Screen>
      <View className="gap-3 px-4 pb-2 pt-4">
        <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
          {t('history.title')}
        </Text>

        <View className="flex-row items-center gap-2">
          <View className="h-14 flex-1 flex-row items-center rounded-2xl border-2 border-line bg-surface pl-4">
            <TextInput
              value={filters.query}
              onChangeText={(query) => setFilter('query', query)}
              placeholder={t('history.searchPlaceholder')}
              placeholderTextColor={colors.muted}
              accessibilityLabel={t('history.searchPlaceholder')}
              returnKeyType="search"
              autoCorrect={false}
              className="h-full flex-1 text-lg text-ink"
            />
            {filters.query !== '' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('history.searchClear')}
                onPress={() => setFilter('query', '')}
                className="h-14 w-14 items-center justify-center active:opacity-60">
                <Text className="text-xl text-muted">✕</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: panelOpen }}
            onPress={() => setPanelOpen((open) => !open)}
            className={`h-14 items-center justify-center rounded-2xl border-2 px-4 active:opacity-70 ${
              activeCount > 0 ? 'border-sage bg-sage-soft' : 'border-line bg-surface'
            }`}>
            <Text className={`text-base font-semibold ${activeCount > 0 ? 'text-sage' : 'text-ink'}`}>
              {activeCount > 0 ? t('history.filtersActive', { count: activeCount }) : t('history.filters')}
            </Text>
          </Pressable>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-4 pb-6"
        ListHeaderComponent={
          <View className="gap-3">
            {panel}
            {hasCriteria && (
              <OutlineButton label={t('history.clearFilters')} onPress={() => setFilters(EMPTY_FILTERS)} />
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-baseline justify-between bg-bg pb-1 pt-4">
            <Text accessibilityRole="header" className="text-xl font-bold text-ink">
              {formatMonthLabel(section.month, locale)}
            </Text>
            <Text className="text-base text-muted">{t('history.monthCount', { count: section.data.length })}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            className={`overflow-hidden border-x border-line bg-surface ${
              index === 0 ? 'rounded-t-3xl border-t' : 'border-t'
            } ${index === section.data.length - 1 ? 'rounded-b-3xl border-b' : ''}`}>
            <TransactionRow
              transaction={item}
              category={item.categoryId ? categoryById.get(item.categoryId) : undefined}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
            />
          </View>
        )}
        ListEmptyComponent={
          <View className="mt-4 items-center gap-1 rounded-3xl border border-line bg-surface p-6">
            <Text className="text-center text-xl font-semibold text-ink">
              {transactions.length === 0 ? t('history.emptyTitle') : t('history.noResultTitle')}
            </Text>
            <Text className="text-center text-base text-muted">
              {transactions.length === 0 ? t('history.emptyText') : t('history.noResultText')}
            </Text>
          </View>
        }
      />
    </Screen>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-lg font-bold text-ink">
        {title}
      </Text>
      {/* Une seule ligne qui défile : le panneau reste court et les résultats restent visibles juste en dessous */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-4">
        {children}
      </ScrollView>
    </View>
  );
}
