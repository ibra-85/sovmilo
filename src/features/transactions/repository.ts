import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { transactions, type Transaction } from '@/db/schema';
import { parseISODate } from '@/domain/dates';
import { MAX_AMOUNT_CENTS } from '@/domain/money';
import type { PaymentMethod, TransactionType } from '@/domain/types';

export interface TransactionInput {
  type: TransactionType;
  amountCents: number;
  /** Obligatoire pour une dépense ou un revenu ; `null` pour un virement vers l'épargne. */
  categoryId: string | null;
  /** Date de l'opération, `YYYY-MM-DD`. */
  occurredOn: string;
  paymentMethod?: PaymentMethod;
  note?: string | null;
}

/** Valide les champs communs à l'ajout et à la modification. Lève une erreur plutôt que d'écrire une ligne incohérente. */
function assertValid(input: TransactionInput): void {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > MAX_AMOUNT_CENTS) {
    throw new RangeError(`Montant invalide : ${input.amountCents}`);
  }
  if (!parseISODate(input.occurredOn)) throw new RangeError(`Date invalide : ${input.occurredOn}`);
  if (input.type === 'transfer' ? input.categoryId !== null : input.categoryId === null) {
    throw new RangeError(`Catégorie incohérente avec le type « ${input.type} »`);
  }
}

/** Une note vide ou faite d'espaces est enregistrée comme « pas de note ». */
const cleanNote = (note: string | null | undefined): string | null => note?.trim() || null;

/** Enregistre une opération dans la base locale (fonctionne hors ligne) et renvoie son identifiant. */
export function addTransaction(input: TransactionInput): string {
  assertValid(input);

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
      note: cleanNote(input.note),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}

/** Opération non supprimée, ou `undefined` si elle n'existe pas (ou plus). */
export function getTransaction(id: string): Transaction | undefined {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
    .get();
}

/** Remplace les champs modifiables d'une opération et met à jour `updated_at`. Renvoie false si elle n'existe plus. */
export function updateTransaction(id: string, input: TransactionInput): boolean {
  assertValid(input);

  const result = db
    .update(transactions)
    .set({
      type: input.type,
      amountCents: input.amountCents,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod ?? 'card',
      occurredOn: input.occurredOn,
      note: cleanNote(input.note),
      updatedAt: nowISO(),
    })
    .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
    .run();
  return result.changes > 0;
}

/** Suppression logique : la ligne reste en base (`deleted_at`), ce qui permet d'annuler et, plus tard, de synchroniser la suppression. */
export function softDeleteTransaction(id: string): boolean {
  const now = nowISO();
  const result = db
    .update(transactions)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
    .run();
  return result.changes > 0;
}

/** Annule une suppression logique. */
export function restoreTransaction(id: string): boolean {
  const result = db
    .update(transactions)
    .set({ deletedAt: null, updatedAt: nowISO() })
    .where(and(eq(transactions.id, id), isNotNull(transactions.deletedAt)))
    .run();
  return result.changes > 0;
}
