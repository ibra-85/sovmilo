import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { budgets } from '@/db/schema';
import { resolveBudgetLimits } from '@/domain/budget';
import { isMonthKey } from '@/domain/dates';
import { MAX_AMOUNT_CENTS } from '@/domain/money';

function assertValid(month: string, amountCents: number): void {
  if (!isMonthKey(month)) throw new RangeError(`Mois invalide : ${month}`);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > MAX_AMOUNT_CENTS) {
    throw new RangeError(`Plafond invalide : ${amountCents}`);
  }
}

function findRow(categoryId: string, month: string) {
  return db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, LOCAL_USER_ID), eq(budgets.categoryId, categoryId), eq(budgets.month, month)))
    .get();
}

/** Plafond en vigueur d'une catégorie au mois `month` (lecture immédiate, sans attendre un hook), ou null s'il n'y en a pas. */
export function getCurrentLimit(categoryId: string, month: string): number | null {
  const rows = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, LOCAL_USER_ID), eq(budgets.categoryId, categoryId)))
    .all()
    .map((row) => ({
      categoryId: row.categoryId,
      month: row.month,
      amountCents: row.amountCents,
      deleted: row.deletedAt !== null,
    }));
  return resolveBudgetLimits(rows, month).get(categoryId) ?? null;
}

/**
 * Fixe le plafond mensuel d'une catégorie à partir de `month` (il vaut aussi pour les mois suivants, voir `resolveBudgetLimits`).
 * Une seule ligne existe par catégorie et par mois : on la met à jour, ou on la ranime si elle avait été supprimée.
 */
export function setBudget(categoryId: string, month: string, amountCents: number): void {
  assertValid(month, amountCents);
  const now = nowISO();

  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, LOCAL_USER_ID), eq(budgets.categoryId, categoryId), eq(budgets.month, month)))
      .get();

    if (existing) {
      tx.update(budgets).set({ amountCents, deletedAt: null, updatedAt: now }).where(eq(budgets.id, existing.id)).run();
    } else {
      tx.insert(budgets)
        .values({ id: newId(), userId: LOCAL_USER_ID, categoryId, month, amountCents, createdAt: now, updatedAt: now })
        .run();
    }
  });
}

/**
 * Retire le plafond d'une catégorie à partir de `month`, sans modifier les mois précédents.
 * Si la ligne de ce mois n'existe pas (plafond hérité d'un mois antérieur), on en crée une déjà supprimée : c'est la
 * « pierre tombale » qui arrête la reconduction. `currentLimitCents` (le plafond affiché) remplit alors le montant obligatoire.
 */
export function removeBudget(categoryId: string, month: string, currentLimitCents: number): void {
  assertValid(month, currentLimitCents);
  const now = nowISO();
  const existing = findRow(categoryId, month);

  if (existing) {
    db.update(budgets).set({ deletedAt: now, updatedAt: now }).where(eq(budgets.id, existing.id)).run();
  } else {
    db.insert(budgets)
      .values({
        id: newId(),
        userId: LOCAL_USER_ID,
        categoryId,
        month,
        amountCents: currentLimitCents,
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      })
      .run();
  }
}
