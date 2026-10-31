import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useTabContentStyle } from '@/components/navigation';
import {
  AmountText,
  AppScreen,
  EmptyState,
  Icon,
  PeriodSelector,
  Pressable,
  ScreenHeader,
  SectionHeader,
  Surface,
  Text,
  TransactionRow,
  WeeklyChart,
} from '@/components/ui';
import { computeMonthTotals } from '@/domain/budget';
import { formatMonthLabel, formatMonthName, formatMonthShort } from '@/domain/dates';
import { computeWeeklyExpenses, currentWeekIndex, weekRangeLabel } from '@/domain/weekly';
import { BudgetCard } from '@/features/budgets/budget-card';
import { useBudgetOverview } from '@/features/budgets/use-budget-overview';
import { setOperationsTypeFilter } from '@/hooks/use-operations-filter';
import { useSelectedMonth } from '@/hooks/use-selected-month';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { formatMoney } from '@/domain/money';
import { sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { useTransactionPresenter } from './use-presenter';
import { useMonthOperations, useMonthTransactions } from './use-transactions';

const RECENT_COUNT = 3;
const WATCHED_COUNT = 3;

/**
 * Accueil V6.1 (design/screens/02-home) : le résultat du mois en grand, posé directement sur le fond, puis la bande
 * Revenus / Dépenses, les budgets à surveiller, les opérations récentes et le graphique par semaine. Seules les zones
 * qui regroupent une information sont des cartes ; les opérations récentes restent sur le fond.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const tabContentStyle = useTabContentStyle();
  const router = useRouter();
  const { colors } = useTheme();
  const today = useToday();
  const { month } = useSelectedMonth();
  const present = useTransactionPresenter();

  const monthRows = useMonthTransactions(month);
  const operations = useMonthOperations(month);
  const overview = useBudgetOverview(month);

  const totals = useMemo(() => computeMonthTotals(monthRows, month), [monthRows, month]);
  const weeks = useMemo(() => computeWeeklyExpenses(monthRows, month), [monthRows, month]);
  const monthName = formatMonthName(month, locale);
  const watched = useMemo(() => [...overview.watched, ...overview.withinLimits].slice(0, WATCHED_COUNT), [overview]);
  const recent = operations.slice(0, RECENT_COUNT);

  // Ouvre l'onglet Opérations déjà filtré. Le mois consulté est partagé (use-selected-month) : il est conservé tel quel.
  function openOperations(filter: 'income' | 'expense') {
    setOperationsTypeFilter(filter);
    router.navigate('/history');
  }

  const monthShort = formatMonthShort(month, locale);
  const bars = weeks.map((week) => ({
    label: weekRangeLabel(week),
    a11yLabel: `${weekRangeLabel(week)} ${monthShort}`,
    cents: week.expenseCents,
  }));

  return (
    <AppScreen>
      <ScreenHeader title="Sovmilo" logotype trailing={<PeriodSelector />} />

      <ScrollView
        contentContainerStyle={[{ paddingHorizontal: space.screen, paddingTop: 18 }, tabContentStyle]}
        showsVerticalScrollIndicator={false}>
        {/* Résultat du mois : posé sur le fond, sans carte */}
        <View style={{ gap: 2 }}>
          <Text variant="titleSection" accessibilityRole="header">
            {t('home.resultTitle')}
          </Text>
          <Text variant="secondary" tone="muted">
            {t(totals.savingsCents > 0 ? 'home.resultSubtitleSavings' : 'home.resultSubtitle', { month: monthName })}
          </Text>
        </View>
        <View style={{ marginTop: 16 }}>
          <AmountText
            cents={totals.remainingCents}
            size="home"
            signed
            tone={totals.remainingCents < 0 ? 'danger' : 'default'}
          />
        </View>

        {/* Bande Revenus / Dépenses : deux actions indépendantes (filtre d'Opérations) sur une même surface */}
        <Surface style={{ marginTop: 22, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' }}>
          <SummaryCell
            icon="arrowIncome"
            label={t('home.income')}
            cents={totals.incomeCents}
            signed
            hint={t('home.openIncome')}
            onPress={() => openOperations('income')}
          />
          <View style={{ width: 1, marginVertical: 14, backgroundColor: colors.hairline }} />
          <SummaryCell
            icon="arrowExpense"
            label={t('home.expenses')}
            cents={-totals.expenseCents}
            hint={t('home.openExpenses')}
            onPress={() => openOperations('expense')}
          />
        </Surface>

        {/* Budgets à surveiller */}
        <View style={{ marginTop: space.section, gap: space.sectionTitle }}>
          <SectionHeader
            title={t('home.budgetsTitle')}
            actionLabel={t('home.seeAll')}
            actionAccessibilityLabel={t('home.seeAllBudgets')}
            onAction={() => router.navigate('/budget')}
          />
          {watched.length > 0 ? (
            <BudgetCard entries={watched} />
          ) : (
            <Surface>
              <EmptyState
                icon="budgets"
                title={t('home.noBudgetTitle')}
                text={t('home.noBudgetText')}
                actionLabel={t('budget.create')}
                onAction={() => router.push('/budget-new')}
              />
            </Surface>
          )}
        </View>

        {/* Opérations récentes : posées sur le fond */}
        <View style={{ marginTop: space.section, gap: space.sectionTitle }}>
          <SectionHeader
            title={t('home.recentTitle')}
            actionLabel={t('home.seeAll')}
            actionAccessibilityLabel={t('home.seeAllOperations')}
            onAction={() => router.navigate('/history')}
          />
          {recent.length > 0 ? (
            <View>
              {recent.map((transaction) => {
                const shown = present(transaction, 'home');
                return (
                  <TransactionRow
                    key={transaction.id}
                    kind={shown.kind}
                    categoryIcon={shown.categoryIcon}
                    title={shown.title}
                    subtitle={shown.subtitle}
                    cents={shown.cents}
                    accessibilityLabel={shown.accessibilityLabel}
                    accessibilityHint={t('history.rowHint')}
                    onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })}
                  />
                );
              })}
            </View>
          ) : (
            <EmptyState icon="transactions" title={t('home.emptyTitle')} text={t('home.emptyText')} />
          )}
        </View>

        {/* Dépenses par semaine */}
        <View style={{ marginTop: space.section, gap: space.sectionTitle }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <Text variant="titleSection" accessibilityRole="header" style={{ flexShrink: 1 }}>
              {t('home.weeklyTitle')}
            </Text>
            <Text variant="secondary" tone="muted" numberOfLines={1}>
              {formatMonthLabel(month, locale)}
            </Text>
          </View>
          <WeeklyChart bars={bars} currentIndex={currentWeekIndex(today, month)} totalCents={totals.expenseCents} />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

interface SummaryCellProps {
  icon: 'arrowIncome' | 'arrowExpense';
  label: string;
  cents: number;
  signed?: boolean;
  /** Ce que fait le toucher, pour TalkBack (« Voir les revenus du mois »). */
  hint: string;
  onPress: () => void;
}

/**
 * Une moitié de la bande Revenus / Dépenses : pastille d'icône de 40 dp, légende, montant. Zone tactile pleine hauteur
 * de la carte (plus de 48 dp), retour visuel discret au toucher (fond « surfaceMuted »).
 */
function SummaryCell({ icon, label, cents, signed = false, hint, onPress }: SummaryCellProps) {
  const { colors } = useTheme();
  const locale = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formatMoney(cents, locale, { signed })}`}
      accessibilityHint={hint}
      pressTranslate={0}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 14,
        minHeight: sizes.minTouch,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
      })}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceMuted,
        }}>
        <Icon name={icon} size={18} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {label}
        </Text>
        <AmountText cents={cents} size="row" signed={signed} />
      </View>
    </Pressable>
  );
}
