import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import {
  AmountText,
  AppScreen,
  Button,
  ConfirmDialog,
  EmptyState,
  FieldGroup,
  Icon,
  IconButton,
  InfoRow,
  MorphingPopover,
  Pressable,
  ScreenHeader,
  Surface,
  Text,
  usePopoverTrigger,
  useToast,
} from '@/components/ui';
import { billStatus, displayAmount } from '@/domain/bills';
import { formatDateWithYear, formatLongDate, formatMonthLabel } from '@/domain/dates';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { radius, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { amountText, recurrenceDetail, statusText } from './format';
import { PaymentSheet } from './payment-sheet';
import { deleteBill, markPaid, reopenOccurrence, stopRecurrence } from './repository';
import { useBillDetail, type BillRow } from './use-bills';

const UNDO_DURATION_MS = 6000;

/**
 * Détail d'une facture (une échéance) : statut écrit, montant, échéance, récurrence, note, et — pour une facture récurrente —
 * l'historique des paiements. L'action principale est toujours en bas : « Marquer comme payée », ou, pour une échéance payée,
 * « Modifier le paiement » et « Annuler le paiement » (la facture n'est jamais perdue : elle redevient « à payer »). Le menu « ⋯ »
 * (MorphingPopover) porte les actions moins fréquentes : modifier la facture, arrêter la récurrence, supprimer.
 */
export function BillDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const today = useToday();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, loaded } = useBillDetail(id ?? '');
  const { bindTrigger, coverStyle, anchor: menuAnchor, open: openMenu, close: closeMenu, reopen: reopenMenu, isOpen: menuOpen } = usePopoverTrigger();

  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState<'stop' | 'delete' | null>(null);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/bills');
  }, [router]);

  const back = (title: string) => <ScreenHeader title={title} onBack={close} backLabel={t('bills.backToBills')} />;

  if (leaving || !loaded) return <AppScreen bottomInset>{back(t('bills.title'))}</AppScreen>;

  if (!detail) {
    return (
      <AppScreen bottomInset>
        {back(t('bills.title'))}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.screen }}>
          <EmptyState icon="bills" title={t('bills.notFound')} />
          <Button label={t('bills.backToBills')} variant="secondary" onPress={close} />
        </View>
      </AppScreen>
    );
  }

  const { current, history, paidCount } = detail;
  const status = billStatus(current, today);
  const paid = status === 'paid';
  const overdue = status === 'overdue';
  const recurring = current.recurrence !== 'none';
  const stopped = current.stoppedOn !== null;
  const cents = displayAmount(current);
  const heroWidth = window.width - 2 * space.screen - 32;

  function reopen() {
    const previous = current;
    try {
      reopenOccurrence(previous.id);
    } catch {
      toast.show({ message: t('bills.errors.actionFailed') });
      return;
    }
    toast.show({
      message: t('bills.reopened'),
      actionLabel: t('edit.undo'),
      onAction: () => {
        try {
          if (previous.paidOn !== null) markPaid(previous.id, { paidOn: previous.paidOn, amountCents: previous.paidAmountCents }, today);
        } catch {
          toast.show({ message: t('bills.errors.actionFailed') });
        }
      },
      durationMs: UNDO_DURATION_MS,
    });
  }

  function paymentSaved(row: BillRow, edited: boolean) {
    setPaying(false);
    toast.show({
      message: t(edited ? 'bills.paymentSaved' : 'bills.paid', { name: row.name }),
      actionLabel: t('edit.undo'),
      onAction: () => {
        try {
          if (edited && row.paidOn !== null) markPaid(row.id, { paidOn: row.paidOn, amountCents: row.paidAmountCents }, today);
          else reopenOccurrence(row.id);
        } catch {
          toast.show({ message: t('bills.errors.actionFailed') });
        }
      },
      durationMs: UNDO_DURATION_MS,
    });
  }

  function confirmStop() {
    try {
      const result = stopRecurrence(current.billId, today);
      setConfirming(null);
      if (result === 'deleted') {
        setLeaving(true);
        close();
        toast.show({ message: t('bills.stoppedRemoved', { name: current.name }) });
      } else {
        toast.show({ message: t('bills.stopped', { name: current.name }) });
      }
    } catch {
      setFailed(true);
    }
  }

  function confirmDelete() {
    try {
      deleteBill(current.billId);
    } catch {
      setFailed(true);
      return;
    }
    const name = current.name;
    setConfirming(null);
    setLeaving(true);
    close();
    toast.show({ message: t('bills.deleted', { name }) });
  }

  const items = [
    {
      key: 'edit',
      icon: 'note' as const,
      label: t('bills.edit'),
      accessibilityLabel: t('bills.editA11y', { name: current.name }),
      onPress: () => {
        closeMenu();
        router.push({ pathname: '/bill-form', params: { id: current.id } });
      },
    },
    ...(recurring && !stopped
      ? [
          {
            key: 'stop',
            icon: 'close' as const,
            label: t('bills.stop'),
            accessibilityLabel: t('bills.stopA11y', { name: current.name }),
            onPress: () => {
              closeMenu();
              setFailed(false);
              setConfirming('stop');
            },
          },
        ]
      : []),
    {
      key: 'delete',
      icon: 'trash' as const,
      label: t('bills.delete'),
      accessibilityLabel: t('bills.deleteA11y', { name: current.name }),
      destructive: true,
      onPress: () => {
        closeMenu();
        setFailed(false);
        setConfirming('delete');
      },
    },
  ];

  return (
    <AppScreen bottomInset>
      <ScreenHeader
        title={current.name}
        onBack={close}
        backLabel={t('bills.backToBills')}
        trailing={
          <View ref={bindTrigger} collapsable={false} style={coverStyle}>
            <IconButton icon="more" label={t('bills.moreActions')} expanded={menuOpen} onPress={openMenu} />
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 24, gap: 20 }}>
        <Surface radiusToken="group" style={{ padding: 16, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon
              name={overdue ? 'overBudget' : paid ? 'check' : 'bills'}
              size={18}
              color={overdue ? colors.danger : paid ? colors.successIcon : colors.ink}
            />
            <Text variant="secondaryStrong" tone={overdue ? 'danger' : 'default'} style={{ flex: 1 }} accessibilityLiveRegion="polite">
              {statusText(current, today, locale, t)}
            </Text>
          </View>
          {cents !== null ? (
            <AmountText cents={cents} size="total" maxWidth={heroWidth} align="left" />
          ) : (
            <Text variant="titleSheet">{amountText(null, paid, locale, t)}</Text>
          )}
          {paid && current.amountCents !== null && current.amountCents !== current.paidAmountCents && (
            <Text variant="caption" tone="muted">
              {t('bills.expectedWas', { amount: amountText(current.amountCents, false, locale, t) })}
            </Text>
          )}
          {stopped && (
            <Text variant="captionMedium" tone="muted">
              {t('bills.stoppedBadge')}
            </Text>
          )}
        </Surface>

        <FieldGroup>
          <InfoRow label={t('bills.dueLabel')} value={formatLongDate(current.dueOn, locale)} />
          {paid && current.paidOn !== null && <InfoRow label={t('bills.paidOnLabel')} value={formatLongDate(current.paidOn, locale)} />}
          {paid && <InfoRow label={t('bills.paidAmountLabel')} value={amountText(current.paidAmountCents, true, locale, t)} />}
          <InfoRow label={t('bills.expectedLabel')} value={amountText(current.amountCents, false, locale, t)} />
          <InfoRow label={t('bills.recurrenceLabel')} value={recurrenceDetail(current, locale, t)} />
          {current.note !== null && <InfoRow label={t('bills.noteLabel')} value={current.note} />}
        </FieldGroup>

        {recurring && (
          <View style={{ gap: 10 }}>
            <Text variant="titleSection" accessibilityRole="header">
              {t('bills.historyTitle')}
            </Text>
            {history.length === 0 ? (
              <Text variant="secondary" tone="muted">
                {t('bills.historyEmpty')}
              </Text>
            ) : (
              <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
                {history.map((row, index) => (
                  <View key={row.id}>
                    {index > 0 && <View style={{ height: 1, marginLeft: space.gutter, backgroundColor: colors.hairline }} />}
                    <HistoryRow row={row} selected={row.id === current.id} onPress={() => router.replace({ pathname: '/bills/[id]', params: { id: row.id } })} />
                  </View>
                ))}
              </Surface>
            )}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
        {paid ? (
          <>
            <Button label={t('bills.editPayment')} icon="note" onPress={() => setPaying(true)} />
            <Button label={t('bills.reopen')} variant="secondary" onPress={reopen} />
          </>
        ) : (
          <Button label={t('bills.markPaid')} icon="check" onPress={() => setPaying(true)} />
        )}
      </View>

      <PaymentSheet visible={paying} row={current} today={today} onClose={() => setPaying(false)} onSaved={paymentSaved} />

      <MorphingPopover
        anchor={menuAnchor}
        onClose={closeMenu}
        onReopen={reopenMenu}
        anchorRadius={radius.iconButton}
        triggerContent={<Icon name="more" size={22} color={colors.ink} />}
        accessibilityLabel={t('bills.menu')}
        items={items}
      />

      <ConfirmDialog
        visible={confirming === 'stop'}
        title={t('bills.stopTitle')}
        icon="close"
        confirmIcon="close"
        cancelLabel={t('common.cancel')}
        confirmLabel={t('bills.stopConfirm')}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmStop}>
        <ConfirmNote name={current.name} text={failed ? t('bills.errors.actionFailed') : t('bills.stopText')} failed={failed} />
      </ConfirmDialog>

      <ConfirmDialog
        visible={confirming === 'delete'}
        title={t('bills.deleteTitle')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('bills.deleteConfirm')}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmDelete}>
        <ConfirmNote
          name={current.name}
          text={failed ? t('bills.errors.deleteFailed') : paidCount > 0 ? t('bills.deleteTextHistory', { count: paidCount }) : t('bills.deleteText')}
          failed={failed}
        />
      </ConfirmDialog>
    </AppScreen>
  );
}

/** Rappel de la facture concernée dans une confirmation, avec la conséquence de l'action. */
function ConfirmNote({ name, text, failed }: { name: string; text: string; failed: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 12, borderRadius: radius.group, backgroundColor: colors.surfaceMuted, gap: 2 }}>
      <Text variant="body" numberOfLines={3}>
        {name}
      </Text>
      <Text variant="caption" tone={failed ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
        {text}
      </Text>
    </View>
  );
}

/** Ligne de l'historique : mois de l'échéance, date de paiement, montant payé. */
function HistoryRow({ row, selected, onPress }: { row: BillRow; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();
  const month = formatMonthLabel(row.dueOn.slice(0, 7), locale);
  const date = formatDateWithYear(row.paidOn ?? row.dueOn, locale);
  const amount = amountText(row.paidAmountCents, true, locale, t);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('bills.historyRowA11y', { month, date, amount })}
      accessibilityState={{ selected }}
      pressTranslate={0}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: space.gutter,
        paddingVertical: 10,
        backgroundColor: pressed || selected ? colors.surfaceMuted : 'transparent',
      })}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {month}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {t('bills.statusPaid', { date })}
        </Text>
      </View>
      {row.paidAmountCents !== null ? (
        <View style={{ maxWidth: '45%' }}>
          <AmountText cents={row.paidAmountCents} size="row" tone="muted" align="right" />
        </View>
      ) : (
        <Text variant="captionMedium" tone="muted" numberOfLines={2} style={{ maxWidth: '45%', textAlign: 'right' }}>
          {amount}
        </Text>
      )}
    </Pressable>
  );
}
