import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  AmountText,
  AppScreen,
  Button,
  CategoryIcon,
  ConfirmDialog,
  MorphingPopover,
  EmptyState,
  FieldGroup,
  Icon,
  IconButton,
  InfoRow,
  ProgressBar,
  ScreenHeader,
  Text,
  usePopoverTrigger,
  useToast,
} from '@/components/ui';
import { formatMonthName, formatMonthRange } from '@/domain/dates';
import { formatMoney, formatMoneyAuto } from '@/domain/money';
import { categoryLabel } from '@/features/categories/category-label';
import { useSelectedMonth } from '@/hooks/use-selected-month';
import { useLocale } from '@/i18n/use-locale';
import { radius, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { removeBudget } from './repository';
import { useBudgetOverview } from './use-budget-overview';

/**
 * Détail d'un budget (design/screens/08-budget-detail) : icône et nom de la catégorie, « Reste à dépenser » en 56 sp,
 * barre épaisse, pastille d'état (texte + icône : jamais la couleur seule), puis limite, utilisé et période.
 * Le menu « ⋯ » propose Modifier et Supprimer ; supprimer retire le budget à partir de ce mois, sans toucher aux opérations.
 */
export function BudgetDetailScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { colors, shadows } = useTheme();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { month } = useSelectedMonth();
  const { entries } = useBudgetOverview(month);
  const { bindTrigger, anchor: menuAnchor, open: openMenu, close: closeMenu, isOpen: menuOpen } = usePopoverTrigger();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const entry = entries.find((candidate) => candidate.category.id === categoryId);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/budget');
  }

  if (leaving) {
    return (
      <AppScreen>
        <ScreenHeader title={t('budget.detailTitle')} onBack={close} backLabel={t('budget.back')} />
      </AppScreen>
    );
  }

  if (!entry) {
    return (
      <AppScreen bottomInset>
        <ScreenHeader title={t('budget.detailTitle')} onBack={close} backLabel={t('budget.back')} />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.screen }}>
          <EmptyState icon="budgets" title={t('budget.notFound')} />
          <Button label={t('budget.back')} variant="secondary" onPress={close} />
        </View>
      </AppScreen>
    );
  }

  const { category, progress } = entry;
  const name = categoryLabel(category, t);
  const over = progress.status === 'over';
  const statusText =
    progress.status === 'over'
      ? t('budget.statusOver', { amount: formatMoneyAuto(-progress.remainingCents, locale), percent: progress.percent })
      : progress.status === 'reached'
        ? t('budget.statusReached')
        : progress.status === 'warning'
          ? t('budget.statusNear', { percent: progress.percent })
          : t('budget.statusOk', { percent: progress.percent });

  function confirmRemove() {
    removeBudget(category.id, month, progress.limitCents);
    setConfirming(false);
    setLeaving(true);
    close();
    toast.show({ message: t('budget.removed') });
  }

  return (
    <AppScreen bottomInset>
      <ScreenHeader
        title={t('budget.detailTitle')}
        onBack={close}
        backLabel={t('budget.back')}
        trailing={
          <View ref={bindTrigger} collapsable={false}>
            <IconButton icon="more" label={t('budget.moreActions')} expanded={menuOpen} onPress={openMenu} />
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 36, paddingBottom: 24 }}>
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 70,
              height: 70,
              borderRadius: radius.tileHero,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              boxShadow: shadows.tile,
            }}>
            <CategoryIcon value={category.icon} size={30} />
          </View>
          <Text variant="titleSection" numberOfLines={2} style={{ marginTop: 20, textAlign: 'center' }}>
            {name}
          </Text>
          <Text variant="secondary" tone="muted" style={{ marginTop: 4, textAlign: 'center' }}>
            {t('budget.monthly', { range: formatMonthRange(month, locale) })}
          </Text>

          <Text variant="secondary" tone="muted" style={{ marginTop: 32 }}>
            {over ? t('budget.overLabel') : t('budget.remainingLabel')}
          </Text>
          <View style={{ marginTop: 8 }}>
            <AmountText
              cents={over ? -progress.remainingCents : progress.remainingCents}
              size="hero"
              fraction="auto"
              tone={over ? 'danger' : 'default'}
            />
          </View>
        </View>

        <View style={{ marginTop: 28, gap: 10 }}>
          <ProgressBar percent={progress.percent} thickness="thick" over={over} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text variant="secondary" tone="muted" style={{ flexShrink: 1 }}>
              <Text variant="secondaryStrong">{formatMoneyAuto(progress.spentCents, locale)}</Text> {t('budget.used')}
            </Text>
            <Text variant="secondary" tone="muted">
              {t('budget.limit')} <Text variant="secondaryStrong">{formatMoneyAuto(progress.limitCents, locale)}</Text>
            </Text>
          </View>
        </View>

        <View
          accessible
          accessibilityLabel={statusText}
          style={{
            alignSelf: 'center',
            marginTop: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: radius.field,
            backgroundColor: over ? colors.dangerSoft : colors.surfaceMuted,
            borderWidth: over ? 1 : 0,
            borderColor: colors.dangerLine,
          }}>
          {progress.status !== 'ok' && (
            <Icon
              name={over ? 'overBudget' : 'nearLimit'}
              size={18}
              color={over ? colors.danger : undefined}
            />
          )}
          <Text variant="bodyStrong" tone={over ? 'danger' : 'default'} style={{ flexShrink: 1 }}>
            {statusText}
          </Text>
        </View>

        <View style={{ marginTop: 32 }}>
          <FieldGroup>
            <InfoRow label={t('budget.rowLimit')} value={formatMoney(progress.limitCents, locale)} />
            <InfoRow label={t('budget.rowUsed')} value={formatMoney(progress.spentCents, locale)} />
            <InfoRow
              label={t('budget.rowPeriod')}
              value={(() => {
                const label = formatMonthName(month, locale);
                return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1) + ' ' + month.slice(0, 4);
              })()}
            />
          </FieldGroup>
        </View>
      </ScrollView>

      <MorphingPopover
        anchor={menuAnchor}
        onClose={closeMenu}
        anchorRadius={radius.iconButton}
        accessibilityLabel={t('budget.menu')}
        items={[
          {
            key: 'edit',
            icon: 'note',
            label: t('budget.editAction'),
            onPress: () => {
              closeMenu();
              router.push({ pathname: '/budget-limit/[categoryId]', params: { categoryId: category.id } });
            },
          },
          {
            key: 'remove',
            icon: 'trash',
            label: t('budget.removeAction'),
            destructive: true,
            onPress: () => {
              closeMenu();
              setConfirming(true);
            },
          },
        ]}
      />

      <ConfirmDialog
        visible={confirming}
        title={t('budget.removeTitle')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('budget.removeConfirm')}
        onCancel={() => setConfirming(false)}
        onConfirm={confirmRemove}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: radius.group,
            backgroundColor: colors.surfaceMuted,
          }}>
          <CategoryIcon value={category.icon} size={24} />
          <View style={{ flex: 1 }}>
            <Text variant="body" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone="muted">
              {t('budget.removeText')}
            </Text>
          </View>
        </View>
      </ConfirmDialog>
    </AppScreen>
  );
}
