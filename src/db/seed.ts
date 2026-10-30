import type { CategoryKind } from '@/domain/types';

import type { AppDb } from './client';
import { LOCAL_USER_ID, newId, nowISO } from './ids';
import { categories, type NewCategory } from './schema';

interface DefaultCategory {
  kind: CategoryKind;
  /** Clé de traduction : le nom affiché suit la langue choisie (fr / ru). */
  nameKey: string;
  icon: string;
  color: string;
}

// L'ordre de cette liste est l'ordre d'affichage dans la grille.
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { kind: 'expense', nameKey: 'categories.groceries', icon: '🛒', color: '#6BA37A' },
  { kind: 'expense', nameKey: 'categories.housing', icon: '🏠', color: '#8C7AB5' },
  { kind: 'expense', nameKey: 'categories.energy', icon: '💡', color: '#E0A83E' },
  { kind: 'expense', nameKey: 'categories.transport', icon: '🚌', color: '#5A93C4' },
  { kind: 'expense', nameKey: 'categories.health', icon: '💊', color: '#D9707A' },
  { kind: 'expense', nameKey: 'categories.children', icon: '🧒', color: '#E59A5C' },
  { kind: 'expense', nameKey: 'categories.leisure', icon: '🎭', color: '#B07CC2' },
  { kind: 'expense', nameKey: 'categories.clothing', icon: '👕', color: '#4FA8A0' },
  { kind: 'expense', nameKey: 'categories.phoneInternet', icon: '📱', color: '#6F86C9' },
  { kind: 'expense', nameKey: 'categories.misc', icon: '📦', color: '#9A9684' },
  { kind: 'income', nameKey: 'categories.salary', icon: '💼', color: '#6BA37A' },
  { kind: 'income', nameKey: 'categories.benefits', icon: '🤝', color: '#5A93C4' },
  { kind: 'income', nameKey: 'categories.pension', icon: '🏦', color: '#B07CC2' },
  { kind: 'income', nameKey: 'categories.otherIncome', icon: '✨', color: '#9A9684' },
];

/**
 * Crée les catégories par défaut au tout premier lancement (table vide).
 * Idempotent : si des catégories existent déjà (même archivées ou supprimées), on ne touche à rien,
 * pour ne jamais recréer une catégorie que l'utilisatrice a retirée.
 */
export function seedDefaultCategories(db: AppDb): void {
  db.transaction((tx) => {
    const existing = tx.select({ id: categories.id }).from(categories).limit(1).all();
    if (existing.length > 0) return;

    const now = nowISO();
    const sortCounters: Record<CategoryKind, number> = { expense: 0, income: 0 };
    const rows: NewCategory[] = DEFAULT_CATEGORIES.map((category) => ({
      id: newId(),
      userId: LOCAL_USER_ID,
      kind: category.kind,
      nameKey: category.nameKey,
      icon: category.icon,
      color: category.color,
      sortOrder: sortCounters[category.kind]++,
      createdAt: now,
      updatedAt: now,
    }));
    tx.insert(categories).values(rows).run();
  });
}
