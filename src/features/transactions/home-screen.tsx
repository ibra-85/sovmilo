import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Screen } from '@/components/screen';
import { computeMonthTotals } from '@/domain/budget';
import { formatMoney } from '@/domain/money';
import { useCategoryMap } from '@/features/categories/use-categories';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';

import { TransactionRow } from './transaction-row';
import { useMonthTransactions, useRecentTransactions } from './use-transactions';

const RECENT_COUNT = 5;

export function HomeScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();

  const month = useToday().slice(0, 7);
  const monthRows = useMonthTransactions(month);
  const recent = useRecentTransactions(RECENT_COUNT);
  const categoryById = useCategoryMap();

  const totals = useMemo(() => computeMonthTotals(monthRows, month), [monthRows, month]);
  const overspent = totals.remainingCents < 0;

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 px-4 pb-6 pt-4">
        {/* Reste à dépenser, en très gros : corail s'il est négatif, sauge sinon */}
        <View className="gap-1">
          <Text className="text-lg font-medium text-muted">{t('home.remainingTitle')}</Text>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            className={`text-6xl font-bold ${overspent ? 'text-coral' : 'text-sage'}`}>
            {formatMoney(totals.remainingCents, locale)}
          </Text>
          <Text className="text-base text-muted">{t('home.monthCount', { count: totals.operationCount })}</Text>
        </View>

        <View className="flex-row gap-3">
          <SummaryCard label={t('home.income')} value={formatMoney(totals.incomeCents, locale)} />
          <SummaryCard label={t('home.expenses')} value={formatMoney(totals.expenseCents, locale)} />
          {totals.savingsCents > 0 && (
            <SummaryCard label={t('home.savings')} value={formatMoney(totals.savingsCents, locale)} />
          )}
        </View>

        <BigButton
          label={t('home.addButton')}
          icon={<Text className="text-3xl font-bold text-on-accent">+</Text>}
          onPress={() => router.push('/add')}
        />

        <View className="gap-2">
          <Text accessibilityRole="header" className="text-xl font-bold text-ink">
            {t('home.recentTitle')}
          </Text>
          {recent.length === 0 ? (
            <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
              <Text className="text-xl font-semibold text-ink">{t('home.emptyTitle')}</Text>
              <Text className="text-center text-base text-muted">{t('home.emptyText')}</Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-3xl border border-line bg-surface">
              {recent.map((transaction, index) => (
                <View key={transaction.id} className={index > 0 ? 'border-t border-line' : undefined}>
                  <TransactionRow
                    transaction={transaction}
                    category={transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-1 rounded-2xl border border-line bg-surface p-3">
      <Text className="text-base text-muted" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-lg font-bold text-ink" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
