import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { asc, eq } from 'drizzle-orm';

import { applyMigrations, openTestDatabase } from '@/db/test-support';
import { savingsGoals, savingsMovements } from '@/db/schema';
import { MAX_GOAL_NAME_LENGTH, MAX_SAVINGS_AMOUNT_CENTS, savedCents } from '@/domain/savings';

import type * as RepositoryModule from './repository';

/*
 * VRAIE base SQLite (les vraies migrations, le vrai pilote Drizzle d'Expo) à la place d'`expo-sqlite`, qui est natif. Ces tests
 * prouvent la logique du dépôt et la persistance ; ils ne remplacent pas un essai sur téléphone.
 */

// `require` est voulu ici : la fabrique de `jest.mock` ne peut pas référencer un import ordinaire.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

type Repository = typeof RepositoryModule;
type Database = ReturnType<typeof openTestDatabase>;

/** Charge un exemplaire NEUF du dépôt branché sur la base donnée (équivalent d'un redémarrage de l'application). */
function loadRepository(database: Database): Repository {
  let repository: Repository | undefined;
  jest.isolateModules(() => {
    jest.doMock('@/db/client', () => ({ db: database.db }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    repository = require('./repository') as Repository;
  });
  if (!repository) throw new Error('Dépôt non chargé');
  return repository;
}

const TODAY = '2026-11-01';

const goal = (overrides: Partial<RepositoryModule.GoalInput> = {}): RepositoryModule.GoalInput => ({
  name: 'Vacances',
  targetCents: 200_000,
  icon: '🏖️',
  targetDate: null,
  note: null,
  ...overrides,
});

const deposit = (amountCents: number, occurredOn: string, note: string | null = null): RepositoryModule.MovementInput => ({ kind: 'deposit', amountCents, occurredOn, note });
const withdrawal = (amountCents: number, occurredOn: string, note: string | null = null): RepositoryModule.MovementInput => ({ kind: 'withdrawal', amountCents, occurredOn, note });

describe('objectifs d\'épargne', () => {
  let database: Database;
  let repo: Repository;

  beforeEach(() => {
    database = openTestDatabase();
    repo = loadRepository(database);
  });
  afterEach(() => database.close());

  const goals = () => database.db.select().from(savingsGoals).orderBy(asc(savingsGoals.sortOrder)).all();
  const movements = (goalId?: string) =>
    (goalId ? database.db.select().from(savingsMovements).where(eq(savingsMovements.goalId, goalId)) : database.db.select().from(savingsMovements)).all();
  const active = (goalId: string) => movements(goalId).filter((row) => row.deletedAt === null);
  const saved = (goalId: string) => savedCents(active(goalId));
  const order = () => goals().filter((row) => row.archivedAt === null && row.deletedAt === null).map((row) => row.name);

  describe('création et modification', () => {
    it('crée un objectif à zéro, avec ses valeurs nettoyées', () => {
      const id = repo.createGoal(goal({ name: '  Vacances   été ', note: '  Grèce  ', targetDate: '2027-07-01' }), TODAY);
      expect(goals()).toHaveLength(1);
      expect(goals()[0]).toMatchObject({
        id,
        name: 'Vacances été',
        targetCents: 200_000,
        icon: '🏖️',
        targetDate: '2027-07-01',
        note: 'Grèce',
        sortOrder: 0,
        archivedAt: null,
        deletedAt: null,
        userId: 'local',
      });
      expect(saved(id)).toBe(0);
      expect(movements()).toHaveLength(0);
    });

    it('prend l\'icône par défaut si elle est vide', () => {
      repo.createGoal(goal({ icon: '  ' }), TODAY);
      expect(goals()[0].icon).toBe('🎯');
    });

    it('place chaque nouvel objectif à la fin de la liste', () => {
      repo.createGoal(goal({ name: 'A' }), TODAY);
      repo.createGoal(goal({ name: 'B' }), TODAY);
      repo.createGoal(goal({ name: 'C' }), TODAY);
      expect(order()).toEqual(['A', 'B', 'C']);
      expect(goals().map((row) => row.sortOrder)).toEqual([0, 1, 2]);
    });

    it('refuse un nom vide ou trop long, une cible nulle ou négative, une date passée, une note trop longue', () => {
      const refuse = (input: RepositoryModule.GoalInput) => expect(() => repo.createGoal(input, TODAY)).toThrow(repo.SavingsError);
      refuse(goal({ name: '   ' }));
      refuse(goal({ name: 'a'.repeat(MAX_GOAL_NAME_LENGTH + 1) }));
      refuse(goal({ targetCents: 0 }));
      refuse(goal({ targetCents: -100 }));
      refuse(goal({ targetCents: 10.5 }));
      refuse(goal({ targetCents: MAX_SAVINGS_AMOUNT_CENTS + 1 }));
      refuse(goal({ targetDate: '2026-10-31' }));
      refuse(goal({ targetDate: '2027-02-30' }));
      refuse(goal({ note: 'x'.repeat(201) }));
      expect(goals()).toHaveLength(0);
    });

    it('accepte une cible énorme et des centimes', () => {
      repo.createGoal(goal({ targetCents: MAX_SAVINGS_AMOUNT_CENTS }), TODAY);
      repo.createGoal(goal({ name: 'Centimes', targetCents: 1 }), TODAY);
      expect(goals().map((row) => row.targetCents)).toEqual([MAX_SAVINGS_AMOUNT_CENTS, 1]);
    });

    it('modifier la cible ne touche à aucun mouvement ni à l\'ordre', () => {
      const id = repo.createGoal(goal(), TODAY);
      repo.createGoal(goal({ name: 'Autre' }), TODAY);
      repo.addMovement(id, deposit(50_000, '2026-10-20'), TODAY);
      repo.addMovement(id, deposit(25_000, '2026-10-25'), TODAY);
      const before = movements(id);
      repo.updateGoal(id, goal({ name: 'Grande vacance', targetCents: 40_000, icon: '✈️', note: 'plus petit' }), TODAY);
      expect(goals().find((row) => row.id === id)).toMatchObject({ name: 'Grande vacance', targetCents: 40_000, icon: '✈️', note: 'plus petit' });
      expect(movements(id)).toEqual(before);
      expect(saved(id)).toBe(75_000); // plus que la nouvelle cible : le montant réel reste exact
      expect(order()).toEqual(['Grande vacance', 'Autre']);
    });

    it('une date cible déjà passée enregistrée n\'empêche pas de modifier le reste', () => {
      const id = repo.createGoal(goal({ targetDate: '2026-11-05' }), TODAY);
      const later = '2026-12-01'; // la date cible est maintenant passée
      expect(() => repo.updateGoal(id, goal({ name: 'Renommé', targetDate: '2026-11-05' }), later)).not.toThrow();
      expect(() => repo.updateGoal(id, goal({ targetDate: '2026-11-20' }), later)).toThrow(repo.SavingsError); // nouvelle date passée : refusée
    });

    it('un objectif inconnu ou supprimé est introuvable', () => {
      expect(() => repo.updateGoal('nope', goal(), TODAY)).toThrow(expect.objectContaining({ code: 'not-found' }));
      const id = repo.createGoal(goal(), TODAY);
      repo.deleteGoal(id);
      expect(() => repo.updateGoal(id, goal(), TODAY)).toThrow(expect.objectContaining({ code: 'not-found' }));
    });
  });

  describe('versements et retraits', () => {
    let id: string;
    beforeEach(() => {
      id = repo.createGoal(goal(), TODAY);
    });

    it('enregistre un versement puis un retrait et recalcule le montant épargné', () => {
      repo.addMovement(id, deposit(100_000, '2026-10-01', 'prime'), TODAY);
      repo.addMovement(id, withdrawal(30_000, '2026-10-10'), TODAY);
      expect(saved(id)).toBe(70_000);
      const rows = movements(id);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ goalId: id, kind: 'deposit', amountCents: 100_000, occurredOn: '2026-10-01', note: 'prime', userId: 'local' });
    });

    it('refuse un montant nul, négatif, décimal, une date future ou inexistante, un type inconnu', () => {
      const refuse = (input: RepositoryModule.MovementInput) => expect(() => repo.addMovement(id, input, TODAY)).toThrow(expect.objectContaining({ code: 'invalid' }));
      refuse(deposit(0, TODAY));
      refuse(deposit(-5, TODAY));
      refuse(deposit(10.5, TODAY));
      refuse(deposit(100, '2026-11-02'));
      refuse(deposit(100, '2026-02-30'));
      refuse({ ...deposit(100, TODAY), kind: 'gift' as never });
      refuse(deposit(100, TODAY, 'x'.repeat(121)));
      expect(movements()).toHaveLength(0);
    });

    it('refuse un retrait supérieur au montant disponible, sans rien écrire', () => {
      repo.addMovement(id, deposit(10_000, '2026-10-01'), TODAY);
      expect(() => repo.addMovement(id, withdrawal(10_001, '2026-10-05'), TODAY)).toThrow(expect.objectContaining({ code: 'negative' }));
      expect(movements(id)).toHaveLength(1);
      expect(saved(id)).toBe(10_000);
    });

    it('autorise de tout retirer : le montant tombe à zéro, jamais en dessous', () => {
      repo.addMovement(id, deposit(10_000, '2026-10-01'), TODAY);
      repo.addMovement(id, withdrawal(10_000, '2026-10-05'), TODAY);
      expect(saved(id)).toBe(0);
      expect(() => repo.addMovement(id, withdrawal(1, '2026-10-06'), TODAY)).toThrow(expect.objectContaining({ code: 'negative' }));
    });

    it('refuse un retrait daté avant le versement qui le couvre, même si le total final serait positif', () => {
      repo.addMovement(id, deposit(8_000, '2026-10-20'), TODAY);
      expect(() => repo.addMovement(id, withdrawal(5_000, '2026-10-10'), TODAY)).toThrow(expect.objectContaining({ code: 'negative' }));
      expect(movements(id)).toHaveLength(1);
    });

    it('refuse un versement antidaté qui ne change rien d\'illégal mais un retrait postérieur qui le dépasse', () => {
      repo.addMovement(id, deposit(8_000, '2026-10-01'), TODAY);
      repo.addMovement(id, withdrawal(6_000, '2026-10-15'), TODAY);
      // Un retrait de 3 000 le 10/10 laisserait 5 000 puis −1 000 le 15/10 : refusé.
      expect(() => repo.addMovement(id, withdrawal(3_000, '2026-10-10'), TODAY)).toThrow(expect.objectContaining({ code: 'negative' }));
      expect(() => repo.addMovement(id, withdrawal(2_000, '2026-10-10'), TODAY)).not.toThrow();
      expect(saved(id)).toBe(0);
    });

    it('le montant disponible tient compte de la date et du mouvement en cours de correction', () => {
      repo.addMovement(id, deposit(10_000, '2026-10-01'), TODAY);
      const out = repo.addMovement(id, withdrawal(4_000, '2026-10-10'), TODAY).id;
      expect(repo.availableToWithdraw(id, '2026-10-05')).toBe(6_000);
      expect(repo.availableToWithdraw(id, '2026-10-20')).toBe(6_000);
      expect(repo.availableToWithdraw(id, '2026-09-20')).toBe(0);
      expect(repo.availableToWithdraw(id, '2026-10-20', out)).toBe(10_000); // sans le retrait qu'on corrige
    });

    it('double toucher : le même identifiant n\'ajoute qu\'un seul mouvement', () => {
      const first = repo.addMovement(id, { ...deposit(5_000, TODAY), id: 'fixed-id' }, TODAY);
      const second = repo.addMovement(id, { ...deposit(5_000, TODAY), id: 'fixed-id' }, TODAY);
      expect(first).toEqual({ id: 'fixed-id', created: true });
      expect(second).toEqual({ id: 'fixed-id', created: false });
      expect(movements(id)).toHaveLength(1);
      expect(saved(id)).toBe(5_000);
    });

    it('un identifiant déjà pris par un autre objectif est refusé', () => {
      const other = repo.createGoal(goal({ name: 'Autre' }), TODAY);
      repo.addMovement(id, { ...deposit(5_000, TODAY), id: 'shared' }, TODAY);
      expect(() => repo.addMovement(other, { ...deposit(5_000, TODAY), id: 'shared' }, TODAY)).toThrow(expect.objectContaining({ code: 'invalid' }));
      expect(movements(other)).toHaveLength(0);
    });

    it('calcule sans erreur d\'arrondi avec de grands montants et des centimes', () => {
      repo.addMovement(id, deposit(MAX_SAVINGS_AMOUNT_CENTS, '2026-10-01'), TODAY);
      repo.addMovement(id, deposit(1, '2026-10-02'), TODAY);
      repo.addMovement(id, withdrawal(MAX_SAVINGS_AMOUNT_CENTS, '2026-10-03'), TODAY);
      expect(saved(id)).toBe(1);
      repo.addMovement(id, deposit(10, '2026-10-04'), TODAY);
      repo.addMovement(id, deposit(20, '2026-10-05'), TODAY);
      expect(saved(id)).toBe(31);
    });

    it('un objectif archivé refuse les nouveaux mouvements, un objectif inconnu aussi', () => {
      repo.addMovement(id, deposit(1_000, '2026-10-01'), TODAY);
      repo.archiveGoal(id);
      expect(() => repo.addMovement(id, deposit(1_000, '2026-10-02'), TODAY)).toThrow(expect.objectContaining({ code: 'archived' }));
      expect(() => repo.addMovement('nope', deposit(1_000, TODAY), TODAY)).toThrow(expect.objectContaining({ code: 'not-found' }));
    });
  });

  describe('correction et annulation', () => {
    let id: string;
    let first: string;
    let second: string;
    beforeEach(() => {
      id = repo.createGoal(goal(), TODAY);
      first = repo.addMovement(id, deposit(10_000, '2026-10-01'), TODAY).id;
      second = repo.addMovement(id, withdrawal(4_000, '2026-10-10'), TODAY).id;
    });

    it('corrige montant, date et note en gardant l\'identifiant, l\'objectif et le type', () => {
      repo.updateMovement(first, { amountCents: 12_000, note: 'corrigé', occurredOn: '2026-09-30' }, TODAY);
      expect(active(id).find((row) => row.id === first)).toMatchObject({ id: first, goalId: id, kind: 'deposit', amountCents: 12_000, occurredOn: '2026-09-30', note: 'corrigé' });
      expect(saved(id)).toBe(8_000);
    });

    it('vider la note la remet à null', () => {
      repo.updateMovement(first, { note: 'a' }, TODAY);
      repo.updateMovement(first, { note: '  ' }, TODAY);
      expect(active(id).find((row) => row.id === first)?.note).toBeNull();
    });

    it('refuse une correction qui rendrait l\'historique incohérent, et ne change rien', () => {
      const before = movements(id);
      expect(() => repo.updateMovement(first, { amountCents: 3_000 }, TODAY)).toThrow(expect.objectContaining({ code: 'negative' }));
      expect(() => repo.updateMovement(first, { occurredOn: '2026-10-20' }, TODAY)).toThrow(expect.objectContaining({ code: 'negative' }));
      expect(() => repo.updateMovement(second, { kind: 'deposit', amountCents: 1 }, TODAY)).not.toThrow(); // un versement ne peut pas rendre négatif
      expect(movements(id).find((row) => row.id === first)).toEqual(before.find((row) => row.id === first));
    });

    it('un retrait peut être corrigé jusqu\'au montant disponible, pas au-delà', () => {
      expect(() => repo.updateMovement(second, { amountCents: 10_000 }, TODAY)).not.toThrow();
      expect(() => repo.updateMovement(second, { amountCents: 10_001 }, TODAY)).toThrow(expect.objectContaining({ code: 'negative' }));
      expect(saved(id)).toBe(0);
    });

    it('refuse des champs invalides et un mouvement inconnu', () => {
      expect(() => repo.updateMovement(first, { amountCents: 0 }, TODAY)).toThrow(expect.objectContaining({ code: 'invalid' }));
      expect(() => repo.updateMovement(first, { occurredOn: '2026-11-02' }, TODAY)).toThrow(expect.objectContaining({ code: 'invalid' }));
      expect(() => repo.updateMovement('nope', { amountCents: 5 }, TODAY)).toThrow(expect.objectContaining({ code: 'not-found' }));
    });

    it('annule un retrait : suppression logique, la ligne reste en base', () => {
      repo.cancelMovement(second);
      expect(saved(id)).toBe(10_000);
      expect(movements(id)).toHaveLength(2);
      expect(movements(id).find((row) => row.id === second)?.deletedAt).not.toBeNull();
    });

    it('refuse d\'annuler un versement dont un retrait dépend', () => {
      expect(() => repo.cancelMovement(first)).toThrow(expect.objectContaining({ code: 'negative' }));
      expect(saved(id)).toBe(6_000);
      repo.cancelMovement(second);
      expect(() => repo.cancelMovement(first)).not.toThrow(); // plus rien ne dépend de lui
      expect(saved(id)).toBe(0);
    });

    it('rétablit un mouvement annulé (Annuler de la notification) si l\'historique reste cohérent', () => {
      repo.cancelMovement(second);
      repo.restoreMovement(second);
      expect(saved(id)).toBe(6_000);
      expect(movements(id).find((row) => row.id === second)?.deletedAt).toBeNull();
      repo.restoreMovement(second); // sans effet s'il est déjà actif
      expect(saved(id)).toBe(6_000);
    });

    it('refuse de rétablir un retrait devenu impossible', () => {
      repo.cancelMovement(second);
      repo.updateMovement(first, { amountCents: 3_000 }, TODAY);
      expect(() => repo.restoreMovement(second)).toThrow(expect.objectContaining({ code: 'negative' }));
      expect(saved(id)).toBe(3_000);
    });

    it('un mouvement d\'un objectif archivé ne se modifie pas tant que l\'objectif n\'est pas restauré', () => {
      repo.archiveGoal(id);
      expect(() => repo.updateMovement(first, { note: 'x' }, TODAY)).toThrow(expect.objectContaining({ code: 'archived' }));
      expect(() => repo.cancelMovement(second)).toThrow(expect.objectContaining({ code: 'archived' }));
      repo.restoreGoal(id);
      expect(() => repo.cancelMovement(second)).not.toThrow();
    });
  });

  describe('archivage, restauration, suppression', () => {
    it('archiver conserve tout et retire l\'objectif de la liste active', () => {
      const a = repo.createGoal(goal({ name: 'A' }), TODAY);
      repo.createGoal(goal({ name: 'B' }), TODAY);
      repo.addMovement(a, deposit(5_000, '2026-10-01'), TODAY);
      repo.archiveGoal(a);
      expect(order()).toEqual(['B']);
      expect(goals().find((row) => row.id === a)?.archivedAt).not.toBeNull();
      expect(active(a)).toHaveLength(1);
      expect(saved(a)).toBe(5_000);
      repo.archiveGoal(a); // idempotent
      expect(goals()).toHaveLength(2);
    });

    it('restaurer remet l\'objectif à la fin de la liste active, historique intact', () => {
      const a = repo.createGoal(goal({ name: 'A' }), TODAY);
      repo.createGoal(goal({ name: 'B' }), TODAY);
      repo.addMovement(a, deposit(5_000, '2026-10-01'), TODAY);
      repo.archiveGoal(a);
      repo.restoreGoal(a);
      expect(order()).toEqual(['B', 'A']);
      expect(saved(a)).toBe(5_000);
      expect(() => repo.addMovement(a, deposit(1_000, '2026-10-02'), TODAY)).not.toThrow();
      repo.restoreGoal(a); // idempotent
      expect(order()).toEqual(['B', 'A']);
    });

    it('un objectif atteint ou dépassé n\'est jamais archivé automatiquement', () => {
      const a = repo.createGoal(goal({ targetCents: 1_000 }), TODAY);
      repo.addMovement(a, deposit(1_000, '2026-10-01'), TODAY);
      repo.addMovement(a, deposit(500, '2026-10-02'), TODAY);
      expect(goals()[0].archivedAt).toBeNull();
      expect(saved(a)).toBe(1_500);
    });

    it('supprime un objectif sans historique (suppression logique)', () => {
      const a = repo.createGoal(goal(), TODAY);
      repo.deleteGoal(a);
      expect(goals()[0].deletedAt).not.toBeNull();
      expect(order()).toEqual([]);
    });

    it('refuse de supprimer un objectif qui a des mouvements : il faut l\'archiver', () => {
      const a = repo.createGoal(goal(), TODAY);
      repo.addMovement(a, deposit(1_000, '2026-10-01'), TODAY);
      expect(() => repo.deleteGoal(a)).toThrow(expect.objectContaining({ code: 'has-history' }));
      expect(goals()[0].deletedAt).toBeNull();
      expect(movements(a)).toHaveLength(1);
    });

    it('un objectif dont tous les mouvements sont annulés peut être supprimé, sans effacer la moindre ligne de mouvement', () => {
      const a = repo.createGoal(goal(), TODAY);
      const m = repo.addMovement(a, deposit(1_000, '2026-10-01'), TODAY).id;
      repo.cancelMovement(m);
      repo.deleteGoal(a);
      expect(movements(a)).toHaveLength(1);
      expect(goals()[0].deletedAt).not.toBeNull();
    });
  });

  describe('ordre personnalisé', () => {
    let a: string;
    let b: string;
    let c: string;
    let d: string;
    beforeEach(() => {
      a = repo.createGoal(goal({ name: 'A' }), TODAY);
      b = repo.createGoal(goal({ name: 'B' }), TODAY);
      c = repo.createGoal(goal({ name: 'C' }), TODAY);
      d = repo.createGoal(goal({ name: 'D' }), TODAY);
    });

    it('enregistre le nouvel ordre sans rien perdre', () => {
      repo.reorderGoals([c, a, d, b]);
      expect(order()).toEqual(['C', 'A', 'D', 'B']);
      expect(goals().map((row) => row.sortOrder)).toEqual([0, 1, 2, 3]);
    });

    it('un versement ne réorganise jamais la liste', () => {
      repo.reorderGoals([d, c, b, a]);
      repo.addMovement(a, deposit(1_000, '2026-10-01'), TODAY);
      repo.addMovement(c, deposit(9_000, '2026-10-02'), TODAY);
      expect(order()).toEqual(['D', 'C', 'B', 'A']);
    });

    it('réorganiser plusieurs fois de suite ne perd ni ne duplique rien', () => {
      const sequences = [[b, a, c, d], [d, c, b, a], [a, b, c, d], [c, d, a, b], [b, c, d, a]];
      for (const sequence of sequences) {
        repo.reorderGoals(sequence);
        expect(order()).toEqual(sequence.map((id) => goals().find((row) => row.id === id)?.name));
        expect(goals()).toHaveLength(4);
        expect(new Set(goals().map((row) => row.sortOrder)).size).toBe(4);
      }
    });

    it('ignore les identifiants inconnus, en double ou archivés ; un objectif oublié passe après les autres', () => {
      repo.archiveGoal(b);
      repo.reorderGoals([d, 'inconnu', d, b, a]);
      expect(order()).toEqual(['D', 'A', 'C']);
      expect(goals().find((row) => row.id === b)?.archivedAt).not.toBeNull();
    });

    it('n\'écrit que les lignes dont la position change', () => {
      const before = goals().map((row) => row.updatedAt);
      repo.reorderGoals([a, b, c, d]);
      expect(goals().map((row) => row.updatedAt)).toEqual(before);
    });

    it('l\'ordre est conservé après archivage puis restauration d\'un autre objectif', () => {
      repo.reorderGoals([d, c, b, a]);
      repo.archiveGoal(c);
      expect(order()).toEqual(['D', 'B', 'A']);
      repo.restoreGoal(c);
      expect(order()).toEqual(['D', 'B', 'A', 'C']);
    });
  });

  describe('aucun effet sur le reste de l\'application', () => {
    it('ne touche ni aux opérations, ni aux budgets, ni aux factures, ni aux soldes, ni aux courses', () => {
      const sqlite = database.sqlite;
      sqlite
        .prepare(
          "INSERT INTO transactions (id, user_id, type, amount_cents, payment_method, occurred_on, created_at, updated_at) VALUES ('t1','local','expense',4250,'card','2026-10-31','2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')",
        )
        .run();
      sqlite.prepare("INSERT INTO shopping_lists (id, user_id, name, created_at, updated_at) VALUES ('l1','local','Courses','2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')").run();
      const tables = ['transactions', 'budgets', 'categories', 'account_snapshots', 'profiles', 'shopping_lists', 'shopping_items', 'bills', 'bill_occurrences'];
      const snapshot = () => tables.map((table) => JSON.stringify(sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all()));
      const before = snapshot();

      const id = repo.createGoal(goal(), TODAY);
      const other = repo.createGoal(goal({ name: 'Autre' }), TODAY);
      const m = repo.addMovement(id, deposit(50_000, '2026-10-01'), TODAY).id;
      const out = repo.addMovement(id, withdrawal(10_000, '2026-10-05'), TODAY).id;
      repo.updateMovement(m, { amountCents: 60_000 }, TODAY);
      repo.reorderGoals([other, id]);
      repo.updateGoal(id, goal({ targetCents: 10_000 }), TODAY);
      repo.archiveGoal(id);
      repo.restoreGoal(id);
      repo.cancelMovement(out);
      repo.deleteGoal(other);

      expect(snapshot()).toEqual(before);
    });

    it('la base refuse un mouvement sur un objectif inexistant (intégrité référentielle) et les montants nuls', () => {
      const now = '2026-11-01T10:00:00.000Z';
      const insert = (goalId: string, kind: string, amount: number) =>
        database.sqlite
          .prepare("INSERT INTO savings_movements (id, user_id, goal_id, kind, amount_cents, occurred_on, created_at, updated_at) VALUES (?, 'local', ?, ?, ?, '2026-11-01', ?, ?)")
          .run(`m-${goalId}-${kind}-${amount}`, goalId, kind, amount, now, now);
      expect(() => insert('inconnu', 'deposit', 100)).toThrow();
      const id = repo.createGoal(goal(), TODAY);
      expect(() => insert(id, 'deposit', 0)).toThrow();
      expect(() => insert(id, 'deposit', -1)).toThrow();
      expect(() => insert(id, 'gift', 100)).toThrow();
      expect(() => insert(id, 'deposit', 100)).not.toThrow();
      expect(() =>
        database.sqlite
          .prepare("INSERT INTO savings_goals (id, user_id, name, target_cents, created_at, updated_at) VALUES ('g0','local','Zéro',0,?,?)")
          .run(now, now),
      ).toThrow();
    });
  });

  describe('atomicité', () => {
    it('un retrait refusé en pleine transaction n\'écrit rien', () => {
      const id = repo.createGoal(goal(), TODAY);
      repo.addMovement(id, deposit(1_000, '2026-10-01'), TODAY);
      const before = JSON.stringify(movements());
      expect(() => repo.addMovement(id, withdrawal(5_000, '2026-10-02'), TODAY)).toThrow();
      expect(JSON.stringify(movements())).toBe(before);
    });

    it('une suppression refusée laisse l\'objectif et son historique intacts', () => {
      const id = repo.createGoal(goal(), TODAY);
      repo.addMovement(id, deposit(1_000, '2026-10-01'), TODAY);
      const before = JSON.stringify([goals(), movements()]);
      expect(() => repo.deleteGoal(id)).toThrow();
      expect(JSON.stringify([goals(), movements()])).toBe(before);
    });
  });

  describe('volume', () => {
    it('gère des dizaines d\'objectifs et un long historique avec un total exact', () => {
      const ids = Array.from({ length: 40 }, (_, index) => repo.createGoal(goal({ name: `Objectif ${index + 1}` }), TODAY));
      const target = ids[7];
      let expected = 0;
      for (let day = 1; day <= 28; day++) {
        const date = `2026-09-${String(day).padStart(2, '0')}`;
        repo.addMovement(target, deposit(day * 101, date), TODAY);
        expected += day * 101;
      }
      for (let day = 1; day <= 28; day += 7) {
        const date = `2026-10-${String(day).padStart(2, '0')}`;
        repo.addMovement(target, withdrawal(333, date), TODAY);
        expected -= 333;
      }
      expect(saved(target)).toBe(expected);
      expect(goals()).toHaveLength(40);
      repo.reorderGoals([...ids].reverse());
      expect(order()[0]).toBe('Objectif 40');
      expect(order()[39]).toBe('Objectif 1');
    });
  });
});

describe('persistance et migration', () => {
  let folder: string;

  beforeEach(() => {
    folder = mkdtempSync(path.join(tmpdir(), 'sovmilo-savings-'));
  });
  afterEach(() => rmSync(folder, { recursive: true, force: true }));

  it('retrouve objectifs, mouvements, ordre et archives après un redémarrage', () => {
    const file = path.join(folder, 'sovmilo.db');

    const first = openTestDatabase(file);
    const repo = loadRepository(first);
    const a = repo.createGoal(goal({ name: 'A' }), TODAY);
    const b = repo.createGoal(goal({ name: 'B' }), TODAY);
    const c = repo.createGoal(goal({ name: 'C' }), TODAY);
    repo.addMovement(a, deposit(10_000, '2026-10-01', 'prime'), TODAY);
    const out = repo.addMovement(a, withdrawal(2_500, '2026-10-05'), TODAY).id;
    repo.cancelMovement(out);
    repo.archiveGoal(b);
    repo.reorderGoals([c, a]);
    first.close();

    const second = openTestDatabase(file); // nouvelle ouverture du même fichier
    const rows = second.db.select().from(savingsGoals).orderBy(asc(savingsGoals.sortOrder)).all();
    expect(rows.filter((row) => row.archivedAt === null).map((row) => row.name)).toEqual(['C', 'A']);
    expect(rows.find((row) => row.id === b)?.archivedAt).not.toBeNull();
    const moves = second.db.select().from(savingsMovements).where(eq(savingsMovements.goalId, a)).all();
    expect(moves).toHaveLength(2);
    expect(savedCents(moves.filter((row) => row.deletedAt === null))).toBe(10_000);
    expect(moves.find((row) => row.id === out)?.deletedAt).not.toBeNull();

    const again = loadRepository(second);
    expect(() => again.restoreMovement(out)).not.toThrow();
    again.restoreGoal(b);
    expect(second.db.select().from(savingsGoals).where(eq(savingsGoals.id, b)).get()?.archivedAt).toBeNull();
    second.close();
  });

  it('la migration de l\'épargne est purement additive (aucun DROP, ALTER, DELETE ni UPDATE) et ne touche à aucune autre table', () => {
    const migrationsFolder = path.join(__dirname, '..', '..', 'db', 'migrations');
    const journal = JSON.parse(readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as { entries: { tag: string }[] };
    const sql = readFileSync(path.join(migrationsFolder, `${journal.entries[4].tag}.sql`), 'utf8');
    expect(sql).toMatch(/CREATE TABLE `savings_goals`/);
    expect(sql).toMatch(/CREATE TABLE `savings_movements`/);
    const statements = sql.replace(/ON (UPDATE|DELETE) no action/gi, '');
    expect(statements).not.toMatch(/\b(DROP|ALTER|DELETE|UPDATE|INSERT)\b/i);
    expect(sql).not.toMatch(/\b(transactions|budgets|categories|account_snapshots|profiles|shopping_lists|shopping_items|bills|bill_occurrences)\b/i);
  });

  it('appliquer la migration sur une base existante conserve les données', () => {
    const file = path.join(folder, 'existing.db');
    const legacy = new DatabaseSync(file);
    applyMigrations(legacy, 4); // l'application avant l'épargne
    legacy
      .prepare(
        "INSERT INTO transactions (id, user_id, type, amount_cents, payment_method, occurred_on, created_at, updated_at) VALUES ('t1','local','expense',4250,'card','2026-10-31','2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')",
      )
      .run();
    legacy.prepare("INSERT INTO bills (id, user_id, name, recurrence, anchor_date, created_at, updated_at) VALUES ('b1','local','Internet','monthly','2026-11-12','2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')").run();
    applyMigrations(legacy, 5, 4); // mise à jour : seule la nouvelle migration est jouée
    expect(() => legacy.prepare('SELECT * FROM savings_movements').all()).not.toThrow();
    expect(legacy.prepare('SELECT amount_cents FROM transactions WHERE id = ?').get('t1')).toMatchObject({ amount_cents: 4250 });
    expect(legacy.prepare('SELECT name FROM bills WHERE id = ?').get('b1')).toMatchObject({ name: 'Internet' });
    legacy.close();
  });
});
