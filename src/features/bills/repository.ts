import { and, asc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { billOccurrences, bills, type Bill } from '@/db/schema';
import {
  MAX_BILL_NOTE_LENGTH,
  cleanBillName,
  cleanBillNote,
  isBillRecurrence,
  isValidBillAmount,
  isValidDate,
  plannedDueDates,
  validateBillName,
  validateNewDueDate,
  validatePayment,
  type BillRecurrence,
} from '@/domain/bills';

/**
 * Accès aux factures et à leurs échéances (base locale). Toutes les écritures valident leurs entrées et s'exécutent en une
 * transaction (tout ou rien). Suppression LOGIQUE (`deleted_at`). Rien ici ne touche à `transactions`, aux budgets ni au solde :
 * payer une facture est un suivi déclaré, jamais une opération financière.
 *
 * Les dates sont des dates civiles `YYYY-MM-DD` ; `today` est TOUJOURS passé par l'appelant (testable, aucun fuseau caché).
 */

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface BillInput {
  name: string;
  /** Centimes, ou `null` : montant à renseigner. */
  expectedAmountCents: number | null;
  recurrence: BillRecurrence;
  /** Date de la prochaine échéance (la première, à la création). */
  nextDueOn: string;
  note: string | null;
}

function assertInput(input: BillInput): { name: string; note: string | null } {
  const problem = validateBillName(input.name);
  if (problem) throw new RangeError(`Nom de facture invalide (${problem})`);
  if (!isValidBillAmount(input.expectedAmountCents)) throw new RangeError(`Montant invalide : ${input.expectedAmountCents}`);
  if (!isBillRecurrence(input.recurrence)) throw new RangeError(`Récurrence invalide : ${String(input.recurrence)}`);
  const note = cleanBillNote(input.note);
  if (note !== null && note.length > MAX_BILL_NOTE_LENGTH) throw new RangeError('Note trop longue');
  return { name: cleanBillName(input.name), note };
}

function findBill(tx: Transaction, id: string): Bill {
  const bill = tx
    .select()
    .from(bills)
    .where(and(eq(bills.id, id), isNull(bills.deletedAt)))
    .get();
  if (!bill) throw new Error('Facture introuvable');
  return bill;
}

function findOccurrence(tx: Transaction, id: string) {
  const occurrence = tx
    .select()
    .from(billOccurrences)
    .where(and(eq(billOccurrences.id, id), isNull(billOccurrences.deletedAt)))
    .get();
  if (!occurrence) throw new Error('Échéance introuvable');
  return occurrence;
}

/**
 * Crée les échéances qui manquent à une facture (voir `plannedDueDates`). Idempotent : une échéance qui existe déjà à cette date
 * n'est jamais dupliquée (et l'index unique l'interdirait de toute façon) ; une échéance retirée à tort par une modification
 * de calendrier est rétablie. Ne supprime rien et ne touche jamais une échéance payée. Renvoie le nombre d'échéances ajoutées.
 */
function syncOccurrences(tx: Transaction, bill: Bill, today: string, throughMonth?: string): number {
  const planned = plannedDueDates({ anchor: bill.anchorDate, recurrence: bill.recurrence, stoppedOn: bill.stoppedOn, today, throughMonth });
  const existing = new Map(
    tx
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.billId, bill.id))
      .all()
      .map((row) => [row.dueOn, row] as const),
  );
  const now = nowISO();
  let added = 0;
  for (const dueOn of planned) {
    const row = existing.get(dueOn);
    if (!row) {
      tx.insert(billOccurrences)
        .values({
          id: newId(),
          userId: LOCAL_USER_ID,
          billId: bill.id,
          dueOn,
          amountCents: bill.expectedAmountCents,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      added += 1;
    } else if (row.deletedAt !== null) {
      tx.update(billOccurrences)
        .set({ deletedAt: null, amountCents: bill.expectedAmountCents, paidOn: null, paidAmountCents: null, updatedAt: now })
        .where(eq(billOccurrences.id, row.id))
        .run();
      added += 1;
    }
  }
  return added;
}

/** Échéances non payées et actives d'une facture, de la plus ancienne à la plus récente. */
function unpaidOccurrences(tx: Transaction, billId: string) {
  return tx
    .select()
    .from(billOccurrences)
    .where(and(eq(billOccurrences.billId, billId), isNull(billOccurrences.deletedAt), isNull(billOccurrences.paidOn)))
    .orderBy(asc(billOccurrences.dueOn))
    .all();
}

/** Crée une facture et ses échéances ; renvoie l'identifiant de la facture et celui de sa première échéance. */
export function createBill(input: BillInput, today: string): { billId: string; occurrenceId: string } {
  const { name, note } = assertInput(input);
  const dateProblem = validateNewDueDate(input.nextDueOn, today);
  if (dateProblem) throw new RangeError(`Échéance invalide (${dateProblem})`);
  const billId = newId();
  const now = nowISO();
  return db.transaction((tx) => {
    tx.insert(bills)
      .values({
        id: billId,
        userId: LOCAL_USER_ID,
        name,
        expectedAmountCents: input.expectedAmountCents,
        recurrence: input.recurrence,
        anchorDate: input.nextDueOn,
        note,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    syncOccurrences(tx, findBill(tx, billId), today);
    const first = unpaidOccurrences(tx, billId)[0];
    if (!first) throw new Error('Aucune échéance créée');
    return { billId, occurrenceId: first.id };
  });
}

/**
 * Modifie la facture pour les échéances FUTURES : les échéances déjà payées ne changent jamais (ni montant, ni date, ni paiement).
 *  - nom et note : ceux de la facture (les paiements passés gardent leur date et leur montant) ;
 *  - montant prévu : appliqué aux échéances non payées qui ne sont pas en retard (toutes, pour une facture ponctuelle) ; une
 *    échéance en retard garde le montant qu'elle avait ;
 *  - date de la prochaine échéance ou récurrence : le calendrier non payé est reconstruit à partir de la nouvelle date (les
 *    échéances payées sont conservées telles quelles). Sans échéance non payée, ou récurrence arrêtée, ces deux champs sont ignorés.
 * Renvoie l'identifiant de la prochaine échéance non payée après modification (`null` si tout est payé).
 */
export function updateBill(billId: string, input: BillInput, today: string): string | null {
  const { name, note } = assertInput(input);
  if (!isValidDate(input.nextDueOn)) throw new RangeError('Échéance invalide');
  return db.transaction((tx) => {
    const bill = findBill(tx, billId);
    const unpaid = unpaidOccurrences(tx, billId);
    const focus = unpaid[0];
    const stopped = bill.stoppedOn !== null;
    const recurrence = stopped || !focus ? bill.recurrence : input.recurrence;
    const nextDueOn = stopped || !focus ? bill.anchorDate : input.nextDueOn;
    const scheduleChanged = focus !== undefined && !stopped && (nextDueOn !== focus.dueOn || recurrence !== bill.recurrence);
    const now = nowISO();

    tx.update(bills)
      .set({
        name,
        note,
        expectedAmountCents: input.expectedAmountCents,
        recurrence,
        anchorDate: scheduleChanged ? nextDueOn : bill.anchorDate,
        updatedAt: now,
      })
      .where(eq(bills.id, billId))
      .run();

    if (scheduleChanged) {
      for (const row of unpaid) {
        tx.update(billOccurrences).set({ deletedAt: now, updatedAt: now }).where(eq(billOccurrences.id, row.id)).run();
      }
      syncOccurrences(tx, findBill(tx, billId), today);
    } else if (input.expectedAmountCents !== bill.expectedAmountCents) {
      for (const row of unpaid) {
        if (recurrence === 'none' || row.dueOn >= today) {
          tx.update(billOccurrences)
            .set({ amountCents: input.expectedAmountCents, updatedAt: now })
            .where(eq(billOccurrences.id, row.id))
            .run();
        }
      }
    }
    return unpaidOccurrences(tx, billId)[0]?.id ?? null;
  });
}

/**
 * Complète les échéances de toutes les factures actives (à l'ouverture de l'écran, quand le jour change, ou quand on consulte un mois).
 * `throughMonth` : le mois affiché `YYYY-MM`, pour que les échéances existent au moins jusque-là (voir `plannedDueDates`).
 * Idempotent : l'appeler deux fois de suite n'ajoute rien. Renvoie le nombre d'échéances ajoutées.
 */
export function ensureOccurrences(today: string, throughMonth?: string): number {
  return db.transaction((tx) => {
    let added = 0;
    for (const bill of tx.select().from(bills).where(isNull(bills.deletedAt)).all()) {
      added += syncOccurrences(tx, bill, today, throughMonth);
    }
    return added;
  });
}

export interface PaymentInput {
  /** Date de paiement `YYYY-MM-DD` (pas dans le futur). */
  paidOn: string;
  /** Montant réellement payé en centimes, ou `null` : il restera non noté. */
  amountCents: number | null;
}

/** Déclare une échéance payée (ou corrige un paiement déjà déclaré). N'affecte aucune autre échéance, ni aucune opération. */
export function markPaid(occurrenceId: string, payment: PaymentInput, today: string): void {
  const problem = validatePayment(payment.paidOn, payment.amountCents, today);
  if (problem) throw new RangeError(`Paiement invalide (${problem})`);
  db.transaction((tx) => {
    const occurrence = findOccurrence(tx, occurrenceId);
    const bill = findBill(tx, occurrence.billId);
    tx.update(billOccurrences)
      .set({ paidOn: payment.paidOn, paidAmountCents: payment.amountCents, updatedAt: nowISO() })
      .where(eq(billOccurrences.id, occurrenceId))
      .run();
    syncOccurrences(tx, bill, today);
  });
}

/** Annule un paiement déclaré : l'échéance redevient « à payer », avec son montant prévu. La facture n'est jamais perdue. */
export function reopenOccurrence(occurrenceId: string): void {
  db.transaction((tx) => {
    const occurrence = findOccurrence(tx, occurrenceId);
    findBill(tx, occurrence.billId);
    if (occurrence.paidOn === null) return;
    tx.update(billOccurrences)
      .set({ paidOn: null, paidAmountCents: null, updatedAt: nowISO() })
      .where(eq(billOccurrences.id, occurrenceId))
      .run();
  });
}

/**
 * Arrête la récurrence : plus aucune échéance n'est créée après aujourd'hui, et les échéances non payées qui ne sont pas encore
 * dues sont retirées. Les échéances payées et celles déjà dues (même impayées) sont conservées. Si aucune échéance ne subsiste
 * (rien de dû ni de payé), la facture est supprimée avec : renvoie alors `'deleted'`.
 */
export function stopRecurrence(billId: string, today: string): 'stopped' | 'deleted' {
  return db.transaction((tx) => {
    const bill = findBill(tx, billId);
    if (bill.recurrence === 'none' || bill.stoppedOn !== null) throw new Error('Aucune récurrence à arrêter');
    const now = nowISO();
    tx.update(bills).set({ stoppedOn: today, updatedAt: now }).where(eq(bills.id, billId)).run();
    tx.update(billOccurrences)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(billOccurrences.billId, billId),
          isNull(billOccurrences.deletedAt),
          isNull(billOccurrences.paidOn),
          gt(billOccurrences.dueOn, today),
        ),
      )
      .run();
    const remaining = tx
      .select({ id: billOccurrences.id })
      .from(billOccurrences)
      .where(and(eq(billOccurrences.billId, billId), isNull(billOccurrences.deletedAt)))
      .get();
    if (remaining) return 'stopped';
    tx.update(bills).set({ deletedAt: now }).where(eq(bills.id, billId)).run();
    return 'deleted';
  });
}

/** Supprime la facture ET toutes ses échéances (paiements compris), en une transaction. L'écran demande une confirmation explicite avant. */
export function deleteBill(billId: string): void {
  db.transaction((tx) => {
    findBill(tx, billId);
    const now = nowISO();
    tx.update(billOccurrences)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(billOccurrences.billId, billId), isNull(billOccurrences.deletedAt)))
      .run();
    tx.update(bills).set({ deletedAt: now, updatedAt: now }).where(eq(bills.id, billId)).run();
  });
}
