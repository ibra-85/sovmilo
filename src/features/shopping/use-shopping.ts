import { and, asc, eq, isNull } from 'drizzle-orm';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { useLive } from '@/db/live';
import { shoppingItems, shoppingLists, type ShoppingItem, type ShoppingList } from '@/db/schema';
import { summarizeItems, type ShoppingSummary } from '@/domain/shopping';

/** Listes de courses actives, dans l'ordre de création. Se met à jour toute seule. */
export function useShoppingLists(): ShoppingList[] {
  const { data } = useLive(db.select().from(shoppingLists).where(isNull(shoppingLists.deletedAt)).orderBy(asc(shoppingLists.createdAt)));
  return data;
}

/** Une liste, ou `undefined` si elle n'existe pas (ou plus). */
export function useShoppingList(id: string): ShoppingList | undefined {
  const { data } = useLive(
    db
      .select()
      .from(shoppingLists)
      .where(and(eq(shoppingLists.id, id), isNull(shoppingLists.deletedAt))),
    [id],
  );
  return data[0];
}

/** Articles actifs d'une liste, répartis en « à acheter » / « déjà pris », avec l'estimation du reste à acheter. */
export function useShoppingItems(listId: string): ShoppingSummary<ShoppingItem> {
  const { data } = useLive(
    db
      .select()
      .from(shoppingItems)
      .where(and(eq(shoppingItems.listId, listId), isNull(shoppingItems.deletedAt))),
    [listId],
  );
  return useMemo(() => summarizeItems(data), [data]);
}

/** Nombre d'articles par liste, au total et restant à acheter (écran d'ensemble). */
export function useListCounts(): { remaining: Map<string, number>; total: Map<string, number> } {
  const { data } = useLive(db.select().from(shoppingItems).where(isNull(shoppingItems.deletedAt)));
  return useMemo(() => {
    const remaining = new Map<string, number>();
    const total = new Map<string, number>();
    for (const item of data) {
      total.set(item.listId, (total.get(item.listId) ?? 0) + 1);
      if (!item.checked) remaining.set(item.listId, (remaining.get(item.listId) ?? 0) + 1);
    }
    return { remaining, total };
  }, [data]);
}
