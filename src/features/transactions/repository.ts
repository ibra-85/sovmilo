import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { transactions } from '@/db/schema';
import { MAX_AMOUNT_CENTS } from '@/domain/money';
import type { PaymentMethod, TransactionType } from '@/domain/types';

export interface AddTransactionInput {
  type: TransactionType;
  amountCents: number;
  categoryId: string | null;
  /** Date de l'opération, `YYYY-MM-DD`. */
  occurredOn: string;
  paymentMethod?: PaymentMethod;
  note?: string | null;
}

/** Enregistre une opération dans la base locale (fonctionne hors ligne) et renvoie son identifiant. */
export function addTransaction(input: AddTransactionInput): string {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > MAX_AMOUNT_CENTS) {
    throw new RangeError(`Montant invalide : ${input.amountCents}`);
  }

  const id = newId();
  const now = nowISO();
  db.insert(transactions)
    .values({
      id,
      userId: LOCAL_USER_ID,
      type: input.type,
      amountCents: input.amountCents,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod ?? 'card', // paiement par carte par défaut
      occurredOn: input.occurredOn,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}
