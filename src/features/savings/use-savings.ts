import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { savingsGoals, savingsMovements, type SavingsGoal, type SavingsMovement } from '@/db/schema';
import { goalProgress, newestFirst, summarizeGoals, type GoalProgress, type MovementLike, type SavingsSummary } from '@/domain/savings';

/** Un objectif avec ce qu'il faut pour l'afficher : son montant épargné vient de la somme de ses mouvements actifs. */
export interface GoalRow {
  id: string;
  name: string;
  icon: string;
  targetCents: number;
  targetDate: string | null;
  note: string | null;
  archivedAt: string | null;
  savedCents: number;
  /** Nombre de mouvements actifs (versements et retraits) : décide si l'objectif peut être supprimé ou seulement archivé. */
  movementCount: number;
  progress: GoalProgress;
}

interface Totals {
  savedCents: number;
  movementCount: number;
}

/**
 * Montant épargné de CHAQUE objectif en une seule requête agrégée (versements − retraits, mouvements annulés exclus) : la liste
 * ne charge jamais l'historique, donc elle reste rapide avec des dizaines d'objectifs et des milliers de mouvements.
 */
function useTotals(): { totals: Map<string, Totals>; loaded: boolean } {
  const rows = useLiveQuery(
    db
      .select({
        goalId: savingsMovements.goalId,
        saved: sql<number>`coalesce(sum(case when ${savingsMovements.kind} = 'deposit' then ${savingsMovements.amountCents} else -${savingsMovements.amountCents} end), 0)`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(savingsMovements)
      .where(isNull(savingsMovements.deletedAt))
      .groupBy(savingsMovements.goalId),
  );
  const totals = useMemo(() => new Map(rows.data.map((row) => [row.goalId, { savedCents: row.saved, movementCount: row.count }] as const)), [rows.data]);
  return { totals, loaded: rows.updatedAt !== undefined };
}

function toRow(goal: SavingsGoal, totals: Map<string, Totals>): GoalRow {
  const total = totals.get(goal.id);
  const savedCents = total?.savedCents ?? 0;
  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    targetCents: goal.targetCents,
    targetDate: goal.targetDate,
    note: goal.note,
    archivedAt: goal.archivedAt,
    savedCents,
    movementCount: total?.movementCount ?? 0,
    progress: goalProgress(savedCents, goal.targetCents),
  };
}

/** Objectifs ACTIFS dans l'ordre choisi par l'utilisatrice (jamais réordonnés par un versement), avec le résumé global. */
export function useActiveGoals(): { goals: GoalRow[]; summary: SavingsSummary; loaded: boolean } {
  const goals = useLiveQuery(
    db
      .select()
      .from(savingsGoals)
      .where(and(isNull(savingsGoals.deletedAt), isNull(savingsGoals.archivedAt)))
      .orderBy(asc(savingsGoals.sortOrder), asc(savingsGoals.createdAt)),
  );
  const { totals, loaded: totalsLoaded } = useTotals();
  const rows = useMemo(() => goals.data.map((goal) => toRow(goal, totals)), [goals.data, totals]);
  const summary = useMemo(() => summarizeGoals(rows), [rows]);
  return { goals: rows, summary, loaded: goals.updatedAt !== undefined && totalsLoaded };
}

/** Objectifs ARCHIVÉS, le plus récemment archivé d'abord. */
export function useArchivedGoals(): { goals: GoalRow[]; loaded: boolean } {
  const goals = useLiveQuery(
    db
      .select()
      .from(savingsGoals)
      .where(and(isNull(savingsGoals.deletedAt), isNotNull(savingsGoals.archivedAt)))
      .orderBy(desc(savingsGoals.archivedAt)),
  );
  const { totals, loaded: totalsLoaded } = useTotals();
  const rows = useMemo(() => goals.data.map((goal) => toRow(goal, totals)), [goals.data, totals]);
  return { goals: rows, loaded: goals.updatedAt !== undefined && totalsLoaded };
}

/** Un mouvement prêt à afficher. */
export interface MovementRow extends MovementLike {
  note: string | null;
}

const toMovement = (movement: SavingsMovement): MovementRow => ({
  id: movement.id,
  kind: movement.kind,
  amountCents: movement.amountCents,
  occurredOn: movement.occurredOn,
  createdAt: movement.createdAt,
  note: movement.note,
});

export interface GoalDetail {
  goal: GoalRow;
  /** Historique actif, le plus récent d'abord. */
  movements: MovementRow[];
  /** Les mêmes mouvements, pour les calculs de cohérence de la chronologie. */
  movementLikes: MovementLike[];
}

/** Détail d'un objectif (actif ou archivé) et de son historique, en direct. `detail` est `null` si l'objectif n'existe plus. */
export function useGoalDetail(id: string): { detail: GoalDetail | null; loaded: boolean } {
  const goals = useLiveQuery(db.select().from(savingsGoals).where(and(eq(savingsGoals.id, id), isNull(savingsGoals.deletedAt))), [id]);
  const movements = useLiveQuery(
    db
      .select()
      .from(savingsMovements)
      .where(and(eq(savingsMovements.goalId, id), isNull(savingsMovements.deletedAt))),
    [id],
  );

  const detail = useMemo(() => {
    const goal = goals.data[0];
    if (!goal) return null;
    const rows = newestFirst(movements.data.map(toMovement));
    let saved = 0;
    for (const movement of rows) saved += movement.kind === 'deposit' ? movement.amountCents : -movement.amountCents;
    const totals = new Map([[goal.id, { savedCents: saved, movementCount: rows.length }]]);
    return { goal: toRow(goal, totals), movements: rows, movementLikes: rows };
  }, [goals.data, movements.data]);

  return { detail, loaded: goals.updatedAt !== undefined && movements.updatedAt !== undefined };
}
