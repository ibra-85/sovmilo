import type { TransactionLike } from './budget';
import { computeWeeklyExpenses, currentWeekIndex, weekRanges } from './weekly';

const tx = (type: TransactionLike['type'], amountCents: number, occurredOn: string): TransactionLike => ({
  type,
  amountCents,
  occurredOn,
});

describe('weekRanges', () => {
  it('découpe en 1–7, 8–14, 15–21 puis 22 à la fin du mois', () => {
    expect(weekRanges('2026-10').map((w) => [w.startDay, w.endDay])).toEqual([
      [1, 7],
      [8, 14],
      [15, 21],
      [22, 31],
    ]);
  });

  it('suit la longueur du mois, février bissextile compris', () => {
    expect(weekRanges('2026-02')[3].endDay).toBe(28);
    expect(weekRanges('2028-02')[3].endDay).toBe(29);
    expect(weekRanges('2026-04')[3].endDay).toBe(30);
  });
});

describe('computeWeeklyExpenses', () => {
  it('vaut 0 partout sans opération', () => {
    expect(computeWeeklyExpenses([], '2026-10').map((w) => w.expenseCents)).toEqual([0, 0, 0, 0]);
  });

  it('range chaque dépense dans sa tranche, bornes comprises', () => {
    const weeks = computeWeeklyExpenses(
      [
        tx('expense', 100, '2026-10-01'),
        tx('expense', 200, '2026-10-07'),
        tx('expense', 400, '2026-10-08'),
        tx('expense', 800, '2026-10-21'),
        tx('expense', 1600, '2026-10-22'),
        tx('expense', 3200, '2026-10-31'),
      ],
      '2026-10',
    );
    expect(weeks.map((w) => w.expenseCents)).toEqual([300, 400, 800, 4800]);
  });

  it('ignore revenus, virements vers l’épargne et autres mois', () => {
    const weeks = computeWeeklyExpenses(
      [
        tx('income', 5000, '2026-10-02'),
        tx('transfer', 700, '2026-10-02'),
        tx('expense', 900, '2026-09-30'),
        tx('expense', 50, '2026-10-02'),
      ],
      '2026-10',
    );
    expect(weeks.map((w) => w.expenseCents)).toEqual([50, 0, 0, 0]);
  });

  it('refuse un montant invalide et un mois invalide', () => {
    expect(() => computeWeeklyExpenses([tx('expense', 0, '2026-10-02')], '2026-10')).toThrow(RangeError);
    expect(() => computeWeeklyExpenses([], '2026-13')).toThrow(RangeError);
  });
});

describe('currentWeekIndex', () => {
  it.each([
    ['2026-10-01', 0],
    ['2026-10-07', 0],
    ['2026-10-08', 1],
    ['2026-10-21', 2],
    ['2026-10-31', 3],
  ])('%s → tranche %i', (today, index) => {
    expect(currentWeekIndex(today, '2026-10')).toBe(index);
  });

  it('renvoie null hors du mois affiché', () => {
    expect(currentWeekIndex('2026-11-02', '2026-10')).toBeNull();
  });
});
