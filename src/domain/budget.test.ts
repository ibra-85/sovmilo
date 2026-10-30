import { computeMonthTotals, type TransactionLike } from './budget';

const tx = (type: TransactionLike['type'], amountCents: number, occurredOn: string): TransactionLike => ({
  type,
  amountCents,
  occurredOn,
});

describe('computeMonthTotals', () => {
  it('vaut 0 partout sans opération', () => {
    expect(computeMonthTotals([], '2026-03')).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      savingsCents: 0,
      remainingCents: 0,
      operationCount: 0,
    });
  });

  it('calcule reste = revenus − dépenses − épargne', () => {
    const totals = computeMonthTotals(
      [
        tx('income', 200_000, '2026-03-01'),
        tx('expense', 45_050, '2026-03-05'),
        tx('expense', 1_999, '2026-03-17'),
        tx('transfer', 30_000, '2026-03-20'),
      ],
      '2026-03',
    );
    expect(totals.incomeCents).toBe(200_000);
    expect(totals.expenseCents).toBe(47_049);
    expect(totals.savingsCents).toBe(30_000);
    expect(totals.remainingCents).toBe(200_000 - 47_049 - 30_000);
    expect(totals.operationCount).toBe(4);
  });

  it('exclut les transferts vers l’épargne des dépenses, mais les retire du reste à dépenser', () => {
    const totals = computeMonthTotals([tx('income', 100_000, '2026-03-01'), tx('transfer', 20_000, '2026-03-02')], '2026-03');
    expect(totals.expenseCents).toBe(0);
    expect(totals.remainingCents).toBe(80_000);
  });

  it('ignore les opérations des autres mois, y compris aux bornes', () => {
    const totals = computeMonthTotals(
      [
        tx('expense', 1_000, '2026-02-28'),
        tx('expense', 2_000, '2026-03-01'),
        tx('expense', 4_000, '2026-03-31'),
        tx('expense', 8_000, '2026-04-01'),
        tx('expense', 16_000, '2025-03-15'), // même mois, autre année
      ],
      '2026-03',
    );
    expect(totals.expenseCents).toBe(6_000);
    expect(totals.operationCount).toBe(2);
  });

  it('autorise un reste négatif quand on dépense plus que ce qu’on reçoit', () => {
    const totals = computeMonthTotals([tx('income', 10_000, '2026-03-01'), tx('expense', 25_000, '2026-03-02')], '2026-03');
    expect(totals.remainingCents).toBe(-15_000);
  });

  it('additionne exactement de grands montants', () => {
    const totals = computeMonthTotals(
      [tx('income', 99_999_999_999, '2026-03-01'), tx('expense', 99_999_999_998, '2026-03-02')],
      '2026-03',
    );
    expect(totals.remainingCents).toBe(1);
  });

  it('additionne exactement des centimes qui feraient des erreurs en flottant', () => {
    const totals = computeMonthTotals(
      [tx('expense', 10, '2026-03-01'), tx('expense', 20, '2026-03-02')], // 0,1 + 0,2 = 0,30000000000000004 en flottant
      '2026-03',
    );
    expect(totals.expenseCents).toBe(30);
  });

  it('refuse un mois mal formé', () => {
    expect(() => computeMonthTotals([], '2026-3')).toThrow(RangeError);
    expect(() => computeMonthTotals([], '2026-13')).toThrow(RangeError);
    expect(() => computeMonthTotals([], '')).toThrow(RangeError);
  });

  it.each([0, -100, 12.5, Number.NaN])('refuse un montant invalide (%p)', (amountCents) => {
    expect(() => computeMonthTotals([tx('expense', amountCents, '2026-03-01')], '2026-03')).toThrow(RangeError);
  });
});
