import { and, asc, eq, isNull } from 'drizzle-orm';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { useLive } from '@/db/live';
import { categories, type Category } from '@/db/schema';
import type { CategoryKind } from '@/domain/types';

/** Catégories actives (ni archivées ni supprimées) d'un type, dans l'ordre d'affichage. Se met à jour toute seule. */
export function useCategories(kind: CategoryKind): Category[] {
  const { data } = useLive(
    db
      .select()
      .from(categories)
      .where(and(eq(categories.kind, kind), eq(categories.archived, false), isNull(categories.deletedAt)))
      .orderBy(asc(categories.sortOrder)),
    [kind],
  );
  return data;
}

/**
 * Toutes les catégories par identifiant, y compris archivées : une opération ancienne doit garder son nom et son icône.
 * (Pas de jointure SQL dans les listes d'opérations : useLiveQuery n'écoute que la table principale d'une requête.)
 */
export function useCategoryMap(): Map<string, Category> {
  const { data } = useLive(db.select().from(categories));
  return useMemo(() => new Map(data.map((category) => [category.id, category])), [data]);
}
