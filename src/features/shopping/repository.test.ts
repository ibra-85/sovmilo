import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { eq } from 'drizzle-orm';

import { applyMigrations, openTestDatabase } from '@/db/test-support';
import { shoppingItems, shoppingLists, transactions } from '@/db/schema';
import { MAX_ITEM_NAME_LENGTH, MAX_LIST_NAME_LENGTH, MAX_QUANTITY_MILLI, MAX_UNIT_PRICE_CENTS } from '@/domain/shopping';

import type * as RepositoryModule from './repository';

/*
 * Ces tests utilisent une VRAIE base SQLite (les vraies migrations du dossier `src/db/migrations`, le vrai pilote Drizzle
 * d'Expo) à la place d'`expo-sqlite`, qui est natif. Ils prouvent la logique des dépôts et la persistance ; ils ne
 * remplacent pas un essai sur téléphone.
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
    // Un `import` serait mis en cache : `require` dans `isolateModules` donne un exemplaire neuf du module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    repository = require('./repository') as Repository;
  });
  if (!repository) throw new Error('Dépôt non chargé');
  return repository;
}

const item = (overrides: Partial<RepositoryModule.ShoppingItemInput> = {}): RepositoryModule.ShoppingItemInput => ({
  name: 'Pain',
  quantityMilli: 1000,
  unit: 'piece',
  unitPriceCents: null,
  ...overrides,
});

describe('listes de courses', () => {
  let database: Database;
  let repo: Repository;

  beforeEach(() => {
    database = openTestDatabase();
    repo = loadRepository(database);
  });
  afterEach(() => database.close());

  const lists = () => database.db.select().from(shoppingLists).all();
  const items = () => database.db.select().from(shoppingItems).all();

  describe('création et modification', () => {
    it('crée une liste avec un nom nettoyé', () => {
      const id = repo.createList('  Mes   courses ');
      expect(lists()).toMatchObject([{ id, name: 'Mes courses', userId: 'local', deletedAt: null }]);
    });

    it('refuse un nom vide ou trop long, sans rien écrire', () => {
      expect(() => repo.createList('   ')).toThrow(RangeError);
      expect(() => repo.createList('x'.repeat(MAX_LIST_NAME_LENGTH + 1))).toThrow(RangeError);
      expect(lists()).toEqual([]);
    });

    it('accepte exactement la longueur maximale, en russe aussi', () => {
      repo.createList('я'.repeat(MAX_LIST_NAME_LENGTH));
      expect(lists()[0].name).toHaveLength(MAX_LIST_NAME_LENGTH);
    });

    it('renomme une liste et met à jour sa date', async () => {
      const id = repo.createList('Samedi');
      const before = lists()[0].updatedAt;
      await new Promise((resolve) => setTimeout(resolve, 5));
      repo.renameList(id, ' Dimanche ');
      expect(lists()[0].name).toBe('Dimanche');
      expect(lists()[0].updatedAt > before).toBe(true);
    });

    it('refuse de renommer une liste inconnue, supprimée, ou avec un nom invalide', () => {
      const id = repo.createList('A');
      expect(() => repo.renameList('inconnue', 'B')).toThrow('Liste introuvable');
      expect(() => repo.renameList(id, '')).toThrow(RangeError);
      repo.deleteList(id);
      expect(() => repo.renameList(id, 'B')).toThrow('Liste introuvable');
    });
  });

  describe('articles : ajout et modification', () => {
    it('ajoute un article avec ses valeurs par défaut, non coché, sans prix', () => {
      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item({ name: '  Lait ' }));
      expect(items()).toMatchObject([
        { id, listId, name: 'Lait', quantityMilli: 1000, unit: 'piece', unitPriceCents: null, checked: false, checkedAt: null, deletedAt: null },
      ]);
    });

    it('conserve une quantité décimale exacte et un prix en centimes', () => {
      const listId = repo.createList('Courses');
      repo.addItem(listId, item({ name: 'Pommes', quantityMilli: 1750, unit: 'kg', unitPriceCents: 299 }));
      expect(items()[0]).toMatchObject({ quantityMilli: 1750, unit: 'kg', unitPriceCents: 299 });
    });

    it('place chaque nouvel article à la fin de la liste', () => {
      const listId = repo.createList('Courses');
      const other = repo.createList('Autre');
      repo.addItem(listId, item({ name: 'A' }));
      repo.addItem(listId, item({ name: 'B' }));
      repo.addItem(other, item({ name: 'Z' }));
      repo.addItem(listId, item({ name: 'C' }));
      const orders = items()
        .filter((row) => row.listId === listId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => row.name);
      expect(orders).toEqual(['A', 'B', 'C']);
    });

    it('accepte un nom très long (limite incluse) et refuse au-delà', () => {
      const listId = repo.createList('Courses');
      repo.addItem(listId, item({ name: 'x'.repeat(MAX_ITEM_NAME_LENGTH) }));
      expect(() => repo.addItem(listId, item({ name: 'x'.repeat(MAX_ITEM_NAME_LENGTH + 1) }))).toThrow(RangeError);
      expect(items()).toHaveLength(1);
    });

    it.each([
      ['nom vide', { name: ' ' }],
      ['quantité nulle', { quantityMilli: 0 }],
      ['quantité négative', { quantityMilli: -1000 }],
      ['quantité décimale en base', { quantityMilli: 1000.5 }],
      ['quantité trop grande', { quantityMilli: MAX_QUANTITY_MILLI + 1 }],
      ['quantité NaN', { quantityMilli: Number.NaN }],
      ['prix nul', { unitPriceCents: 0 }],
      ['prix négatif', { unitPriceCents: -5 }],
      ['prix non entier', { unitPriceCents: 12.5 }],
      ['prix trop grand', { unitPriceCents: MAX_UNIT_PRICE_CENTS + 1 }],
      ['unité inconnue', { unit: 'tonne' as never }],
    ])('refuse un article invalide (%s) sans rien écrire', (_label, overrides) => {
      const listId = repo.createList('Courses');
      expect(() => repo.addItem(listId, item(overrides))).toThrow(RangeError);
      expect(items()).toEqual([]);
    });

    it('refuse d’ajouter à une liste inconnue ou supprimée', () => {
      const listId = repo.createList('Courses');
      expect(() => repo.addItem('inconnue', item())).toThrow('Liste introuvable');
      repo.deleteList(listId);
      expect(() => repo.addItem(listId, item())).toThrow('Liste introuvable');
    });

    it('modifie un article sans changer son état coché ni sa place', () => {
      const listId = repo.createList('Courses');
      repo.addItem(listId, item({ name: 'A' }));
      const id = repo.addItem(listId, item({ name: 'B' }));
      repo.setItemChecked(id, true);
      const before = items().find((row) => row.id === id)!;
      repo.updateItem(id, item({ name: 'Beurre', quantityMilli: 250, unit: 'kg', unitPriceCents: 1450 }));
      const after = items().find((row) => row.id === id)!;
      expect(after).toMatchObject({ name: 'Beurre', quantityMilli: 250, unit: 'kg', unitPriceCents: 1450, checked: true, sortOrder: before.sortOrder });
      expect(after.checkedAt).toBe(before.checkedAt);
    });

    it('retirer le prix d’un article (null) fonctionne', () => {
      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item({ unitPriceCents: 199 }));
      repo.updateItem(id, item({ unitPriceCents: null }));
      expect(items()[0].unitPriceCents).toBeNull();
    });

    it('refuse de modifier un article inconnu ou avec des données invalides', () => {
      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item());
      expect(() => repo.updateItem('inconnu', item())).toThrow('Article introuvable');
      expect(() => repo.updateItem(id, item({ quantityMilli: 0 }))).toThrow(RangeError);
      expect(items()[0].quantityMilli).toBe(1000);
    });
  });

  describe('cocher et décocher', () => {
    it('coche en mémorisant l’instant, décoche en l’effaçant', () => {
      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item());
      repo.setItemChecked(id, true);
      expect(items()[0].checked).toBe(true);
      expect(items()[0].checkedAt).toEqual(expect.any(String));
      repo.setItemChecked(id, false);
      expect(items()[0]).toMatchObject({ checked: false, checkedAt: null });
    });

    it('est idempotent : cocher deux fois ne change pas l’instant mémorisé, et ne s’annule pas', () => {
      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item());
      repo.setItemChecked(id, true);
      const first = items()[0];
      repo.setItemChecked(id, true);
      expect(items()[0]).toMatchObject({ checked: true, checkedAt: first.checkedAt, updatedAt: first.updatedAt });
    });

    it('ne supprime jamais un article coché', () => {
      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item());
      repo.setItemChecked(id, true);
      expect(items()).toHaveLength(1);
      expect(items()[0].deletedAt).toBeNull();
    });

    it('refuse un article inconnu', () => {
      expect(() => repo.setItemChecked('inconnu', true)).toThrow('Article introuvable');
    });
  });

  describe('suppression', () => {
    it('supprime un article (logiquement) puis le restaure', () => {
      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item());
      repo.deleteItem(id);
      expect(items()[0].deletedAt).toEqual(expect.any(String));
      expect(() => repo.setItemChecked(id, true)).toThrow('Article introuvable');
      repo.restoreItem(id);
      expect(items()[0].deletedAt).toBeNull();
    });

    it('une double suppression est refusée proprement, et restaurer un article actif ne fait rien', () => {
      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item());
      repo.restoreItem(id);
      repo.deleteItem(id);
      expect(() => repo.deleteItem(id)).toThrow('Article introuvable');
    });

    it('supprimer une liste supprime aussi ses articles (même instant), et pas ceux des autres listes', () => {
      const a = repo.createList('A');
      const b = repo.createList('B');
      repo.addItem(a, item({ name: 'a1' }));
      repo.addItem(a, item({ name: 'a2' }));
      repo.addItem(b, item({ name: 'b1' }));
      repo.deleteList(a);
      const rows = items();
      expect(rows.filter((row) => row.listId === a).every((row) => row.deletedAt !== null)).toBe(true);
      expect(rows.filter((row) => row.listId === b).every((row) => row.deletedAt === null)).toBe(true);
      expect(lists().find((row) => row.id === a)!.deletedAt).toBe(rows.find((row) => row.listId === a)!.deletedAt);
      expect(lists().find((row) => row.id === b)!.deletedAt).toBeNull();
    });

    it('on ne restaure pas un article dont la liste a été supprimée', () => {
      const listId = repo.createList('A');
      const id = repo.addItem(listId, item());
      repo.deleteItem(id);
      repo.deleteList(listId);
      expect(() => repo.restoreItem(id)).toThrow('Liste introuvable');
    });

    it('refuse de supprimer deux fois la même liste', () => {
      const id = repo.createList('A');
      repo.deleteList(id);
      expect(() => repo.deleteList(id)).toThrow('Liste introuvable');
    });
  });

  describe('indépendance avec les finances', () => {
    it('aucune opération n’est créée ni modifiée par les courses (articles cochés, prix renseignés)', () => {
      const now = '2026-11-01T10:00:00.000Z';
      database.db
        .insert(transactions)
        .values({ id: 't1', userId: 'local', type: 'expense', amountCents: 1234, paymentMethod: 'card', occurredOn: '2026-11-01', createdAt: now, updatedAt: now })
        .run();
      const before = database.db.select().from(transactions).all();

      const listId = repo.createList('Courses');
      const id = repo.addItem(listId, item({ name: 'Lait', quantityMilli: 2000, unitPriceCents: 150 }));
      repo.setItemChecked(id, true);
      repo.updateItem(id, item({ name: 'Lait bio', unitPriceCents: 199 }));
      repo.deleteItem(id);
      repo.deleteList(listId);

      expect(database.db.select().from(transactions).all()).toEqual(before);
    });
  });
});

describe('persistance et migration', () => {
  let folder: string;

  beforeEach(() => {
    folder = mkdtempSync(path.join(tmpdir(), 'sovmilo-shopping-'));
  });
  afterEach(() => rmSync(folder, { recursive: true, force: true }));

  it('retrouve listes, articles, quantités, prix et états après un redémarrage', () => {
    const file = path.join(folder, 'sovmilo.db');

    const first = openTestDatabase(file);
    const repo = loadRepository(first);
    const listId = repo.createList('Mes courses');
    const milk = repo.addItem(listId, item({ name: 'Lait', quantityMilli: 1500, unit: 'l', unitPriceCents: 129 }));
    const bread = repo.addItem(listId, item({ name: 'Pain' }));
    repo.setItemChecked(bread, true);
    first.close();

    const second = openTestDatabase(file); // nouvelle ouverture du même fichier
    const rows = second.db.select().from(shoppingItems).where(eq(shoppingItems.listId, listId)).all();
    expect(second.db.select().from(shoppingLists).all()).toMatchObject([{ id: listId, name: 'Mes courses' }]);
    expect(rows.find((row) => row.id === milk)).toMatchObject({ name: 'Lait', quantityMilli: 1500, unit: 'l', unitPriceCents: 129, checked: false });
    expect(rows.find((row) => row.id === bread)).toMatchObject({ name: 'Pain', unitPriceCents: null, checked: true });

    // et le dépôt rechargé continue d'écrire dans la même base
    const again = loadRepository(second);
    again.setItemChecked(bread, false);
    expect(second.db.select().from(shoppingItems).where(eq(shoppingItems.id, bread)).get()?.checked).toBe(false);
    second.close();
  });

  it('la migration des courses est purement additive (aucun DROP, ALTER, DELETE ni UPDATE)', () => {
    const migrationsFolder = path.join(__dirname, '..', '..', 'db', 'migrations');
    const journal = JSON.parse(readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as { entries: { tag: string }[] };
    const sql = readFileSync(path.join(migrationsFolder, `${journal.entries[2].tag}.sql`), 'utf8');
    expect(sql).toMatch(/CREATE TABLE `shopping_lists`/);
    expect(sql).toMatch(/CREATE TABLE `shopping_items`/);
    // (« ON UPDATE / ON DELETE no action » est la clause par défaut d'une clé étrangère, pas une instruction)
    const statements = sql.replace(/ON (UPDATE|DELETE) no action/gi, '');
    expect(statements).not.toMatch(/\b(DROP|ALTER|DELETE|UPDATE|INSERT)\b/i);
    expect(sql).not.toMatch(/\b(transactions|budgets|categories|account_snapshots|profiles)\b/i);
  });

  it('appliquer la migration sur une base existante conserve les données financières', () => {
    const file = path.join(folder, 'existing.db');
    const legacy = new DatabaseSync(file);
    applyMigrations(legacy, 2); // l'application avant les courses
    legacy
      .prepare(
        "INSERT INTO transactions (id, user_id, type, amount_cents, payment_method, occurred_on, created_at, updated_at) VALUES ('t1','local','expense',4250,'card','2026-10-31','2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')",
      )
      .run();
    applyMigrations(legacy, 3, 2); // mise à jour : seule la nouvelle migration est jouée (Drizzle suit celles déjà passées)
    expect(() => legacy.prepare('SELECT * FROM shopping_items').all()).not.toThrow();
    expect(legacy.prepare('SELECT amount_cents FROM transactions WHERE id = ?').get('t1')).toMatchObject({ amount_cents: 4250 });
    legacy.close();
  });
});
