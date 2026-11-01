import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { AmountText, AppScreen, Button, Divider, EmptyState, Icon, Pressable, ProgressBar, ScreenHeader, Surface, Text, useToast } from '@/components/ui';
import { formatMoney } from '@/domain/money';
import { overallPercent } from '@/domain/savings';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { GoalRowView } from './goal-row';
import { GoalSheet } from './goal-sheet';
import { MovementSheet, type MovementSaved } from './movement-sheet';
import { cancelMovement } from './repository';
import { useActiveGoals, useArchivedGoals, type GoalRow } from './use-savings';

/** Une notification qui propose « Annuler » doit rester assez longtemps pour qu'on ait le temps de la lire et de la toucher. */
const UNDO_DURATION_MS = 6000;

/**
 * Services → Épargne : ce que l'utilisatrice déclare avoir mis de côté pour ses objectifs. L'épargne est DÉCLARATIVE : aucun
 * virement, aucune opération, aucun solde, aucun budget n'est touché. Le total n'est jamais présenté comme un solde bancaire.
 * L'ordre des objectifs est celui qu'elle a choisi ; un versement ne les réorganise jamais.
 */
export function SavingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const today = useToday();
  const { goals, summary, loaded } = useActiveGoals();
  const archived = useArchivedGoals();

  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<GoalRow | null>(null);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }, [router]);

  const open = useCallback((goal: GoalRow) => router.push({ pathname: '/savings/[id]', params: { id: goal.id } }), [router]);
  const quickAdd = useMemo(() => ({ kind: 'add' as const, onPress: (goal: GoalRow) => setAdding(goal) }), []);

  function movementSaved(result: MovementSaved) {
    const goal = adding;
    setAdding(null);
    toast.show({
      message: t('savings.movement.deposited', { amount: formatMoney(result.amountCents, locale), name: goal?.name ?? '' }),
      actionLabel: t('edit.undo'),
      onAction: () => {
        try {
          cancelMovement(result.id);
        } catch {
          toast.show({ message: t('savings.detail.actionFailed') });
        }
      },
      durationMs: UNDO_DURATION_MS,
    });
  }

  const percent = useMemo(() => overallPercent(goals), [goals]);
  const hasGoals = goals.length > 0;
  const contentWidth = window.width - 2 * space.screen;

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={t('savings.title')} onBack={close} backLabel={t('common.back')} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 24, gap: 20, flexGrow: 1 }}>
        {loaded && !hasGoals ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="savings" title={t('savings.emptyTitle')} text={t('savings.emptyText')} />
          </View>
        ) : null}

        {hasGoals ? (
          <>
            <Surface radiusToken="group" style={{ padding: 16, gap: 6 }}>
              <Text variant="caption" tone="muted">
                {t('savings.summaryLabel')}
              </Text>
              <AmountText cents={summary.totalSavedCents} size="total" maxWidth={contentWidth - 32} align="left" />
              <Text variant="caption" tone="muted">
                {t('savings.summaryNote')}
              </Text>
              <Text variant="secondaryStrong" tone="muted" style={{ marginTop: 2 }}>
                {[
                  t('savings.goalCount', { count: summary.goalCount }),
                  summary.reachedCount > 0 ? t('savings.reachedCount', { count: summary.reachedCount }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {percent !== null ? (
                <View style={{ gap: 6, marginTop: 4 }} accessible accessibilityLabel={t('savings.globalProgress', { percent })}>
                  <ProgressBar percent={percent} />
                  <Text variant="caption" tone="muted">
                    {t('savings.globalProgress', { percent })}
                  </Text>
                </View>
              ) : null}
            </Surface>

            <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
              {goals.map((goal, index) => (
                <View key={goal.id}>
                  {index > 0 && <Divider inset={space.fieldDividerInset} />}
                  <GoalRowView goal={goal} onOpen={open} action={quickAdd} />
                </View>
              ))}
            </Surface>
          </>
        ) : null}

        {archived.goals.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('savings.archivesLink', { count: archived.goals.length })}
            pressTranslate={0}
            onPress={() => router.push('/savings/archive')}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="bodyStrong" tone="muted" style={{ flex: 1 }}>
              {t('savings.archivesLink', { count: archived.goals.length })}
            </Text>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        <View style={{ gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('savings.transferLink')}
            accessibilityHint={t('savings.transferHelp')}
            pressTranslate={0}
            onPress={() => router.push({ pathname: '/add', params: { type: 'transfer' } })}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="bodyStrong" tone="muted" style={{ flex: 1 }}>
              {t('savings.transferLink')}
            </Text>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </Pressable>
          <Text variant="caption" tone="muted">
            {t('savings.transferHelp')}
          </Text>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 12 }}>
        <Button label={t('savings.create')} icon="createPlus" onPress={() => setCreating(true)} />
      </View>

      <GoalSheet
        visible={creating}
        goal={null}
        today={today}
        onClose={() => setCreating(false)}
        onSaved={(result) => {
          setCreating(false);
          toast.show({ message: t('savings.goal.created', { name: result.name }) });
        }}
      />
      <MovementSheet
        visible={adding !== null}
        goal={adding}
        kind="deposit"
        today={today}
        onClose={() => setAdding(null)}
        onSaved={movementSaved}
        onCancelled={() => setAdding(null)}
      />
    </AppScreen>
  );
}
