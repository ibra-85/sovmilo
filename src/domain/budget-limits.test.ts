import {
  budgetStatus,
  buildBudgetProgress,
  computeCategorySpending,
  resolveBudgetLimits,
  type BudgetRow,
  type CategorizedTransactionLike,
} from './budget';

const row = (categoryId: string, month: string, amountCents: number, deleted = false): BudgetRow => ({
  categoryId,
  month,
  amountCents,
  deleted,
});

const spend = (
  categoryId: string | null,
  amountCents: number,
  occurredOn = '2026-03-10',
  type: CategorizedTransactionLike['type'] = 'expense',
): CategorizedTransactionLike => ({ type, amountCents, categoryId, occurredOn });

describe('resolveBudgetLimits', () => {
  it('renvoie le plafond du mois demandé', () => {
    expect(resolveBudgetLimits([row('a', '2026-03', 30_000)], '2026-03').get('a')).toBe(30_000);
  });

  it('reconduit un plafond sur les mois suivants', () => {
    expect(resolveBudgetLimits([row('a', '2026-01', 30_000)], '2026-06').get('a')).toBe(30_000);
  });

  it('n’applique pas un plafond aux mois précédents', () => {
    expect(resolveBudgetLimits([row('a', '2026-03', 30_000)], '2026-02').has('a')).toBe(false);
  });

  it('un plafond plus récent remplace l’ancien à partir de son mois', () => {
    const rows = [row('a', '2026-01', 30_000), row('a', '2026-04', 40_000)];
    expect(resolveBudgetLimits(rows, '2026-03').get('a')).toBe(30_000);
    expect(resolveBudgetLimits(rows, '2026-04').get('a')).toBe(40_000);
    expect(resolveBudgetLimits(rows, '2026-12').get('a')).toBe(40_000);
  });

  it('ne dépend pas de l’ordre des lignes', () => {
    const rows = [row('a', '2026-04', 40_000), row('a', '2026-01', 30_000)];
    expect(resolveBudgetLimits(rows, '2026-05').get('a')).toBe(40_000);
  });

  it('une suppression retire le plafond de ce mois en avant, sans toucher au passé', () => {
    const rows = [row('a', '2026-01', 30_000), row('a', '2026-04', 30_000, true)];
    expect(resolveBudgetLimits(rows, '2026-03').get('a')).toBe(30_000);
    expect(resolveBudgetLimits(rows, '2026-04').has('a')).toBe(false);
    expect(resolveBudgetLimits(rows, '2026-09').has('a')).toBe(false);
  });

  it('un plafond ressaisi après suppression redevient actif', () => {
    const rows = [row('a', '2026-01', 30_000), row('a', '2026-04', 30_000, true), row('a', '2026-06', 25_000)];
    expect(resolveBudgetLimits(rows, '2026-05').has('a')).toBe(false);
    expect(resolveBudgetLimits(rows, '2026-06').get('a')).toBe(25_000);
  });

  it('traite chaque catégorie séparément', () => {
    const limits = resolveBudgetLimits([row('a', '2026-03', 100), row('b', '2026-03', 200)], '2026-03');
    expect([...limits]).toEqual([
      ['a', 100],
      ['b', 200],
    ]);
  });

  it('refuse un mois ou un plafond invalide', () => {
    expect(() => resolveBudgetLimits([], '2026-13')).toThrow(RangeError);
    expect(() => resolveBudgetLimits([row('a', '2026-03', 0)], '2026-03')).toThrow(RangeError);
  });
});

describe('computeCategorySpending', () => {
  it('additionne les dépenses du mois par catégorie', () => {
    const spending = computeCategorySpending([spend('a', 1_000), spend('a', 550), spend('b', 200)], '2026-03');
    expect(spending.get('a')).toBe(1_550);
    expect(spending.get('b')).toBe(200);
  });

  it('ignore les revenus, les virements vers l’épargne et les opérations sans catégorie', () => {
    const spending = computeCategorySpending(
      [spend('a', 5_000, '2026-03-10', 'income'), spend('a', 5_000, '2026-03-10', 'transfer'), spend(null, 5_000)],
      '2026-03',
    );
    expect(spending.size).toBe(0);
  });

  it('ignore les autres mois, y compris celui qui commence par les mêmes chiffres', () => {
    const spending = computeCategorySpending([spend('a', 1, '2026-02-28'), spend('a', 1, '2026-04-01'), spend('a', 7, '2026-03-31')], '2026-03');
    expect(spending.get('a')).toBe(7);
  });

  it('refuse un montant invalide', () => {
    expect(() => computeCategorySpending([spend('a', -5)], '2026-03')).toThrow(RangeError);
  });
});

describe('budgetStatus', () => {
  it.each([
    [0, 'ok'],
    [8_000, 'ok'], // pile 80 % : pas encore une alerte
    [8_001, 'warning'],
    [9_999, 'warning'],
    [10_000, 'warning'], // pile 100 % : plafond atteint, pas dépassé
    [10_001, 'over'],
    [50_000, 'over'],
  ])('%i sur un plafond de 10 000 → %s', (spent, expected) => {
    expect(budgetStatus(spent, 10_000)).toBe(expected);
  });

  it('reste exact sur de grands montants', () => {
    expect(budgetStatus(79_999_999_999, 99_999_999_999)).toBe('ok');
    expect(budgetStatus(80_000_000_000, 99_999_999_999)).toBe('warning');
  });
});

describe('buildBudgetProgress', () => {
  const limits = new Map([['a', 20_000]]);
  const spending = new Map([
    ['a', 16_500],
    ['b', 900],
  ]);
  const progress = buildBudgetProgress(['b', 'a', 'c'], limits, spending);

  it('garde l’ordre demandé', () => {
    expect(progress.map((p) => p.categoryId)).toEqual(['b', 'a', 'c']);
  });

  it('calcule reste, pourcentage et état pour une catégorie avec plafond', () => {
    expect(progress[1]).toEqual({
      categoryId: 'a',
      limitCents: 20_000,
      spentCents: 16_500,
      remainingCents: 3_500,
      percent: 82, // 82,5 % arrondi vers le bas
      status: 'warning',
    });
  });

  it('signale un dépassement par un reste négatif et un pourcentage > 100', () => {
    const [over] = buildBudgetProgress(['a'], limits, new Map([['a', 25_000]]));
    expect(over.remainingCents).toBe(-5_000);
    expect(over.percent).toBe(125);
    expect(over.status).toBe('over');
  });

  it('une catégorie sans plafond garde sa dépense mais n’a ni état ni pourcentage', () => {
    expect(progress[0]).toEqual({ categoryId: 'b', limitCents: null, spentCents: 900, remainingCents: null, percent: null, status: null });
    expect(progress[2].spentCents).toBe(0);
  });
});
