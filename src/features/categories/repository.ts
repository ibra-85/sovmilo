import { and, count, eq, isNull, min } from 'drizzle-orm';

import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { budgets, categories, transactions } from '@/db/schema';
import { MAX_CATEGORY_NAME_LENGTH, cleanCategoryName } from '@/domain/category-name';
import { evaluateCategoryDeletion, isCustomCategory, type CategoryDeletion, type CategoryUsage } from '@/domain/category-usage';
import type { CategoryKind } from '@/domain/types';

/** Teinte neutre : le design n'a aucune couleur par catégorie, mais la colonne `color` de la base est obligatoire. */
const NEUTRAL_COLOR = '#9A9684';

export interface NewCategoryInput {
  kind: CategoryKind;
  name: string;
  /** Valeur stockée : `icon:<id>` (catalogue) ou emoji (voir `src/domain/category-icon.ts`). */
  icon: string;
}

/**
 * Crée une catégorie personnalisée et renvoie son identifiant. Elle passe en PREMIER dans l'ordre d'affichage de son
 * type (juste après « Créer » dans le carrousel, comme dans le design). Le contrôle des doublons se fait avant, à
 * l'écran, avec les noms traduits ; ici on ne valide que ce que la base exige.
 */
export function createCategory(input: NewCategoryInput): string {
  const name = cleanCategoryName(input.name);
  if (name === '' || name.length > MAX_CATEGORY_NAME_LENGTH) throw new RangeError(`Nom de catégorie invalide : « ${name} »`);
  if (input.icon.trim() === '') throw new RangeError('Icône de catégorie manquante');

  const id = newId();
  const now = nowISO();
  db.transaction((tx) => {
    const first = tx
      .select({ value: min(categories.sortOrder) })
      .from(categories)
      .where(and(eq(categories.kind, input.kind), isNull(categories.deletedAt)))
      .get();
    tx.insert(categories)
      .values({
        id,
        userId: LOCAL_USER_ID,
        kind: input.kind,
        customName: name,
        icon: input.icon,
        color: NEUTRAL_COLOR,
        sortOrder: (first?.value ?? 0) - 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });
  return id;
}

function findCategory(id: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
    .get();
}

/**
 * Modifie le nom et l'icône d'une catégorie PERSONNALISÉE. L'identifiant ne change pas : les opérations et les budgets qui
 * y sont rattachés suivent automatiquement. Une catégorie système ne se modifie pas (son nom vient des traductions).
 */
export function updateCategory(id: string, input: { name: string; icon: string }): void {
  const name = cleanCategoryName(input.name);
  if (name === '' || name.length > MAX_CATEGORY_NAME_LENGTH) throw new RangeError(`Nom de catégorie invalide : « ${name} »`);
  if (input.icon.trim() === '') throw new RangeError('Icône de catégorie manquante');

  const existing = findCategory(id);
  if (!existing) throw new Error('Catégorie introuvable');
  if (!isCustomCategory(existing)) throw new Error('Une catégorie par défaut ne se modifie pas');

  db.update(categories).set({ customName: name, icon: input.icon, updatedAt: nowISO() }).where(eq(categories.id, id)).run();
}

/** Opérations et budgets (non supprimés) rattachés à une catégorie. */
export function getCategoryUsage(id: string): CategoryUsage {
  const tx = db
    .select({ value: count() })
    .from(transactions)
    .where(and(eq(transactions.categoryId, id), isNull(transactions.deletedAt)))
    .get();
  const bg = db
    .select({ value: count() })
    .from(budgets)
    .where(and(eq(budgets.categoryId, id), isNull(budgets.deletedAt)))
    .get();
  return { transactions: tx?.value ?? 0, budgets: bg?.value ?? 0 };
}

/** Ce que la suppression de cette catégorie donnerait, sans rien modifier (pour expliquer à l'écran). */
export function checkCategoryDeletion(id: string): CategoryDeletion {
  const existing = findCategory(id);
  if (!existing) return { allowed: false, reason: 'system' };
  return evaluateCategoryDeletion(existing, getCategoryUsage(id));
}

/**
 * Supprime (suppression logique) une catégorie personnalisée SANS dépendance. Les règles sont revérifiées ici : même si
 * l'écran était périmé, rien n'est supprimé quand la catégorie a des opérations ou des budgets. Renvoie le verdict.
 */
export function deleteCategory(id: string): CategoryDeletion {
  const verdict = checkCategoryDeletion(id);
  if (!verdict.allowed) return verdict;
  const now = nowISO();
  db.update(categories).set({ deletedAt: now, updatedAt: now }).where(eq(categories.id, id)).run();
  return verdict;
}
