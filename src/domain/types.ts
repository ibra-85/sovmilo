// Types et constantes métier partagés par le domaine, la base de données et l'interface.
// Une seule source de vérité : le schéma Drizzle réutilise ces listes pour ses colonnes.

export const TRANSACTION_TYPES = ['expense', 'income', 'transfer'] as const;
/** `transfer` = virement vers l'épargne : réduit le « reste à dépenser » sans être une dépense. */
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = ['card', 'cash', 'transfer', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CATEGORY_KINDS = ['expense', 'income'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const APP_LOCALES = ['fr', 'ru'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

/** Étiquette BCP 47 passée à `Intl` pour chaque langue de l'application. */
export const INTL_LOCALES: Record<AppLocale, string> = {
  fr: 'fr-FR',
  ru: 'ru-RU',
};

export const DEFAULT_CURRENCY = 'EUR';
