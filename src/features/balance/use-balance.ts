import { desc, gt, and, isNull } from 'drizzle-orm';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { useLive } from '@/db/live';
import { accountSnapshots, transactions, type AccountSnapshot } from '@/db/schema';
import { estimateBalance, snapshotDay } from '@/domain/balance';

export interface BalanceInfo {
  /** Dernier solde saisi d'après la banque ; null si rien n'a encore été saisi. */
  snapshot: AccountSnapshot | null;
  /** Solde que l'application en déduit aujourd'hui ; null sans saisie. */
  estimatedCents: number | null;
}

/** Dernier solde réel saisi, et solde estimé en y ajoutant les opérations enregistrées depuis. Se met à jour toute seule. */
export function useBalance(): BalanceInfo {
  const { data: snapshots } = useLive(
    db
      .select()
      .from(accountSnapshots)
      .where(isNull(accountSnapshots.deletedAt))
      .orderBy(desc(accountSnapshots.recordedAt))
      .limit(1),
  );
  const snapshot = snapshots[0] ?? null;
  // Sans saisie, on cherche après une date impossible : la requête ne renvoie rien.
  const since = snapshot ? snapshotDay(snapshot.recordedAt) : '9999-12-31';

  const { data: later } = useLive(
    db
      .select({ type: transactions.type, amountCents: transactions.amountCents, occurredOn: transactions.occurredOn })
      .from(transactions)
      .where(and(isNull(transactions.deletedAt), gt(transactions.occurredOn, since))),
    [since],
  );

  const estimatedCents = useMemo(() => (snapshot ? estimateBalance(snapshot, later) : null), [snapshot, later]);
  return { snapshot, estimatedCents };
}
