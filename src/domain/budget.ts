import { isMonthKey } from './dates';
import type { TransactionType } from './types';

/** Ce dont le calcul a besoin d'une opération (les lignes supprimées doivent être filtrées en amont). */
export interface TransactionLike {
  type: TransactionType;
  amountCents: number;
  /** Date au format `YYYY-MM-DD`. */
  occurredOn: string;
}

export interface MonthTotals {
  incomeCents: number;
  expenseCents: number;
  /** Virements vers l'épargne : ils sortent du budget mais ne sont pas des dépenses. */
  savingsCents: number;
  /** Reste à dépenser = revenus − dépenses − virements vers l'épargne. Peut être négatif. */
  remainingCents: number;
  /** Nombre d'opérations du mois, tous types confondus. */
  operationCount: number;
}

/** Une opération avec sa catégorie, pour les plafonds par catégorie. */
export interface CategorizedTransactionLike extends TransactionLike {
  categoryId: string | null;
}

/** Une ligne de la table `budgets`, y compris les lignes supprimées (elles servent de « pierre tombale », voir `resolveBudgetLimits`). */
export interface BudgetRow {
  categoryId: string;
  /** `YYYY-MM` : mois à partir duquel ce plafond s'applique. */
  month: string;
  amountCents: number;
  deleted: boolean;
}

/** Au-delà de ce pourcentage du plafond, on prévient (puis on alerte au-delà de 100 %). */
export const BUDGET_WARNING_PERCENT = 80;

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface CategoryBudgetProgress {
  categoryId: string;
  /** Plafond du mois, ou null si la catégorie n'en a pas. */
  limitCents: number | null;
  spentCents: number;
  /** Plafond − dépensé (négatif si dépassé) ; null sans plafond. */
  remainingCents: number | null;
  /** Dépensé / plafond en %, arrondi vers le bas (peut dépasser 100) ; null sans plafond. */
  percent: number | null;
  /** null sans plafond. */
  status: BudgetStatus | null;
}

/**
 * Plafond en vigueur pour chaque catégorie au mois `month`.
 *
 * Un plafond saisi pour un mois vaut pour ce mois ET les suivants, jusqu'à ce qu'un autre plafond le remplace :
 * l'utilisatrice ne ressaisit pas ses budgets chaque mois. Supprimer un plafond (ligne `deleted`) le retire de ce mois
 * en avant, sans toucher aux mois précédents. Sans ligne applicable, la catégorie n'a pas de plafond.
 */
export function resolveBudgetLimits(rows: readonly BudgetRow[], month: string): Map<string, number> {
  if (!isMonthKey(month)) throw new RangeError(`Mois invalide (format YYYY-MM attendu) : ${month}`);

  const latest = new Map<string, BudgetRow>();
  for (const row of rows) {
    if (row.month > month) continue; // `YYYY-MM` se compare correctement comme du texte
    const current = latest.get(row.categoryId);
    if (!current || row.month > current.month) latest.set(row.categoryId, row);
  }

  const limits = new Map<string, number>();
  for (const [categoryId, row] of latest) {
    if (row.deleted) continue;
    if (!Number.isSafeInteger(row.amountCents) || row.amountCents <= 0) {
      throw new RangeError(`Plafond invalide (entier > 0 attendu) : ${row.amountCents}`);
    }
    limits.set(categoryId, row.amountCents);
  }
  return limits;
}

/** Dépenses du mois par catégorie. Seules les dépenses comptent : revenus et virements vers l'épargne sont ignorés. */
export function computeCategorySpending(
  transactions: readonly CategorizedTransactionLike[],
  month: string,
): Map<string, number> {
  if (!isMonthKey(month)) throw new RangeError(`Mois invalide (format YYYY-MM attendu) : ${month}`);

  const spending = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.categoryId === null || !tx.occurredOn.startsWith(`${month}-`)) continue;
    if (!Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) {
      throw new RangeError(`Montant d'opération invalide (entier > 0 attendu) : ${tx.amountCents}`);
    }
    spending.set(tx.categoryId, (spending.get(tx.categoryId) ?? 0) + tx.amountCents);
  }
  return spending;
}

/**
 * `warning` au-delà de 80 % du plafond, `over` au-delà de 100 %. Pile 100 % reste `warning` : le plafond est atteint, pas dépassé.
 * Calcul en entiers (pas de pourcentage décimal) pour que 80,00 % pile ne bascule jamais à cause d'un arrondi.
 */
export function budgetStatus(spentCents: number, limitCents: number): BudgetStatus {
  if (spentCents > limitCents) return 'over';
  if (spentCents * 100 > limitCents * BUDGET_WARNING_PERCENT) return 'warning';
  return 'ok';
}

/** Une entrée par catégorie de `categoryIds`, dans cet ordre, avec son plafond et l'état de sa consommation. */
export function buildBudgetProgress(
  categoryIds: readonly string[],
  limits: ReadonlyMap<string, number>,
  spending: ReadonlyMap<string, number>,
): CategoryBudgetProgress[] {
  return categoryIds.map((categoryId) => {
    const spentCents = spending.get(categoryId) ?? 0;
    const limitCents = limits.get(categoryId) ?? null;
    if (limitCents === null) {
      return { categoryId, limitCents, spentCents, remainingCents: null, percent: null, status: null };
    }
    return {
      categoryId,
      limitCents,
      spentCents,
      remainingCents: limitCents - spentCents,
      percent: Math.floor((spentCents * 100) / limitCents),
      status: budgetStatus(spentCents, limitCents),
    };
  });
}

/** Totaux d'un mois (`YYYY-MM`). Les opérations des autres mois sont ignorées. */
export function computeMonthTotals(transactions: readonly TransactionLike[], month: string): MonthTotals {
  if (!isMonthKey(month)) throw new RangeError(`Mois invalide (format YYYY-MM attendu) : ${month}`);

  let incomeCents = 0;
  let expenseCents = 0;
  let savingsCents = 0;
  let operationCount = 0;

  for (const tx of transactions) {
    if (!tx.occurredOn.startsWith(`${month}-`)) continue;
    if (!Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) {
      throw new RangeError(`Montant d'opération invalide (entier > 0 attendu) : ${tx.amountCents}`);
    }
    operationCount += 1;
    switch (tx.type) {
      case 'income':
        incomeCents += tx.amountCents;
        break;
      case 'expense':
        expenseCents += tx.amountCents;
        break;
      case 'transfer':
        savingsCents += tx.amountCents;
        break;
    }
  }

  return {
    incomeCents,
    expenseCents,
    savingsCents,
    remainingCents: incomeCents - expenseCents - savingsCents,
    operationCount,
  };
}

/** Un budget avec plafond (les catégories sans plafond n'ont pas de budget). */
export type LimitedBudgetProgress = CategoryBudgetProgress & { limitCents: number; remainingCents: number; percent: number; status: BudgetStatus };

export function hasLimit(progress: CategoryBudgetProgress): progress is LimitedBudgetProgress {
  return progress.limitCents !== null;
}

const STATUS_RANK: Record<BudgetStatus, number> = { over: 0, warning: 1, ok: 2 };

/** Ordre d'urgence : dépassés, puis presque atteints, puis les autres ; à état égal, le plus consommé d'abord. */
export function compareByUrgency(a: LimitedBudgetProgress, b: LimitedBudgetProgress): number {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.percent - a.percent;
}

export interface BudgetSummary {
  count: number;
  /** Somme des plafonds. */
  limitCents: number;
  /** Somme des dépenses des seules catégories budgétées. */
  spentCents: number;
  /** Plafonds − dépenses (négatif si le total est dépassé). */
  remainingCents: number;
  /** Part consommée du total, en %, arrondie vers le bas ; 0 sans budget. */
  percent: number;
}

/**
 * Résumé « Reste sur vos budgets » : somme des budgets par catégorie. Il ne couvre pas forcément toutes les dépenses du mois
 * (une catégorie sans budget n'y entre pas) : c'est la règle proposée par le design (OPEN_DECISIONS §1).
 */
export function summarizeBudgets(budgets: readonly LimitedBudgetProgress[]): BudgetSummary {
  const limitCents = budgets.reduce((sum, b) => sum + b.limitCents, 0);
  const spentCents = budgets.reduce((sum, b) => sum + b.spentCents, 0);
  return {
    count: budgets.length,
    limitCents,
    spentCents,
    remainingCents: limitCents - spentCents,
    percent: limitCents > 0 ? Math.floor((spentCents * 100) / limitCents) : 0,
  };
}
