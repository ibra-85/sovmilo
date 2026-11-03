import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from '@/db/schema';
import { asExpoClient } from '@/db/test-support';
import { seedDefaultCategories } from '@/db/seed';

import type { NodeConnection } from './test-support';

/**
 * Données représentatives pour les TESTS : tous les modules, y compris les cas qui piègent une sauvegarde (accents, apostrophes,
 * cyrillique, montants très grands, solde négatif, objectifs archivés, ordre personnalisé, échéances payées et impayées).
 * Les écritures passent par les VRAIS dépôts de l'application, branchés sur la base donnée.
 */

type Repositories = {
  transactions: typeof import('@/features/transactions/repository');
  categories: typeof import('@/features/categories/repository');
  budgets: typeof import('@/features/budgets/repository');
  balance: typeof import('@/features/balance/repository');
  shopping: typeof import('@/features/shopping/repository');
  bills: typeof import('@/features/bills/repository');
  savings: typeof import('@/features/savings/repository');
};

export function loadRepositories(connection: NodeConnection): { repositories: Repositories; db: ReturnType<typeof drizzle<typeof schema>> } {
  const db = drizzle(asExpoClient(connection.sqlite) as never, { schema });
  let repositories: Repositories | undefined;
  jest.isolateModules(() => {
    jest.doMock('@/db/client', () => ({ db }));
    /* eslint-disable @typescript-eslint/no-require-imports */
    repositories = {
      transactions: require('@/features/transactions/repository'),
      categories: require('@/features/categories/repository'),
      budgets: require('@/features/budgets/repository'),
      balance: require('@/features/balance/repository'),
      shopping: require('@/features/shopping/repository'),
      bills: require('@/features/bills/repository'),
      savings: require('@/features/savings/repository'),
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  if (!repositories) throw new Error('Dépôts non chargés');
  return { repositories, db };
}

export const TODAY = '2026-11-02';

export function populate(connection: NodeConnection): void {
  const { repositories: r, db } = loadRepositories(connection);
  seedDefaultCategories(db);
  const expense = db.select().from(schema.categories).all().filter((category) => category.kind === 'expense');
  const income = db.select().from(schema.categories).all().find((category) => category.kind === 'income');
  if (!income || expense.length < 4) throw new Error('Catégories par défaut absentes');
  const custom = r.categories.createCategory({ kind: 'expense', name: 'Chat — croquettes', icon: '🐱' });

  const add = (type: 'expense' | 'income' | 'transfer', amountCents: number, categoryId: string | null, occurredOn: string, note: string | null, paymentMethod: 'card' | 'cash' | 'transfer' | 'other' = 'card') =>
    r.transactions.addTransaction({ type, amountCents, categoryId, occurredOn, note, paymentMethod });
  add('expense', 1249, expense[0].id, '2026-11-01', "Courses d'automne");
  add('expense', 5, expense[0].id, '2026-11-01', null, 'cash');
  add('expense', 99_999_999, expense[1].id, '2026-10-15', 'Продукты и «кафе»');
  add('expense', 4510, custom, '2026-11-02', 'Vétérinaire — café ☕');
  add('expense', 12_000, expense[2].id, '2026-10-31', null, 'transfer');
  add('income', 215_000, income.id, '2026-11-01', 'Salaire');
  add('income', 31_050, income.id, '2026-10-01', 'CAF', 'transfer');
  add('transfer', 20_000, null, '2026-11-02', 'Vers le livret');
  add('expense', 899, expense[3].id, '2026-09-30', 'Mois précédent', 'other');

  r.budgets.setBudget(expense[0].id, '2026-10', 40_000);
  r.budgets.setBudget(expense[0].id, '2026-11', 45_000);
  r.budgets.setBudget(expense[1].id, '2026-11', 15_050);
  r.budgets.setBudget(custom, '2026-11', 8_000);

  r.balance.addAccountSnapshot(-12_345);
  r.balance.addAccountSnapshot(250_000);

  const market = r.shopping.createList('Marché');
  const pharmacy = r.shopping.createList('Аптека');
  r.shopping.addItem(market, { name: 'Pommes', quantityMilli: 1500, unit: 'kg', unitPriceCents: 289 });
  const bread = r.shopping.addItem(market, { name: "Pain d'épeautre", quantityMilli: 2000, unit: 'piece', unitPriceCents: null });
  r.shopping.addItem(pharmacy, { name: 'Витамины', quantityMilli: 1000, unit: 'pack', unitPriceCents: 1290 });
  r.shopping.setItemChecked(bread, true);

  const rent = r.bills.createBill({ name: 'Loyer', expectedAmountCents: 72_000, recurrence: 'monthly', nextDueOn: '2026-11-05', note: null }, TODAY);
  r.bills.createBill({ name: 'Assurance habitation', expectedAmountCents: 18_900, recurrence: 'yearly', nextDueOn: '2026-12-20', note: 'Contrat 12' }, TODAY);
  r.bills.createBill({ name: 'Réparation', expectedAmountCents: null, recurrence: 'none', nextDueOn: '2026-11-20', note: null }, TODAY);
  r.bills.markPaid(rent.occurrenceId, { paidOn: '2026-11-02', amountCents: 72_000 }, TODAY);
  r.bills.ensureOccurrences(TODAY, '2027-01');

  const holidays = r.savings.createGoal({ name: 'Vacances', targetCents: 200_000, icon: '🏖️', targetDate: '2027-07-01', note: 'Été' }, TODAY);
  const car = r.savings.createGoal({ name: 'Voiture', targetCents: 1_000_000, icon: '🚗', targetDate: null, note: null }, TODAY);
  const old = r.savings.createGoal({ name: 'Ancien projet', targetCents: 50_000, icon: '🎯', targetDate: null, note: null }, TODAY);
  r.savings.addMovement(holidays, { kind: 'deposit', amountCents: 50_000, occurredOn: '2026-10-10', note: null }, TODAY);
  r.savings.addMovement(holidays, { kind: 'withdrawal', amountCents: 5_000, occurredOn: '2026-10-20', note: 'Acompte' }, TODAY);
  r.savings.addMovement(car, { kind: 'deposit', amountCents: 125_000, occurredOn: '2026-11-01', note: null }, TODAY);
  r.savings.addMovement(old, { kind: 'deposit', amountCents: 50_000, occurredOn: '2026-09-01', note: null }, TODAY);
  r.savings.archiveGoal(old);
  r.savings.reorderGoals([car, holidays]);
}
