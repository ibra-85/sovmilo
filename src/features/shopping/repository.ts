import { and, eq, isNull, max } from 'drizzle-orm';

import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { shoppingItems, shoppingLists } from '@/db/schema';
import {
  MAX_QUANTITY_MILLI,
  MAX_UNIT_PRICE_CENTS,
  cleanShoppingName,
  isShoppingUnit,
  validateItemName,
  validateListName,
  type ShoppingUnit,
} from '@/domain/shopping';

/**
 * Accès aux listes de courses (base locale). Toutes les écritures valident leurs entrées : l'écran empêche déjà les saisies
 * invalides, ceci protège la base contre un appel incorrect. Suppression LOGIQUE (`deleted_at`), comme le reste de l'application.
 * Rien ici ne touche aux opérations, aux budgets ni au solde : les prix de courses sont des estimations.
 */

export interface ShoppingItemInput {
  name: string;
  /** Millièmes d'unité (voir `domain/shopping.ts`). */
  quantityMilli: number;
  unit: ShoppingUnit;
  /** Centimes, ou `null` : pas de prix. */
  unitPriceCents: number | null;
}

function assertItemInput(input: ShoppingItemInput): string {
  const problem = validateItemName(input.name);
  if (problem) throw new RangeError(`Nom d'article invalide (${problem})`);
  if (!Number.isSafeInteger(input.quantityMilli) || input.quantityMilli <= 0 || input.quantityMilli > MAX_QUANTITY_MILLI) {
    throw new RangeError(`Quantité invalide : ${input.quantityMilli}`);
  }
  if (!isShoppingUnit(input.unit)) throw new RangeError(`Unité invalide : ${input.unit}`);
  if (
    input.unitPriceCents !== null &&
    (!Number.isSafeInteger(input.unitPriceCents) || input.unitPriceCents <= 0 || input.unitPriceCents > MAX_UNIT_PRICE_CENTS)
  ) {
    throw new RangeError(`Prix invalide : ${input.unitPriceCents}`);
  }
  return cleanShoppingName(input.name);
}

function findList(id: string) {
  return db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, id), isNull(shoppingLists.deletedAt)))
    .get();
}

function findItem(id: string) {
  return db
    .select()
    .from(shoppingItems)
    .where(and(eq(shoppingItems.id, id), isNull(shoppingItems.deletedAt)))
    .get();
}

/** Crée une liste et renvoie son identifiant. */
export function createList(rawName: string): string {
  const problem = validateListName(rawName);
  if (problem) throw new RangeError(`Nom de liste invalide (${problem})`);
  const id = newId();
  const now = nowISO();
  db.insert(shoppingLists)
    .values({ id, userId: LOCAL_USER_ID, name: cleanShoppingName(rawName), createdAt: now, updatedAt: now })
    .run();
  return id;
}

export function renameList(id: string, rawName: string): void {
  const problem = validateListName(rawName);
  if (problem) throw new RangeError(`Nom de liste invalide (${problem})`);
  if (!findList(id)) throw new Error('Liste introuvable');
  db.update(shoppingLists).set({ name: cleanShoppingName(rawName), updatedAt: nowISO() }).where(eq(shoppingLists.id, id)).run();
}

/** Supprime la liste ET ses articles, en une seule transaction (tout ou rien). */
export function deleteList(id: string): void {
  if (!findList(id)) throw new Error('Liste introuvable');
  const now = nowISO();
  db.transaction((tx) => {
    tx.update(shoppingItems)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(shoppingItems.listId, id), isNull(shoppingItems.deletedAt)))
      .run();
    tx.update(shoppingLists).set({ deletedAt: now, updatedAt: now }).where(eq(shoppingLists.id, id)).run();
  });
}

/** Ajoute un article à la fin de la liste et renvoie son identifiant. */
export function addItem(listId: string, input: ShoppingItemInput): string {
  const name = assertItemInput(input);
  if (!findList(listId)) throw new Error('Liste introuvable');
  const id = newId();
  const now = nowISO();
  db.transaction((tx) => {
    const last = tx
      .select({ value: max(shoppingItems.sortOrder) })
      .from(shoppingItems)
      .where(eq(shoppingItems.listId, listId))
      .get();
    tx.insert(shoppingItems)
      .values({
        id,
        userId: LOCAL_USER_ID,
        listId,
        name,
        quantityMilli: input.quantityMilli,
        unit: input.unit,
        unitPriceCents: input.unitPriceCents,
        sortOrder: (last?.value ?? 0) + 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.update(shoppingLists).set({ updatedAt: now }).where(eq(shoppingLists.id, listId)).run();
  });
  return id;
}

/** Modifie le contenu d'un article ; son état coché et sa place dans la liste ne changent pas. */
export function updateItem(id: string, input: ShoppingItemInput): void {
  const name = assertItemInput(input);
  if (!findItem(id)) throw new Error('Article introuvable');
  db.update(shoppingItems)
    .set({ name, quantityMilli: input.quantityMilli, unit: input.unit, unitPriceCents: input.unitPriceCents, updatedAt: nowISO() })
    .where(eq(shoppingItems.id, id))
    .run();
}

/**
 * Coche ou décoche (valeur explicite, pas une bascule : deux touchers rapides ne s'annulent pas). Cocher mémorise l'instant,
 * pour ranger les articles déjà pris du plus récent au plus ancien ; décocher l'efface. Sans effet si l'état est déjà le bon.
 */
export function setItemChecked(id: string, checked: boolean): void {
  const item = findItem(id);
  if (!item) throw new Error('Article introuvable');
  if (item.checked === checked) return;
  const now = nowISO();
  db.update(shoppingItems)
    .set({ checked, checkedAt: checked ? now : null, updatedAt: now })
    .where(eq(shoppingItems.id, id))
    .run();
}

export function deleteItem(id: string): void {
  if (!findItem(id)) throw new Error('Article introuvable');
  const now = nowISO();
  db.update(shoppingItems).set({ deletedAt: now, updatedAt: now }).where(eq(shoppingItems.id, id)).run();
}

/** Annule une suppression d'article (bouton « Annuler » de la notification), à condition que sa liste existe encore. */
export function restoreItem(id: string): void {
  const row = db.select().from(shoppingItems).where(eq(shoppingItems.id, id)).get();
  if (!row?.deletedAt) return;
  if (!findList(row.listId)) throw new Error('Liste introuvable');
  db.update(shoppingItems).set({ deletedAt: null, updatedAt: nowISO() }).where(eq(shoppingItems.id, id)).run();
}
