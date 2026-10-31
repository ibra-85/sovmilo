import { evaluateCategoryDeletion, evaluateReassignmentTarget, isCustomCategory } from './category-usage';

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

  it('demande une réaffectation quand la catégorie a des opérations', () => {
    const usage = { transactions: 3, budgets: 0 };
    expect(evaluateCategoryDeletion(custom, usage)).toEqual({ allowed: false, reason: 'in-use', usage });
  });

  it('demande une réaffectation quand la catégorie a un budget', () => {
    const usage = { transactions: 0, budgets: 1 };
    expect(evaluateCategoryDeletion(custom, usage)).toEqual({ allowed: false, reason: 'in-use', usage });
  });

  it('demande une réaffectation quand les deux dépendances existent', () => {
    const result = evaluateCategoryDeletion(custom, { transactions: 2, budgets: 1 });
    expect(result.allowed).toBe(false);
  });
});

describe('evaluateReassignmentTarget', () => {
  const source = { id: 'a', kind: 'expense' };
  const target = { id: 'b', kind: 'expense', archived: false, deletedAt: null };

  it('accepte une autre catégorie active du même type', () => {
    expect(evaluateReassignmentTarget(source, target)).toBeNull();
  });

  it('refuse la catégorie supprimée elle-même', () => {
    expect(evaluateReassignmentTarget(source, { ...target, id: 'a' })).toBe('same');
  });

  it('refuse un autre type (dépense vers revenu)', () => {
    expect(evaluateReassignmentTarget(source, { ...target, kind: 'income' })).toBe('kind');
  });

  it('refuse une catégorie archivée ou supprimée', () => {
    expect(evaluateReassignmentTarget(source, { ...target, archived: true })).toBe('unavailable');
    expect(evaluateReassignmentTarget(source, { ...target, deletedAt: '2026-10-31T10:00:00.000Z' })).toBe('unavailable');
  });
});
