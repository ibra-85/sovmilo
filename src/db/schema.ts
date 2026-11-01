import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { SHOPPING_UNITS } from '@/domain/shopping';
import { APP_LOCALES, CATEGORY_KINDS, DEFAULT_CURRENCY, PAYMENT_METHODS, TRANSACTION_TYPES } from '@/domain/types';

/*
 * Schéma local (SQLite). Il reflétera plus tard les tables Supabase.
 * Conventions :
 *  - identifiants = UUID générés côté appareil (création possible hors ligne) ;
 *  - montants = centimes, entiers ;
 *  - dates = texte ISO : `occurred_on` en `YYYY-MM-DD`, `*_at` en UTC (`2026-03-17T09:30:00.000Z`),
 *    ce format se trie correctement comme du texte, ce qui servira à la synchronisation (« dernier updated_at gagne ») ;
 *  - suppression logique : `deleted_at` rempli au lieu d'effacer la ligne (nécessaire pour synchroniser les suppressions).
 */

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(), // = identifiant du compte Supabase une fois connecté
  displayName: text('display_name'),
  locale: text('locale', { enum: APP_LOCALES }).notNull().default('fr'),
  currency: text('currency').notNull().default(DEFAULT_CURRENCY),
  householdId: text('household_id'), // réservé au futur budget partagé
  ...timestamps,
});

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
    /** Clé de traduction d'une catégorie par défaut (ex. `categories.groceries`)… */
    nameKey: text('name_key'),
    /** …ou nom saisi par l'utilisatrice pour une catégorie personnalisée. L'un des deux est obligatoire. */
    customName: text('custom_name'),
    icon: text('icon').notNull(), // emoji
    color: text('color').notNull(), // #RRGGBB
    sortOrder: integer('sort_order').notNull().default(0),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    check('categories_has_name', sql`${table.nameKey} IS NOT NULL OR ${table.customName} IS NOT NULL`),
    index('categories_kind_idx').on(table.kind, table.sortOrder),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    /** Optionnelle : un virement vers l'épargne n'a pas de catégorie. */
    categoryId: text('category_id').references(() => categories.id),
    paymentMethod: text('payment_method', { enum: PAYMENT_METHODS }).notNull().default('card'),
    occurredOn: text('occurred_on').notNull(),
    note: text('note'),
    receiptId: text('receipt_id'), // futur scan de tickets
    ...timestamps,
  },
  (table) => [
    check('transactions_amount_positive', sql`${table.amountCents} > 0`),
    index('transactions_occurred_on_idx').on(table.occurredOn),
    index('transactions_category_idx').on(table.categoryId),
  ],
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    month: text('month').notNull(), // YYYY-MM
    amountCents: integer('amount_cents').notNull(),
    ...timestamps,
  },
  (table) => [
    check('budgets_amount_positive', sql`${table.amountCents} > 0`),
    // Une seule ligne par catégorie et par mois. Une suppression garde la ligne (`deleted_at`) : elle sert de
    // « pierre tombale » (plus de plafond à partir de ce mois), et la ressaisir ranime la même ligne.
    uniqueIndex('budgets_user_category_month_idx').on(table.userId, table.categoryId, table.month),
  ],
);

/** Solde réel saisi par l'utilisatrice d'après sa banque. Distinct du solde calculé à partir des opérations. */
export const accountSnapshots = sqliteTable(
  'account_snapshots',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** Peut être négatif (compte à découvert) : pas de contrainte « > 0 » ici, contrairement aux autres montants. */
    realBalanceCents: integer('real_balance_cents').notNull(),
    recordedAt: text('recorded_at').notNull(), // horodatage UTC ISO de la saisie
    ...timestamps,
  },
  (table) => [index('account_snapshots_recorded_at_idx').on(table.recordedAt)],
);

/**
 * Listes de courses. Locales pour l'instant (pas de synchronisation). Les prix sont des ESTIMATIONS : ils n'ont aucun lien
 * avec `transactions` ni avec les budgets.
 */
export const shoppingLists = sqliteTable('shopping_lists', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  ...timestamps,
});

export const shoppingItems = sqliteTable(
  'shopping_items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    listId: text('list_id')
      .notNull()
      .references(() => shoppingLists.id),
    name: text('name').notNull(),
    /** Quantité en millièmes d'unité (1,5 kg → 1500) : un entier, jamais un flottant. */
    quantityMilli: integer('quantity_milli').notNull().default(1000),
    unit: text('unit', { enum: SHOPPING_UNITS }).notNull().default('piece'),
    /** Prix unitaire estimé en centimes (au kg pour des grammes, au litre pour des millilitres) ; NULL = pas de prix. */
    unitPriceCents: integer('unit_price_cents'),
    checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
    checkedAt: text('checked_at'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check('shopping_items_quantity_positive', sql`${table.quantityMilli} > 0`),
    check('shopping_items_price_positive', sql`${table.unitPriceCents} IS NULL OR ${table.unitPriceCents} > 0`),
    index('shopping_items_list_idx').on(table.listId, table.sortOrder),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type AccountSnapshot = typeof accountSnapshots.$inferSelect;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
