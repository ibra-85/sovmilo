import { estimateBalance, snapshotDay } from './balance';
import type { TransactionLike } from './budget';

const tx = (type: TransactionLike['type'], amountCents: number, occurredOn: string): TransactionLike => ({
  type,
  amountCents,
  occurredOn,
});

// Construit l'horodatage depuis des composantes LOCALES : le test ne dépend pas du fuseau horaire de la machine.
const recordedAt = (y: number, m: number, d: number, hour = 15) => new Date(y, m - 1, d, hour).toISOString();

describe('snapshotDay', () => {
  it('renvoie le jour LOCAL de la saisie, même tard le soir', () => {
    expect(snapshotDay(recordedAt(2026, 3, 10, 23))).toBe('2026-03-10');
    expect(snapshotDay(recordedAt(2026, 3, 10, 0))).toBe('2026-03-10');
  });

  it('refuse un horodatage invalide', () => {
    expect(() => snapshotDay('pas une date')).toThrow(RangeError);
  });
});

describe('estimateBalance', () => {
  const snapshot = { realBalanceCents: 100_000, recordedAt: recordedAt(2026, 3, 10) };

  it('vaut le solde réel sans opération', () => {
    expect(estimateBalance(snapshot, [])).toBe(100_000);
  });

  it('ajoute les revenus et retire dépenses et épargne postérieurs à la saisie', () => {
    const balance = estimateBalance(snapshot, [
      tx('income', 50_000, '2026-03-11'),
      tx('expense', 12_050, '2026-03-12'),
      tx('transfer', 20_000, '2026-03-15'),
    ]);
    expect(balance).toBe(100_000 + 50_000 - 12_050 - 20_000);
  });

  it('ignore les opérations du jour de la saisie et antérieures (déjà dans le solde de la banque)', () => {
    const balance = estimateBalance(snapshot, [
      tx('expense', 5_000, '2026-03-10'),
      tx('expense', 5_000, '2026-03-09'),
      tx('income', 5_000, '2026-01-01'),
    ]);
    expect(balance).toBe(100_000);
  });

  it('accepte un solde réel négatif (découvert)', () => {
    expect(estimateBalance({ ...snapshot, realBalanceCents: -2_550 }, [tx('expense', 1_000, '2026-03-11')])).toBe(-3_550);
  });

  it('reste exact sur de grands montants (entiers)', () => {
    const big = { realBalanceCents: 99_999_999_999, recordedAt: recordedAt(2026, 1, 1) };
    expect(estimateBalance(big, [tx('expense', 1, '2026-01-02')])).toBe(99_999_999_998);
  });

  it('refuse un solde non entier ou un montant d’opération invalide', () => {
    expect(() => estimateBalance({ ...snapshot, realBalanceCents: 10.5 }, [])).toThrow(RangeError);
    expect(() => estimateBalance(snapshot, [tx('expense', 0, '2026-03-11')])).toThrow(RangeError);
  });
});
