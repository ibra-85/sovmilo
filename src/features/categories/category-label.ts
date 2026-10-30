import type { ParseKeys, TFunction } from 'i18next';

import type { Category } from '@/db/schema';

/** Nom affiché d'une catégorie : nom personnalisé, sinon nom par défaut traduit dans la langue active. */
export function categoryLabel(category: Pick<Category, 'nameKey' | 'customName'>, t: TFunction): string {
  if (category.customName) return category.customName;
  // `nameKey` vient de la base (ex. « categories.groceries »), TypeScript ne peut pas le vérifier : le seed est testé à part.
  if (category.nameKey) return t(category.nameKey as ParseKeys);
  return '';
}
