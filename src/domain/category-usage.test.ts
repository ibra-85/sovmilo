import { evaluateCategoryDeletion, isCustomCategory } from './category-usage';

const system = { nameKey: 'categories.groceries', customName: null };
const custom = { nameKey: null, customName: 'Animaux' };
const none = { transactions: 0, budgets: 0 };

describe('isCustomCategory', () => {
  it('distingue catégories système et personnalisées', () => {
    expect(isCustomCategory(system)).toBe(false);
    expect(isCustomCategory(custom)).toBe(true);
  });
});

describe('evaluateCategoryDeletion', () => {
  it('autorise la suppression d’une catégorie personnalisée inutilisée', () => {
    expect(evaluateCategoryDeletion(custom, none)).toEqual({ allowed: true });
  });

  it('refuse toujours une catégorie système, même inutilisée', () => {
    expect(evaluateCategoryDeletion(system, none)).toEqual({ allowed: false, reason: 'system' });
  });

  it('refuse une catégorie qui a des opérations, sans rien supprimer', () => {
    const usage = { transactions: 3, budgets: 0 };
    expect(evaluateCategoryDeletion(custom, usage)).toEqual({ allowed: false, reason: 'in-use', usage });
  });

  it('refuse une catégorie qui a un budget', () => {
    const usage = { transactions: 0, budgets: 1 };
    expect(evaluateCategoryDeletion(custom, usage)).toEqual({ allowed: false, reason: 'in-use', usage });
  });

  it('refuse quand les deux dépendances existent', () => {
    const result = evaluateCategoryDeletion(custom, { transactions: 2, budgets: 1 });
    expect(result.allowed).toBe(false);
  });
});
