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
  ScreenHeader,
  Text,
  usePopoverTrigger,
  useToast,
} from '@/components/ui';
import { formatLongDate, formatShortDate } from '@/domain/dates';
import { categoryLabel } from '@/features/categories/category-label';
import { useCategoryMap } from '@/features/categories/use-categories';
import { useContentWidth } from '@/hooks/use-content-width';
import { useLocale } from '@/i18n/use-locale';
import { radius, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { restoreTransaction, softDeleteTransaction } from './repository';
import { useTransactionPresenter } from './use-presenter';
import { useTransaction } from './use-transactions';

/** Durée de la notification « Opération supprimée » : plus longue que d'habitude, elle porte le bouton « Annuler ». */
const UNDO_DURATION_MS = 6000;

/**
 * Détail d'une opération (design/screens/05-transaction-detail) : icône de la catégorie, libellé, montant en 52 sp et
 * type, puis catégorie et date. Le bouton « ⋯ » ouvre le menu Modifier / Supprimer ; la suppression demande une
 * confirmation, puis la notification propose « Annuler » (suppression logique : la ligne reste en base).
 */
export function TransactionDetailScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const contentWidth = useContentWidth();
  const { colors, shadows } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transaction, loaded } = useTransaction(id);
  const present = useTransactionPresenter();
  const categoryById = useCategoryMap();
  const { bindTrigger, anchor: menuAnchor, open: openMenu, close: closeMenu, isOpen: menuOpen } = usePopoverTrigger();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const back = <ScreenHeader title={t('detail.title')} onBack={close} backLabel={t('detail.back')} />;

  if (leaving || !loaded) return <AppScreen>{back}</AppScreen>;

  if (!transaction) {
    return (
      <AppScreen bottomInset>
        {back}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.screen }}>
          <EmptyState icon="transactions" title={t('detail.notFound')} />
          <Button label={t('detail.back')} variant="secondary" onPress={close} />
        </View>
      </AppScreen>
    );
  }

  const shown = present(transaction, 'list');
  const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
  const typeName =
    transaction.type === 'income' ? t('add.typeIncome') : transaction.type === 'transfer' ? t('add.typeSavings') : t('add.typeExpense');
  const longDate = formatLongDate(transaction.occurredOn, locale);
  const dateLabel = longDate.charAt(0).toLocaleUpperCase(locale) + longDate.slice(1);

  function confirmDelete() {
    softDeleteTransaction(transaction!.id);
    const deletedId = transaction!.id;
    setConfirming(false);
    setLeaving(true);
    close();
    toast.show({
      message: t('edit.deleted'),
      actionLabel: t('edit.undo'),
      onAction: () => restoreTransaction(deletedId),
      durationMs: UNDO_DURATION_MS,
    });
  }

  return (
    <AppScreen bottomInset>
      <ScreenHeader
        title={t('detail.title')}
        onBack={close}
        backLabel={t('detail.back')}
        trailing={
          <View ref={bindTrigger} collapsable={false}>
            <IconButton icon="more" label={t('detail.moreActions')} expanded={menuOpen} onPress={openMenu} />
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 44, paddingBottom: 24 }}>
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
            {transaction.type === 'transfer' ? (
              <Icon name="savings" size={30} />
            ) : transaction.type === 'income' ? (
              <Icon name="arrowIncome" size={30} color={colors.incomeIcon} />
            ) : (
              <CategoryIcon value={category?.icon} size={30} />
            )}
          </View>

          <Text variant="titleSection" numberOfLines={2} style={{ marginTop: 20, textAlign: 'center' }}>
            {shown.title}
          </Text>
          <View style={{ marginTop: 12 }}>
            <AmountText cents={shown.cents} size="detail" signed maxWidth={contentWidth} />
          </View>
          <Text variant="secondary" tone="muted" style={{ marginTop: 8 }}>
            {typeName}
          </Text>
        </View>

        <View style={{ marginTop: 40 }}>
          <FieldGroup>
            {category && (
              <InfoRow
                label={t('detail.category')}
                value={categoryLabel(category, t)}
                leading={
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radius.iconPad,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surfaceMuted,
                    }}>
                    <CategoryIcon value={category.icon} size={18} />
                  </View>
                }
              />
            )}
            <InfoRow label={t('detail.date')} value={dateLabel} />
          </FieldGroup>
        </View>
      </ScrollView>

      <MorphingPopover
        anchor={menuAnchor}
        onClose={closeMenu}
        anchorRadius={radius.iconButton}
        accessibilityLabel={t('detail.menu')}
        items={[
          {
            key: 'edit',
            icon: 'note',
            label: t('detail.edit'),
            onPress: () => {
              closeMenu();
              router.push({ pathname: '/transaction/edit/[id]', params: { id: transaction.id } });
            },
          },
          {
            key: 'delete',
            icon: 'trash',
            label: t('detail.delete'),
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
        title={t('edit.deleteTitle')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('edit.deleteConfirm')}
        onCancel={() => setConfirming(false)}
        onConfirm={confirmDelete}>
        {/* Rappel de l'opération : le montant garde sa place (il ne rétrécit jamais), le nom et la date passent sur deux lignes. */}
        <View
          accessible
          accessibilityLabel={shown.accessibilityLabel}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: radius.group,
            backgroundColor: colors.surfaceMuted,
          }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
            }}>
            {transaction.type === 'transfer' ? (
              <Icon name="savings" size={20} />
            ) : transaction.type === 'income' ? (
              <Icon name="arrowIncome" size={20} color={colors.incomeIcon} />
            ) : (
              <CategoryIcon value={shown.categoryIcon} size={20} />
            )}
          </View>
          <View style={{ flex: 1, flexShrink: 1 }}>
            <Text variant="body" numberOfLines={2}>
              {shown.title}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {`${shown.categoryName || typeName} · ${formatShortDate(transaction.occurredOn, locale)} ${transaction.occurredOn.slice(0, 4)}`}
            </Text>
          </View>
          <View style={{ flexShrink: 0 }}>
            <AmountText cents={shown.cents} size="row" signed maxWidth={contentWidth * 0.5} />
          </View>
        </View>
      </ConfirmDialog>
    </AppScreen>
  );
}
