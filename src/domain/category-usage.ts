/**
 * Règles de suppression d'une catégorie. Fonctions pures : l'écran lit les dépendances en base, ce fichier décide.
 *
 * Catégorie « système » : créée par l'application (clé de traduction `nameKey`). Catégorie « personnalisée » : créée par
 * l'utilisatrice (nom saisi `customName`, sans `nameKey`). La base impose l'un des deux ; aucune colonne en plus n'est
 * nécessaire pour les distinguer.
 *
 * DÉCISION MÉTIER NON PRISE (à confirmer) : que faire d'une catégorie qui a déjà des opérations ou des budgets —
 * les réaffecter à une autre catégorie, l'archiver, ou refuser ? En attendant, la règle SÛRE est de refuser : aucune
 * opération ni aucun budget n'est jamais modifié ou supprimé implicitement.
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
