import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useTabContentStyle } from '@/components/navigation';
import {
  AmountText,
  AppScreen,
  Button,
  EmptyState,
  PeriodSelector,
  ProgressBar,
  ScreenHeader,
  Surface,
  Text,
} from '@/components/ui';
import { formatMonthRange } from '@/domain/dates';
import { formatMoneyAuto } from '@/domain/money';
import { useContentWidth } from '@/hooks/use-content-width';
import { useDataRefresh } from '@/hooks/use-data-refresh';
import { useSelectedMonth } from '@/hooks/use-selected-month';
import { useLocale } from '@/i18n/use-locale';
import { space } from '@/theme/layout';

import { BudgetCard } from './budget-card';
import { useBudgetOverview } from './use-budget-overview';

/**
 * Budgets (design/screens/07-budgets) : titre + période, « Reste sur vos budgets » avec le bouton « Créer un budget »,
 * le résumé du mois, puis les budgets « À surveiller » (dépassés ou presque atteints) et « Dans les limites ».
 * Une ligne ouvre le détail du budget. Les catégories sans plafond n'apparaissent pas : on leur donne un budget avec « Créer ».
 */
export function BudgetScreen() {
  // Tirer pour actualiser : relit budgets et opérations du mois ; les montants consommés sont recalculés, aucun budget n'est touché.
  const { refreshControl } = useDataRefresh();
  const { t } = useTranslation();
  const contentWidth = useContentWidth();
  const locale = useLocale();
  const tabContentStyle = useTabContentStyle();
  const router = useRouter();
  const { month } = useSelectedMonth();
  const { entries, watched, withinLimits, summary } = useBudgetOverview(month);

  const createButton = (
    <Button label={t('budget.create')} icon="createPlus" variant="secondary" size="compact" onPress={() => router.push('/budget-new')} />
  );

  return (
    <AppScreen>
      <ScreenHeader title={t('budget.title')} trailing={<PeriodSelector />} />

      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={[{ paddingHorizontal: space.screen, paddingTop: 14 }, tabContentStyle]}
        showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <Surface>
            <EmptyState
              icon="budgets"
              title={t('budget.emptyTitle')}
              text={t('budget.emptyText')}
              actionLabel={t('budget.create')}
              onAction={() => router.push('/budget-new')}
            />
          </Surface>
        ) : (
          <>
            {/* Résumé : posé sur le fond */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flexShrink: 1, gap: 2 }}>
                <Text variant="titleSection" accessibilityRole="header">
                  {t('budget.summaryTitle')}
                </Text>
                <Text variant="secondary" tone="muted">
                  {t('budget.summarySubtitle', { count: summary.count, range: formatMonthRange(month, locale) })}
                </Text>
              </View>
              {createButton}
            </View>

            <View style={{ marginTop: 14 }}>
              <AmountText
                cents={summary.remainingCents}
                size="summary"
                fraction="auto"
                maxWidth={contentWidth}
                tone={summary.remainingCents < 0 ? 'danger' : 'default'}
              />
            </View>

            <View style={{ marginTop: 16, gap: 10 }}>
              <ProgressBar percent={summary.percent} over={summary.remainingCents < 0} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text variant="caption" tone="muted" style={{ flexShrink: 1 }}>
                  <Text variant="captionMedium">{formatMoneyAuto(summary.spentCents, locale)}</Text>{' '}
                  {t('budget.spentOn', { limit: formatMoneyAuto(summary.limitCents, locale) })}
                </Text>
                <Text variant="caption" tone="muted" style={{ flexShrink: 0 }}>
                  {`${summary.percent} %`}
                </Text>
              </View>
            </View>

            {watched.length > 0 && (
              <BudgetSection title={t('budget.watchTitle')} count={watched.length}>
                <BudgetCard entries={watched} />
              </BudgetSection>
            )}
            {withinLimits.length > 0 && (
              <BudgetSection title={t('budget.okTitle')} count={withinLimits.length}>
                <BudgetCard entries={withinLimits} />
              </BudgetSection>
            )}
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function BudgetSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={{ marginTop: space.section, gap: space.sectionTitle }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Text variant="titleSection" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Text>
        <Text variant="secondary" tone="muted">
          {t('budget.count', { count })}
        </Text>
      </View>
      {children}
    </View>
  );
}
