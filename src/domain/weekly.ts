import type { TransactionLike } from './budget';
import { daysInMonth, isMonthKey } from './dates';

/** Une tranche de semaine du graphique d'un mois : jours `startDay` à `endDay` inclus. */
export interface WeekTotal {
  startDay: number;
  endDay: number;
  expenseCents: number;
}

/**
 * Tranches du graphique « Dépenses par semaine » : 1–7, 8–14, 15–21, puis 22 jusqu'à la fin du mois.
 * Ce sont des tranches de dates fixes, pas des semaines civiles (PROPOSITION du design, voir design/OPEN_DECISIONS.md).
 */
export function weekRanges(month: string): { startDay: number; endDay: number }[] {
  const last = daysInMonth(month);
  return [
    { startDay: 1, endDay: 7 },
    { startDay: 8, endDay: 14 },
    { startDay: 15, endDay: 21 },
    { startDay: 22, endDay: last },
  ];
}

/** Dépenses du mois par tranche de semaine. Seules les dépenses comptent (ni revenus ni virements vers l'épargne). */
export function computeWeeklyExpenses(transactions: readonly TransactionLike[], month: string): WeekTotal[] {
  if (!isMonthKey(month)) throw new RangeError(`Mois invalide (format YYYY-MM attendu) : ${month}`);
  const weeks = weekRanges(month).map((range) => ({ ...range, expenseCents: 0 }));

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.occurredOn.startsWith(`${month}-`)) continue;
    if (!Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) {
      throw new RangeError(`Montant d'opération invalide (entier > 0 attendu) : ${tx.amountCents}`);
    }
    const day = Number(tx.occurredOn.slice(8, 10));
    const week = weeks.find((w) => day >= w.startDay && day <= w.endDay);
    if (week) week.expenseCents += tx.amountCents;
  }
  return weeks;
}

/** Indice de la tranche qui contient `today` (`YYYY-MM-DD`), ou null si `today` n'est pas dans ce mois. */
export function currentWeekIndex(today: string, month: string): number | null {
  if (!today.startsWith(`${month}-`)) return null;
  const day = Number(today.slice(8, 10));
  const index = weekRanges(month).findIndex((range) => day >= range.startDay && day <= range.endDay);
  return index === -1 ? null : index;
}
