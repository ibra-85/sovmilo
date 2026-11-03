import type { TFunction } from 'i18next';

import { billStatus, daysBetween, splitDate, type BillRecurrence, type BillStatus, type OccurrenceLike } from '@/domain/bills';
import { formatDayMonth, formatShortDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { AppLocale } from '@/domain/types';

/**
 * Textes d'affichage des factures (fonctions pures, testées en français et en russe). Un statut s'écrit TOUJOURS en toutes
 * lettres : la couleur ne fait que l'accompagner.
 */

/** Statut écrit : « En retard de 12 jours », « À payer aujourd’hui », « À payer dans 3 jours », « À venir », « Payée le 12 nov. ». */
export function statusText(
  occurrence: Pick<OccurrenceLike, 'dueOn' | 'paidOn'>,
  today: string,
  locale: AppLocale,
  t: TFunction,
): string {
  const status: BillStatus = billStatus(occurrence, today);
  switch (status) {
    case 'paid':
      return t('bills.statusPaid', { date: formatShortDate(occurrence.paidOn ?? occurrence.dueOn, locale) });
    case 'overdue':
      return t('bills.statusOverdue', { count: -daysBetween(today, occurrence.dueOn) });
    case 'today':
      return t('bills.statusToday');
    case 'soon':
      return t('bills.statusSoon', { count: daysBetween(today, occurrence.dueOn) });
    default:
      return t('bills.statusUpcoming');
  }
}

export function recurrenceName(recurrence: BillRecurrence, t: TFunction): string {
  return t(recurrence === 'monthly' ? 'bills.recurrenceMonthly' : recurrence === 'yearly' ? 'bills.recurrenceYearly' : 'bills.recurrenceNone');
}

/** Phrase de récurrence du détail : « Chaque mois, le 12 », « Chaque année, le 5 mars », « Facture ponctuelle » ; « Arrêtée le … » si elle est arrêtée. */
export function recurrenceDetail(
  bill: { recurrence: BillRecurrence; anchorDate: string; stoppedOn: string | null },
  locale: AppLocale,
  t: TFunction,
): string {
  if (bill.recurrence === 'none') return t('bills.recurrenceNoneDetail');
  const base =
    bill.recurrence === 'monthly'
      ? t('bills.recurrenceMonthlyDay', { day: splitDate(bill.anchorDate)?.day ?? '' })
      : t('bills.recurrenceYearlyDay', { date: formatDayMonth(bill.anchorDate, locale) });
  return bill.stoppedOn === null ? base : `${base} · ${t('bills.recurrenceStopped', { date: formatShortDate(bill.stoppedOn, locale) })}`;
}

/**
 * Montant d'une échéance en texte : le montant, ou « Montant à renseigner » (non payée) / « Montant non noté » (payée). Jamais
 * « 0 € » pour un montant inconnu.
 */
export function amountText(cents: number | null, paid: boolean, locale: AppLocale, t: TFunction): string {
  if (cents !== null) return formatMoney(cents, locale);
  return t(paid ? 'bills.amountUnknown' : 'bills.amountToFill');
}
