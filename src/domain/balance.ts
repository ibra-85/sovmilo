import { toISODate } from './dates';
import type { TransactionLike } from './budget';

/**
 * Solde réel = ce que la banque affiche, saisi par l'utilisatrice (« account_snapshots »).
 * Solde estimé = ce que l'application en déduit depuis cette saisie : c'est un autre chiffre, la différence entre
 * les deux est précisément ce que l'utilisatrice a oublié de noter.
 */
export interface BalanceSnapshotLike {
  /** Peut être négatif (compte à découvert). */
  realBalanceCents: number;
  /** Horodatage ISO de la saisie. */
  recordedAt: string;
}

/** Jour local (`YYYY-MM-DD`) d'un horodatage ISO. Lève une erreur si l'horodatage est invalide. */
export function snapshotDay(recordedAt: string): string {
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Horodatage invalide : ${recordedAt}`);
  return toISODate(date);
}

/**
 * Solde estimé aujourd'hui = dernier solde réel + revenus − dépenses − virements vers l'épargne
 * des opérations DATÉES APRÈS le jour de la saisie. Celles du jour même sont considérées comme déjà comprises
 * dans le solde affiché par la banque.
 */
export function estimateBalance(snapshot: BalanceSnapshotLike, transactions: readonly TransactionLike[]): number {
  if (!Number.isSafeInteger(snapshot.realBalanceCents)) {
    throw new RangeError(`Solde invalide (centimes entiers attendus) : ${snapshot.realBalanceCents}`);
  }
  const day = snapshotDay(snapshot.recordedAt);

  let balance = snapshot.realBalanceCents;
  for (const tx of transactions) {
    if (tx.occurredOn <= day) continue;
    if (!Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) {
      throw new RangeError(`Montant d'opération invalide (entier > 0 attendu) : ${tx.amountCents}`);
    }
    balance += tx.type === 'income' ? tx.amountCents : -tx.amountCents; // dépense et épargne sortent toutes deux du compte
  }
  return balance;
}
