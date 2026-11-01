import { asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { billOccurrences, bills, type Bill, type BillOccurrence } from '@/db/schema';
import type { OccurrenceLike } from '@/domain/bills';

/** Une échéance avec ce qu'il faut de sa facture pour l'afficher. */
export interface BillRow extends OccurrenceLike {
  id: string;
  billId: string;
  name: string;
  recurrence: Bill['recurrence'];
  /** Dernier jour d'existence de la série (récurrence arrêtée), ou `null`. */
  stoppedOn: string | null;
  /** Date d'ancrage de la série (le jour d'origine de la récurrence). */
  anchorDate: string;
  /** Montant prévu de la FACTURE (pour les prochaines échéances) ; chaque échéance a le sien dans `amountCents`. */
  billAmountCents: number | null;
  note: string | null;
}

function toRow(occurrence: BillOccurrence, bill: Bill): BillRow {
  return {
    id: occurrence.id,
    billId: occurrence.billId,
    dueOn: occurrence.dueOn,
    amountCents: occurrence.amountCents,
    paidOn: occurrence.paidOn,
    paidAmountCents: occurrence.paidAmountCents,
    name: bill.name,
    recurrence: bill.recurrence,
    stoppedOn: bill.stoppedOn,
    anchorDate: bill.anchorDate,
    billAmountCents: bill.expectedAmountCents,
    note: bill.note,
  };
}

/**
 * Toutes les échéances actives des factures actives (en direct). Deux requêtes séparées plutôt qu'une jointure : chacune est
 * suivie par son propre abonnement, donc renommer une facture comme payer une échéance rafraîchissent l'écran.
 */
export function useBillRows(): { rows: BillRow[]; loaded: boolean } {
  const occurrences = useLiveQuery(db.select().from(billOccurrences).where(isNull(billOccurrences.deletedAt)).orderBy(asc(billOccurrences.dueOn)));
  const definitions = useLiveQuery(db.select().from(bills).where(isNull(bills.deletedAt)));
  const rows = useMemo(() => {
    const byId = new Map(definitions.data.map((bill) => [bill.id, bill] as const));
    const result: BillRow[] = [];
    for (const occurrence of occurrences.data) {
      const bill = byId.get(occurrence.billId);
      if (bill) result.push(toRow(occurrence, bill));
    }
    return result;
  }, [occurrences.data, definitions.data]);
  return { rows, loaded: occurrences.updatedAt !== undefined && definitions.updatedAt !== undefined };
}

export interface BillDetail {
  /** L'échéance affichée. */
  current: BillRow;
  /** Les échéances payées de la même facture, la plus récente d'abord (historique). */
  history: BillRow[];
  /** Nombre de paiements enregistrés (pour avertir avant une suppression). */
  paidCount: number;
  /** Prochaine échéance non payée de la facture (la plus ancienne), ou `null` si tout est payé. C'est celle que le formulaire de modification édite. */
  nextUnpaid: BillRow | null;
}

/**
 * Détail d'une échéance. Si l'identifiant n'existe plus parce qu'une modification de calendrier a reconstruit les échéances non
 * payées, on affiche la prochaine échéance non payée de la même facture : l'écran ne tombe pas sur « introuvable ».
 */
export function useBillDetail(id: string): { detail: BillDetail | null; loaded: boolean } {
  const { rows, loaded } = useBillRows();
  // Même si l'échéance n'est plus active, la ligne garde l'identifiant de sa facture.
  const trace = useLiveQuery(db.select().from(billOccurrences).where(eq(billOccurrences.id, id)), [id]);
  const billId = trace.data[0]?.billId;

  const detail = useMemo(() => {
    const own = rows.find((row) => row.id === id);
    const siblings = rows.filter((row) => row.billId === (own?.billId ?? billId));
    const current = own ?? siblings.find((row) => row.paidOn === null) ?? siblings[siblings.length - 1];
    if (!current) return null;
    const history = siblings.filter((row) => row.paidOn !== null).sort((a, b) => (a.dueOn < b.dueOn ? 1 : -1));
    return { current, history, paidCount: history.length, nextUnpaid: siblings.find((row) => row.paidOn === null) ?? null };
  }, [rows, id, billId]);

  return { detail, loaded };
}
