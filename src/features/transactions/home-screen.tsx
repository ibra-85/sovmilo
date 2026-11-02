import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

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
import { useContentWidth } from '@/hooks/use-content-width';
import { layoutAmount } from '@/theme/amount-layout';
import { setOperationsTypeFilter } from '@/hooks/use-operations-filter';
import { useSelectedMonth } from '@/hooks/use-selected-month';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import { useTodayClock } from '@/hooks/use-today';
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
  const { today, refresh: refreshToday } = useTodayClock();
  // Tirer pour actualiser : relit la date du jour et toutes les requêtes (montants, budgets, dernières opérations). Rien n'est écrit.
  const { refreshControl } = useDataRefresh({ before: useCallback(() => void refreshToday(), [refreshToday]) });
  const { month } = useSelectedMonth();
  const present = useTransactionPresenter();
  const contentWidth = useContentWidth();

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
        refreshControl={refreshControl}
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
            maxWidth={contentWidth}
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
 *
 * Structure adaptative : la place à côté de l'icône est limitée (≈ 80 dp sur un écran de 360 dp). Si le montant n'y tient
 * pas à 14 sp au moins, la cellule passe en pile — icône et légende en haut, montant dessous sur toute la largeur — au lieu
 * de couper le montant ou d'envoyer le € à la ligne. La largeur de la cellule est mesurée (`onLayout`), pas supposée.
 */
function SummaryCell({ icon, label, cents, signed = false, hint, onPress }: SummaryCellProps) {
  const { colors } = useTheme();
  const locale = useLocale();
  const { fontScale, width: windowWidth } = useWindowDimensions();
  // Avant la première mesure : moitié de la fenêtre moins les marges de l'écran.
  const [cellWidth, setCellWidth] = useState((windowWidth - space.screen * 2) / 2);

  const inner = cellWidth - CELL_PADDING * 2;
  const beside = layoutAmount({ cents, locale, size: 'row', signed, maxWidth: inner - ICON - CELL_GAP, fontScale }).fit;
  const stacked = !beside.fits;
  const maxWidth = stacked ? inner : inner - ICON - CELL_GAP;

  const iconView = (
    <View
      style={{
        width: ICON,
        height: ICON,
        borderRadius: ICON / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceMuted,
      }}>
      <Icon name={icon} size={18} />
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formatMoney(cents, locale, { signed })}`}
      accessibilityHint={hint}
      pressTranslate={0}
      onPress={onPress}
      onLayout={(event: LayoutChangeEvent) => setCellWidth(event.nativeEvent.layout.width)}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'flex-start' : 'center',
        gap: stacked ? 8 : CELL_GAP,
        paddingVertical: 14,
        paddingHorizontal: CELL_PADDING,
        minHeight: sizes.minTouch,
        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
      })}>
      {stacked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: CELL_GAP, alignSelf: 'stretch' }}>
          {iconView}
          <Text variant="caption" tone="muted" numberOfLines={2} style={{ flex: 1 }}>
            {label}
          </Text>
        </View>
      ) : (
        iconView
      )}
      <View style={{ flexShrink: 1, alignSelf: stacked ? 'stretch' : undefined }}>
        {!stacked && (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {label}
          </Text>
        )}
        <AmountText cents={cents} size="row" signed={signed} maxWidth={maxWidth} />
      </View>
    </Pressable>
  );
}

const ICON = 40;
const CELL_GAP = 12;
const CELL_PADDING = 14;
