import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { BILL_RECURRENCES } from '@/domain/bills';
import { MOVEMENT_KINDS } from '@/domain/savings';
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

/**
 * Factures : la DÉFINITION d'une dépense à payer (nom, montant prévu, récurrence). Ses échéances sont dans `bill_occurrences`.
 * Rien ici ne touche à `transactions`, aux budgets ni au solde : payer une facture est un suivi déclaré, pas une opération.
 */
export const bills = sqliteTable(
  'bills',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    /** Montant prévu en centimes pour les prochaines échéances ; NULL = à renseigner (jamais 0). */
    expectedAmountCents: integer('expected_amount_cents'),
    recurrence: text('recurrence', { enum: BILL_RECURRENCES }).notNull().default('none'),
    /** Date `YYYY-MM-DD` de départ de la série (première échéance) : le jour d'origine (31…) vient d'ici, jamais de l'échéance précédente. */
    anchorDate: text('anchor_date').notNull(),
    /** Récurrence arrêtée : dernier jour (`YYYY-MM-DD`) où une échéance peut exister. NULL = la série continue. */
    stoppedOn: text('stopped_on'),
    note: text('note'),
    ...timestamps,
  },
  (table) => [
    check('bills_expected_amount_positive', sql`${table.expectedAmountCents} IS NULL OR ${table.expectedAmountCents} > 0`),
    check('bills_recurrence_known', sql`${table.recurrence} IN ('none', 'monthly', 'yearly')`),
  ],
);

/**
 * Échéances individuelles d'une facture, chacune avec son propre état. Le paiement déclaré (`paid_on`, `paid_amount_cents`) est
 * porté par l'échéance : un paiement est donc relié à UNE seule échéance, par construction. Le montant prévu est copié ici à
 * la création : changer le montant de la facture ne réécrit jamais une échéance déjà payée.
 */
export const billOccurrences = sqliteTable(
  'bill_occurrences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    billId: text('bill_id')
      .notNull()
      .references(() => bills.id),
    /** Échéance civile `YYYY-MM-DD` (pas d'heure, pas de fuseau). */
    dueOn: text('due_on').notNull(),
    amountCents: integer('amount_cents'),
    /** Date de paiement déclarée ; NULL = pas payée. */
    paidOn: text('paid_on'),
    /** Montant réellement payé ; NULL = non noté. Seulement si l'échéance est payée. */
    paidAmountCents: integer('paid_amount_cents'),
    ...timestamps,
  },
  (table) => [
    check('bill_occurrences_amount_positive', sql`${table.amountCents} IS NULL OR ${table.amountCents} > 0`),
    check('bill_occurrences_paid_amount_positive', sql`${table.paidAmountCents} IS NULL OR ${table.paidAmountCents} > 0`),
    check('bill_occurrences_paid_amount_needs_payment', sql`${table.paidAmountCents} IS NULL OR ${table.paidOn} IS NOT NULL`),
    // Jamais deux échéances à la même date pour une facture : c'est ce qui rend la génération idempotente (pas de doublon au redémarrage).
    uniqueIndex('bill_occurrences_bill_due_idx').on(table.billId, table.dueOn),
    index('bill_occurrences_due_idx').on(table.dueOn),
  ],
);

/**
 * Objectifs d'épargne. L'épargne est DÉCLARATIVE : rien ici ne touche à `transactions`, aux budgets, aux factures ni au solde.
 * Le montant épargné n'est pas stocké : c'est la somme des mouvements actifs (`savings_movements`).
 */
export const savingsGoals = sqliteTable(
  'savings_goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    /** Montant cible en centimes, strictement positif. Le modifier ne touche jamais aux mouvements. */
    targetCents: integer('target_cents').notNull(),
    /** Emoji (ou identifiant `icon:…` du catalogue), comme les catégories personnalisées. */
    icon: text('icon').notNull().default('🎯'),
    /** Date cible INDICATIVE `YYYY-MM-DD` (aucun versement automatique, aucune échéance). */
    targetDate: text('target_date'),
    note: text('note'),
    /** Position d'affichage parmi les objectifs actifs ; réécrite seulement quand l'utilisatrice réorganise. */
    sortOrder: integer('sort_order').notNull().default(0),
    /** Archivé : masqué de la liste, historique conservé, restaurable. NULL = actif. */
    archivedAt: text('archived_at'),
    ...timestamps,
  },
  (table) => [
    check('savings_goals_target_positive', sql`${table.targetCents} > 0`),
    index('savings_goals_order_idx').on(table.archivedAt, table.sortOrder),
  ],
);

/** Versements et retraits déclarés d'un objectif. Annuler un mouvement le supprime LOGIQUEMENT (`deleted_at`) : rien n'est effacé. */
export const savingsMovements = sqliteTable(
  'savings_movements',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    goalId: text('goal_id')
      .notNull()
      .references(() => savingsGoals.id),
    kind: text('kind', { enum: MOVEMENT_KINDS }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    /** Date civile `YYYY-MM-DD` du mouvement (pas d'heure, pas de fuseau). */
    occurredOn: text('occurred_on').notNull(),
    note: text('note'),
    ...timestamps,
  },
  (table) => [
    check('savings_movements_amount_positive', sql`${table.amountCents} > 0`),
    check('savings_movements_kind_known', sql`${table.kind} IN ('deposit', 'withdrawal')`),
    index('savings_movements_goal_idx').on(table.goalId, table.occurredOn),
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
export type Bill = typeof bills.$inferSelect;
export type BillOccurrence = typeof billOccurrences.$inferSelect;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type SavingsMovement = typeof savingsMovements.$inferSelect;
