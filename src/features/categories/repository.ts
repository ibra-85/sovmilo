import { and, eq, isNull, min } from 'drizzle-orm';

import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { categories } from '@/db/schema';
import { MAX_CATEGORY_NAME_LENGTH, cleanCategoryName } from '@/domain/category-name';
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
