import type { TFunction } from 'i18next';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import {
  AmountText,
  AppScreen,
  Button,
  Divider,
  EmptyState,
  Icon,
  PeriodSelector,
  Pressable,
  ScreenHeader,
  Surface,
  Text,
  useToast,
} from '@/components/ui';
import { CONSULTABLE_MONTHS_AHEAD, partitionBills, summarizePeriod, type AmountTotal } from '@/domain/bills';
import { formatMoney } from '@/domain/money';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { BillRowView } from './bill-row';
import { PaymentSheet } from './payment-sheet';
import { ensureOccurrences, markPaid, reopenOccurrence } from './repository';
import { useBillRows, type BillRow } from './use-bills';

/** Une notification qui propose « Annuler » doit rester assez longtemps pour qu'on ait le temps de la lire et de la toucher. */
const UNDO_DURATION_MS = 6000;

/**
 * Services → Factures : ce qu'il reste à payer ce mois-ci, ce qui est en retard (TOUJOURS visible, quel que soit le mois
 * consulté), ce qui arrive, et ce qui est déjà payé (repliable). Le total « Reste à payer » ne compte que les échéances non payées
 * du mois affiché ; les retards des mois précédents sont signalés à part, et un total qui contient des montants inconnus est
 * présenté comme partiel. Aucune opération n'est créée et le solde comme les budgets ne sont jamais touchés.
 */
export function BillsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const today = useToday();
  const currentMonth = today.slice(0, 7);
  const { rows, loaded } = useBillRows();

  // Mois propre à cet écran (le mois partagé d'Accueil / Opérations / Budgets ne regarde pas l'avenir). `null` = le mois en cours.
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const month = pickedMonth ?? currentMonth;
  const [paying, setPaying] = useState<BillRow | null>(null);
  const [paidOpen, setPaidOpen] = useState<boolean | null>(null);

  // Complète les échéances manquantes à l'ouverture, quand le jour change et quand on change de mois : elles existent toujours
  // au moins jusqu'au mois affiché (idempotent : aucun doublon). L'horizon de génération couvre déjà tout le sélecteur.
  useEffect(() => {
    try {
      ensureOccurrences(today, month);
    } catch {
      // L'écran reste utilisable avec ce qui existe déjà.
    }
  }, [today, month]);

  const partition = useMemo(() => partitionBills(rows, month, today), [rows, month, today]);
  const summary = useMemo(() => summarizePeriod(rows, month, today), [rows, month, today]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }, [router]);

  const open = useCallback(
    (row: BillRow) => router.push({ pathname: '/bills/[id]', params: { id: row.id } }),
    [router],
  );
  const pay = useCallback((row: BillRow) => setPaying(row), []);

  function paymentSaved(row: BillRow, edited: boolean) {
    setPaying(null);
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

  const hasBills = rows.length > 0;
  const nothingToDo = partition.overdue.length === 0 && partition.upcoming.length === 0;
  const showPaid = paidOpen ?? nothingToDo;
  const contentWidth = window.width - 2 * space.screen;

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={t('bills.title')} onBack={close} backLabel={t('bills.back')} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 24, gap: 20, flexGrow: 1 }}>
        {loaded && !hasBills ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="bills" title={t('bills.emptyTitle')} text={t('bills.emptyText')} />
          </View>
        ) : null}

        {hasBills && (
          <>
            <View style={{ alignItems: 'flex-start' }}>
              <PeriodSelector futureMonths={CONSULTABLE_MONTHS_AHEAD} value={{ month, onChange: (next) => setPickedMonth(next === currentMonth ? null : next) }} />
            </View>

            <Surface radiusToken="group" style={{ padding: 16, gap: 6 }}>
              <Text variant="caption" tone="muted">
                {t('bills.summaryRemaining')}
              </Text>
              {summary.remaining.count === 0 ? (
                <Text variant="titleSheet">{t('bills.summaryNothing')}</Text>
              ) : summary.remaining.knownCents === 0 ? (
                <Text variant="titleSheet">{t('bills.summaryUnknown')}</Text>
              ) : (
                <AmountText cents={summary.remaining.knownCents} size="total" maxWidth={contentWidth - 32} align="left" />
              )}
              {summary.remaining.partial && summary.remaining.knownCents > 0 && (
                <Text variant="caption" tone="muted" accessibilityLabel={t('bills.summaryPartialA11y', { count: summary.remaining.unknownCount })}>
                  {t('bills.summaryPartial', { count: summary.remaining.unknownCount })}
                </Text>
              )}
              {(summary.upcomingCount > 0 || summary.overdueCount > 0) && (
                <Text variant="secondaryStrong" tone={summary.overdueCount > 0 ? 'danger' : 'muted'} style={{ marginTop: 2 }}>
                  {[
                    summary.upcomingCount > 0 ? t('bills.upcomingCount', { count: summary.upcomingCount }) : null,
                    summary.overdueCount > 0 ? t('bills.overdueCount', { count: summary.overdueCount }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
              {summary.carriedOver.count > 0 && (
                <Text variant="caption" tone="muted">
                  {carriedText(summary.carriedOver, (cents) => formatMoney(cents, locale), t)}
                </Text>
              )}
            </Surface>

            {partition.overdue.length > 0 && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="overBudget" size={18} color={colors.danger} />
                  <Text variant="titleSection" tone="danger" accessibilityRole="header" style={{ flex: 1 }}>
                    {t('bills.overdueTitle', { count: partition.overdue.length })}
                  </Text>
                </View>
                <BillGroup rows={partition.overdue} today={today} onOpen={open} onPay={pay} />
              </View>
            )}

            {partition.upcoming.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text variant="titleSection" accessibilityRole="header">
                  {t('bills.toPayTitle')}
                </Text>
                <BillGroup rows={partition.upcoming} today={today} onOpen={open} onPay={pay} />
              </View>
            )}

            {nothingToDo &&
              (partition.paid.length === 0 ? (
                <Text variant="secondary" tone="muted" accessibilityLiveRegion="polite">
                  {t('bills.monthEmpty')}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }} accessible accessibilityLiveRegion="polite">
                  <View
                    style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successBg }}>
                    <Icon name="check" size={16} color={colors.successIcon} weight="strong" />
                  </View>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {t('bills.monthAllPaid')}
                  </Text>
                </View>
              ))}

            {partition.paid.length > 0 && (
              <View style={{ gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(showPaid ? 'bills.paidHide' : 'bills.paidShow')}
                  accessibilityState={{ expanded: showPaid }}
                  pressTranslate={0}
                  onPress={() => setPaidOpen(!showPaid)}
                  style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text variant="titleSection" tone="muted" style={{ flex: 1 }}>
                    {t('bills.paidTitle', { count: partition.paid.length })}
                  </Text>
                  <Icon name={showPaid ? 'chevronUp' : 'chevronDown'} size={18} color={colors.textMuted} />
                </Pressable>
                {showPaid && <BillGroup rows={partition.paid} today={today} onOpen={open} />}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 12 }}>
        <Button label={t('bills.addBill')} icon="createPlus" onPress={() => router.push('/bill-form')} />
      </View>

      <PaymentSheet visible={paying !== null} row={paying} today={today} onClose={() => setPaying(null)} onSaved={paymentSaved} />
    </AppScreen>
  );
}

/** Phrase des retards issus de mois précédents : avec le montant connu, « au moins » si certains manquent, ou « à renseigner ». */
function carriedText(total: AmountTotal, format: (cents: number) => string, t: TFunction): string {
  if (total.knownCents === 0) return t('bills.carriedUnknown', { count: total.count });
  return t(total.partial ? 'bills.carriedAtLeast' : 'bills.carried', { count: total.count, amount: format(total.knownCents) });
}

interface BillGroupProps {
  rows: BillRow[];
  today: string;
  onOpen: (row: BillRow) => void;
  onPay?: (row: BillRow) => void;
}

/** Lignes d'une section sur une même surface, séparées par un filet qui commence après la pastille d'icône. */
function BillGroup({ rows, today, onOpen, onPay }: BillGroupProps) {
  return (
    <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
      {rows.map((row, index) => (
        <View key={row.id}>
          {index > 0 && <Divider inset={space.fieldDividerInset} />}
          <BillRowView row={row} today={today} onOpen={onOpen} onPay={onPay} />
        </View>
      ))}
    </Surface>
  );
}
