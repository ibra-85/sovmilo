import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { accountSnapshots } from '@/db/schema';
import { MAX_AMOUNT_CENTS } from '@/domain/money';

/** Enregistre le solde affiché par la banque, à l'instant présent. Négatif admis (découvert). */
export function addAccountSnapshot(realBalanceCents: number): string {
  if (!Number.isSafeInteger(realBalanceCents) || Math.abs(realBalanceCents) > MAX_AMOUNT_CENTS) {
    throw new RangeError(`Solde invalide : ${realBalanceCents}`);
  }
  const id = newId();
  const now = nowISO();
  db.insert(accountSnapshots)
    .values({ id, userId: LOCAL_USER_ID, realBalanceCents, recordedAt: now, createdAt: now, updatedAt: now })
    .run();
  return id;
}
