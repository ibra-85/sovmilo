import { normalizeSearch } from './history';

/** Au-delà, le nom ne tient plus sous une tuile de 74 dp sur deux lignes. */
export const MAX_CATEGORY_NAME_LENGTH = 24;

export type CategoryNameProblem = 'empty' | 'tooLong' | 'duplicate';

/** Nom enregistré : espaces de début et de fin retirés, espaces multiples réduits à un seul. */
export function cleanCategoryName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Vérifie le nom saisi pour une nouvelle catégorie. `existingNames` : les noms AFFICHÉS des catégories du même type
 * (noms par défaut déjà traduits). Deux noms sont identiques à la casse, aux accents et aux espaces près
 * (« Santé » = « sante »). Renvoie null quand le nom est acceptable.
 */
export function validateCategoryName(name: string, existingNames: readonly string[]): CategoryNameProblem | null {
  const cleaned = cleanCategoryName(name);
  if (cleaned === '') return 'empty';
  if (cleaned.length > MAX_CATEGORY_NAME_LENGTH) return 'tooLong';
  const wanted = normalizeSearch(cleaned);
  return existingNames.some((existing) => normalizeSearch(existing) === wanted) ? 'duplicate' : null;
}
