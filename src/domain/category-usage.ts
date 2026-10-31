/**
 * Règles de suppression d'une catégorie. Fonctions pures : l'écran lit les dépendances en base, ce fichier décide.
 *
 * Catégorie « système » : créée par l'application (clé de traduction `nameKey`). Catégorie « personnalisée » : créée par
 * l'utilisatrice (nom saisi `customName`, sans `nameKey`). La base impose l'un des deux ; aucune colonne en plus n'est
 * nécessaire pour les distinguer.
 *
 * DÉCISION MÉTIER (31/10/2026, confirmée par le propriétaire) : une catégorie personnalisée qui a des opérations ou des
 * budgets se supprime en RÉAFFECTANT : ses opérations passent dans une autre catégorie du même type, choisie par
 * l'utilisatrice ; ses budgets, qui n'ont plus d'objet, sont retirés (le nombre est annoncé avant confirmation). Aucune
 * opération n'est jamais supprimée, et le budget de la catégorie cible n'est jamais modifié.
 */
export interface CategoryNaming {
  nameKey: string | null;
  customName: string | null;
}

/** Une catégorie créée par l'utilisatrice : nom saisi et pas de clé de traduction. */
export function isCustomCategory(category: CategoryNaming): boolean {
  return category.nameKey === null && category.customName !== null;
}

/** Ce qui dépend d'une catégorie (lignes non supprimées). */
export interface CategoryUsage {
  transactions: number;
  budgets: number;
}

export type CategoryDeletion =
  | { allowed: true }
  | { allowed: false; reason: 'system' }
  | { allowed: false; reason: 'in-use'; usage: CategoryUsage };

/** Suppression autorisée seulement pour une catégorie personnalisée SANS aucune opération ni budget. */
export function evaluateCategoryDeletion(category: CategoryNaming, usage: CategoryUsage): CategoryDeletion {
  if (!isCustomCategory(category)) return { allowed: false, reason: 'system' };
  if (usage.transactions > 0 || usage.budgets > 0) return { allowed: false, reason: 'in-use', usage };
  return { allowed: true };
}

export interface ReassignmentCandidate {
  id: string;
  kind: string;
  archived: boolean;
  deletedAt: string | null;
}

export type ReassignmentTargetError = 'same' | 'kind' | 'unavailable';

/** Une catégorie peut recevoir les opérations d'une autre : active, du même type, et pas la catégorie supprimée elle-même. */
export function evaluateReassignmentTarget(
  source: Pick<ReassignmentCandidate, 'id' | 'kind'>,
  target: ReassignmentCandidate,
): ReassignmentTargetError | null {
  if (target.id === source.id) return 'same';
  if (target.deletedAt !== null || target.archived) return 'unavailable';
  if (target.kind !== source.kind) return 'kind';
  return null;
}
