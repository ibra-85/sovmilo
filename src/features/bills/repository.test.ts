import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { asc, eq } from 'drizzle-orm';

import { applyMigrations, openTestDatabase } from '@/db/test-support';
import { billOccurrences, bills, budgets, transactions } from '@/db/schema';
import { MAX_BILL_AMOUNT_CENTS, MAX_BILL_NAME_LENGTH } from '@/domain/bills';

import type * as RepositoryModule from './repository';

/*
 * VRAIE base SQLite (les vraies migrations, le vrai pilote Drizzle d'Expo) à la place d'`expo-sqlite`, qui est natif. Ces tests
 * prouvent la logique des dépôts et la persistance ; ils ne remplacent pas un essai sur téléphone.
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

const bill = (overrides: Partial<RepositoryModule.BillInput> = {}): RepositoryModule.BillInput => ({
  name: 'Internet',
  expectedAmountCents: 2999,
  recurrence: 'monthly',
  nextDueOn: '2026-11-12',
  note: null,
  ...overrides,
});

describe('factures', () => {
  let database: Database;
  let repo: Repository;

  beforeEach(() => {
    database = openTestDatabase();
    repo = loadRepository(database);
  });
  afterEach(() => database.close());

  const allBills = () => database.db.select().from(bills).all();
  const occurrences = (billId?: string) =>
    (billId
      ? database.db.select().from(billOccurrences).where(eq(billOccurrences.billId, billId))
      : database.db.select().from(billOccurrences)
    )
      .orderBy(asc(billOccurrences.dueOn))
      .all();
  const active = (billId: string) => occurrences(billId).filter((row) => row.deletedAt === null);
  const dates = (billId: string) => active(billId).map((row) => row.dueOn);

  describe('parcours 1 : facture ponctuelle', () => {
    it('crée une seule échéance, à payer, avec son montant', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ name: 'Réparation voiture', expectedAmountCents: 15000, recurrence: 'none', nextDueOn: '2026-11-15' }), TODAY);
      expect(allBills()).toMatchObject([{ id: billId, name: 'Réparation voiture', recurrence: 'none', anchorDate: '2026-11-15', stoppedOn: null }]);
      expect(occurrences()).toMatchObject([{ id: occurrenceId, dueOn: '2026-11-15', amountCents: 15000, paidOn: null, paidAmountCents: null }]);
    });

    it('payée, elle reste dans l\'historique, avec sa date et son montant', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ recurrence: 'none', nextDueOn: '2026-11-15', expectedAmountCents: 15000 }), TODAY);
      repo.markPaid(occurrenceId, { paidOn: '2026-11-10', amountCents: 15000 }, '2026-11-10');
      expect(active(billId)).toMatchObject([{ dueOn: '2026-11-15', paidOn: '2026-11-10', paidAmountCents: 15000 }]);
      expect(active(billId)).toHaveLength(1); // aucune échéance supplémentaire
    });

    it('accepte une première échéance déjà passée (elle sera en retard) mais pas absurde', () => {
      expect(() => repo.createBill(bill({ recurrence: 'none', nextDueOn: '2026-10-20' }), TODAY)).not.toThrow();
      expect(() => repo.createBill(bill({ recurrence: 'none', nextDueOn: '2020-01-01' }), TODAY)).toThrow(RangeError);
    });
  });

  describe('parcours 2 : facture mensuelle', () => {
    it('crée les échéances jusqu\'à l\'horizon et paie novembre sans toucher à décembre', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      expect(dates(billId)).toEqual(['2026-11-12', '2026-12-12', '2027-01-12', '2027-02-12']);

      repo.markPaid(occurrenceId, { paidOn: '2026-11-12', amountCents: 2999 }, '2026-11-12');
      const rows = active(billId);
      expect(rows.map((row) => row.paidOn)).toEqual(['2026-11-12', null, null, null]);
      expect(rows[1]).toMatchObject({ dueOn: '2026-12-12', paidOn: null, paidAmountCents: null, amountCents: 2999 });
    });

    it('conserve le jour d\'origine 31 sur toute la série', () => {
      const { billId } = repo.createBill(bill({ nextDueOn: '2026-12-31' }), '2026-12-15');
      expect(dates(billId)).toEqual(['2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
    });

    it('reconstitue une facture oubliée : toutes les échéances passées sont là, impayées', () => {
      const { billId } = repo.createBill(bill({ nextDueOn: '2026-08-12' }), '2026-09-01');
      expect(dates(billId).slice(0, 2)).toEqual(['2026-08-12', '2026-09-12']);
      // l'application reste fermée jusqu'en novembre, puis s'ouvre : les mois manquants apparaissent, impayés
      repo.ensureOccurrences(TODAY);
      expect(dates(billId)).toEqual(['2026-08-12', '2026-09-12', '2026-10-12', '2026-11-12', '2026-12-12', '2027-01-12', '2027-02-12']);
      expect(active(billId).every((row) => row.paidOn === null)).toBe(true);
    });
  });

  describe('parcours 3 : facture annuelle', () => {
    it('retrouve la bonne prochaine échéance chaque année, y compris le 29 février', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ name: 'Assurance habitation', expectedAmountCents: 32000, recurrence: 'yearly', nextDueOn: '2027-03-05' }), TODAY);
      expect(dates(billId)).toEqual(['2027-03-05']);
      repo.markPaid(occurrenceId, { paidOn: '2027-03-05', amountCents: 32000 }, '2027-03-05');
      expect(dates(billId)).toEqual(['2027-03-05', '2028-03-05']);

      const leap = repo.createBill(bill({ recurrence: 'yearly', nextDueOn: '2028-02-29' }), '2028-02-01');
      expect(dates(leap.billId)).toEqual(['2028-02-29']);
      repo.markPaid(leap.occurrenceId, { paidOn: '2028-02-29', amountCents: 2999 }, '2028-02-29');
      expect(dates(leap.billId)).toEqual(['2028-02-29', '2029-02-28']);
    });
  });

  describe('parcours 4 : montant variable', () => {
    it('conserve une échéance sans montant (null, jamais 0)', () => {
      const { billId } = repo.createBill(bill({ name: 'Électricité', expectedAmountCents: null, recurrence: 'none', nextDueOn: '2026-11-20' }), TODAY);
      expect(active(billId)).toMatchObject([{ amountCents: null }]);
      expect(allBills()[0].expectedAmountCents).toBeNull();
    });

    it('au paiement, enregistre le montant réellement payé, différent du prévu', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ expectedAmountCents: 2999 }), TODAY);
      repo.markPaid(occurrenceId, { paidOn: '2026-11-12', amountCents: 3150 }, '2026-11-12');
      expect(active(billId)[0]).toMatchObject({ amountCents: 2999, paidAmountCents: 3150 });
    });

    it('permet de payer sans connaître le montant : il reste non noté', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ expectedAmountCents: null }), TODAY);
      repo.markPaid(occurrenceId, { paidOn: '2026-11-12', amountCents: null }, '2026-11-12');
      expect(active(billId)[0]).toMatchObject({ paidOn: '2026-11-12', paidAmountCents: null });
    });

    it('accepte de grands montants et refuse zéro, négatif ou démesuré', () => {
      const { occurrenceId } = repo.createBill(bill({ expectedAmountCents: MAX_BILL_AMOUNT_CENTS }), TODAY);
      expect(() => repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: MAX_BILL_AMOUNT_CENTS }, TODAY)).not.toThrow();
      expect(() => repo.createBill(bill({ expectedAmountCents: 0 }), TODAY)).toThrow(RangeError);
      expect(() => repo.createBill(bill({ expectedAmountCents: -100 }), TODAY)).toThrow(RangeError);
      expect(() => repo.createBill(bill({ expectedAmountCents: 10.5 }), TODAY)).toThrow(RangeError);
      expect(() => repo.createBill(bill({ expectedAmountCents: MAX_BILL_AMOUNT_CENTS + 1 }), TODAY)).toThrow(RangeError);
    });
  });

  describe('validation', () => {
    it('refuse nom vide ou trop long, date invalide, récurrence inconnue, sans rien écrire', () => {
      expect(() => repo.createBill(bill({ name: '   ' }), TODAY)).toThrow(RangeError);
      expect(() => repo.createBill(bill({ name: 'x'.repeat(MAX_BILL_NAME_LENGTH + 1) }), TODAY)).toThrow(RangeError);
      expect(() => repo.createBill(bill({ nextDueOn: '2026-02-30' }), TODAY)).toThrow(RangeError);
      expect(() => repo.createBill(bill({ recurrence: 'weekly' as never }), TODAY)).toThrow(RangeError);
      expect(() => repo.createBill(bill({ note: 'x'.repeat(500) }), TODAY)).toThrow(RangeError);
      expect(allBills()).toEqual([]);
      expect(occurrences()).toEqual([]);
    });

    it('nettoie le nom et la note', () => {
      repo.createBill(bill({ name: '  Assurance   auto ', note: '  contrat 12  ' }), TODAY);
      expect(allBills()[0]).toMatchObject({ name: 'Assurance auto', note: 'contrat 12' });
    });

    it('refuse une date de paiement future ou invalide, sans modifier l\'échéance', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      expect(() => repo.markPaid(occurrenceId, { paidOn: '2026-11-02', amountCents: 100 }, TODAY)).toThrow(RangeError);
      expect(() => repo.markPaid(occurrenceId, { paidOn: '2026-02-30', amountCents: 100 }, TODAY)).toThrow(RangeError);
      expect(() => repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 0 }, TODAY)).toThrow(RangeError);
      expect(active(billId)[0].paidOn).toBeNull();
    });

    it('refuse de payer une échéance inconnue ou supprimée', () => {
      expect(() => repo.markPaid('inconnue', { paidOn: TODAY, amountCents: null }, TODAY)).toThrow('Échéance introuvable');
      const { billId, occurrenceId } = repo.createBill(bill({ recurrence: 'none' }), TODAY);
      repo.deleteBill(billId);
      expect(() => repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: null }, TODAY)).toThrow('Échéance introuvable');
    });
  });

  describe('génération idempotente', () => {
    it('ne duplique rien quand on la relance, ni après un redémarrage', () => {
      const { billId } = repo.createBill(bill(), TODAY);
      const before = active(billId);
      expect(repo.ensureOccurrences(TODAY)).toBe(0);
      expect(repo.ensureOccurrences(TODAY)).toBe(0);
      const restarted = loadRepository(database);
      expect(restarted.ensureOccurrences(TODAY)).toBe(0);
      expect(active(billId)).toEqual(before);
    });

    it('ajoute les échéances manquantes quand le temps passe, sans toucher aux anciennes', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      repo.markPaid(occurrenceId, { paidOn: '2026-11-12', amountCents: 2999 }, '2026-11-12');
      const added = repo.ensureOccurrences('2026-12-20');
      expect(added).toBe(1);
      expect(dates(billId)).toEqual(['2026-11-12', '2026-12-12', '2027-01-12', '2027-02-12', '2027-03-12']);
      expect(active(billId)[0].paidOn).toBe('2026-11-12');
    });

    it('l\'index unique interdit deux échéances à la même date', () => {
      const { billId } = repo.createBill(bill(), TODAY);
      const duplicate = () =>
        database.sqlite
          .prepare(
            "INSERT INTO bill_occurrences (id, user_id, bill_id, due_on, created_at, updated_at) VALUES ('x','local',?,'2026-11-12','2026-11-01T00:00:00.000Z','2026-11-01T00:00:00.000Z')",
          )
          .run(billId);
      expect(duplicate).toThrow();
    });

    it('les contraintes de la base refusent un montant nul ou un montant payé sans paiement', () => {
      const { billId } = repo.createBill(bill({ recurrence: 'none' }), TODAY);
      const run = (sql: string) => () => database.sqlite.prepare(sql).run(billId);
      expect(run("UPDATE bill_occurrences SET amount_cents = 0 WHERE bill_id = ?")).toThrow();
      expect(run("UPDATE bill_occurrences SET paid_amount_cents = 500 WHERE bill_id = ?")).toThrow();
      expect(run("UPDATE bills SET recurrence = 'weekly' WHERE id = ?")).toThrow();
    });
  });

  describe('paiement, correction et annulation', () => {
    it('corrige un paiement déjà déclaré', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      repo.markPaid(occurrenceId, { paidOn: '2026-11-12', amountCents: 2999 }, '2026-11-12');
      repo.markPaid(occurrenceId, { paidOn: '2026-11-11', amountCents: 3100 }, '2026-11-11');
      expect(active(billId)[0]).toMatchObject({ paidOn: '2026-11-11', paidAmountCents: 3100 });
      expect(active(billId)).toHaveLength(4);
    });

    it('rouvre une échéance payée par erreur sans perdre la facture', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 2999 }, TODAY);
      repo.reopenOccurrence(occurrenceId);
      expect(active(billId)[0]).toMatchObject({ id: occurrenceId, paidOn: null, paidAmountCents: null, amountCents: 2999 });
      expect(allBills()).toHaveLength(1);
      repo.reopenOccurrence(occurrenceId); // déjà ouverte : sans effet
      expect(active(billId)[0].paidOn).toBeNull();
    });

    it('ne modifie jamais les autres échéances', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      const before = active(billId).slice(1);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 100 }, TODAY);
      repo.reopenOccurrence(occurrenceId);
      expect(active(billId).slice(1)).toEqual(before);
    });
  });

  describe('modification d\'une récurrence', () => {
    it('le nouveau montant s\'applique aux échéances à venir, pas aux payées ni aux retards', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ nextDueOn: '2026-09-12' }), '2026-09-01'); // sept., oct., nov., déc., …
      repo.markPaid(occurrenceId, { paidOn: '2026-09-12', amountCents: 2999 }, '2026-09-12');
      repo.updateBill(billId, bill({ expectedAmountCents: 3500, nextDueOn: '2026-10-12' }), TODAY);
      const rows = active(billId);
      expect(rows.find((row) => row.dueOn === '2026-09-12')).toMatchObject({ paidOn: '2026-09-12', paidAmountCents: 2999, amountCents: 2999 });
      expect(rows.find((row) => row.dueOn === '2026-10-12')).toMatchObject({ paidOn: null, amountCents: 2999 }); // en retard : garde son montant
      expect(rows.find((row) => row.dueOn === '2026-11-12')).toMatchObject({ amountCents: 3500 });
      expect(rows.find((row) => row.dueOn === '2026-12-12')).toMatchObject({ amountCents: 3500 });
      expect(allBills()[0].expectedAmountCents).toBe(3500);
    });

    it('cas 4 : l\'assurance augmente, l\'historique payé est intact', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ name: 'Assurance', recurrence: 'yearly', nextDueOn: '2026-11-05', expectedAmountCents: 32000 }), '2026-11-01');
      repo.markPaid(occurrenceId, { paidOn: '2026-11-05', amountCents: 32000 }, '2026-11-05');
      repo.updateBill(billId, bill({ name: 'Assurance', recurrence: 'yearly', nextDueOn: '2027-11-05', expectedAmountCents: 34500 }), '2026-11-06');
      const rows = active(billId);
      expect(rows[0]).toMatchObject({ dueOn: '2026-11-05', paidOn: '2026-11-05', paidAmountCents: 32000, amountCents: 32000 });
      expect(rows[1]).toMatchObject({ dueOn: '2027-11-05', paidOn: null, amountCents: 34500 });
    });

    it('un changement de nom ou de note ne réécrit aucun paiement', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 2999 }, TODAY);
      const paidBefore = active(billId)[0];
      repo.updateBill(billId, bill({ name: 'Fibre', note: 'nouvelle offre', nextDueOn: '2026-12-12' }), TODAY);
      expect(allBills()[0]).toMatchObject({ name: 'Fibre', note: 'nouvelle offre' });
      expect(active(billId)[0]).toEqual(paidBefore);
    });

    it('changer la date reconstruit le calendrier non payé sans doublon', () => {
      const { billId } = repo.createBill(bill(), TODAY);
      const returned = repo.updateBill(billId, bill({ nextDueOn: '2026-11-15' }), TODAY);
      expect(dates(billId)).toEqual(['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15']);
      expect(active(billId)[0].id).toBe(returned);
      expect(allBills()[0].anchorDate).toBe('2026-11-15');
      // le même calendrier plus tard : les échéances retirées sont rétablies, jamais dupliquées
      repo.updateBill(billId, bill({ nextDueOn: '2026-11-12' }), TODAY);
      expect(dates(billId)).toEqual(['2026-11-12', '2026-12-12', '2027-01-12', '2027-02-12']);
      expect(occurrences(billId).filter((row) => row.dueOn === '2026-11-12')).toHaveLength(1);
    });

    it('passe de mensuelle à ponctuelle : plus d\'échéances futures, l\'historique reste', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 2999 }, TODAY);
      repo.updateBill(billId, bill({ recurrence: 'none', nextDueOn: '2026-12-12' }), TODAY);
      expect(active(billId).map((row) => [row.dueOn, row.paidOn !== null])).toEqual([
        ['2026-11-12', true],
        ['2026-12-12', false],
      ]);
    });

    it('remplit le montant d\'une échéance inconnue (électricité) sans toucher au reste', () => {
      const { billId } = repo.createBill(bill({ expectedAmountCents: null, recurrence: 'none', nextDueOn: '2026-11-20' }), TODAY);
      repo.updateBill(billId, bill({ expectedAmountCents: 8450, recurrence: 'none', nextDueOn: '2026-11-20' }), TODAY);
      expect(active(billId)[0].amountCents).toBe(8450);
    });

    it('tout payé (facture ponctuelle) : seuls nom, note et montant changent', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ recurrence: 'none' }), TODAY);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 2999 }, TODAY);
      const next = repo.updateBill(billId, bill({ name: 'Autre', recurrence: 'monthly', nextDueOn: '2030-01-01' }), TODAY);
      expect(next).toBeNull();
      expect(allBills()[0]).toMatchObject({ name: 'Autre', recurrence: 'none', anchorDate: '2026-11-12' });
      expect(active(billId)).toHaveLength(1);
    });

    it('refuse de modifier une facture inconnue ou supprimée', () => {
      expect(() => repo.updateBill('inconnue', bill(), TODAY)).toThrow('Facture introuvable');
    });
  });

  describe('arrêt de la récurrence', () => {
    it('empêche toute nouvelle échéance et garde payées et dues', () => {
      const { billId, occurrenceId } = repo.createBill(bill({ nextDueOn: '2026-09-12' }), '2026-09-01');
      repo.markPaid(occurrenceId, { paidOn: '2026-09-12', amountCents: 2999 }, '2026-09-12');
      expect(repo.stopRecurrence(billId, TODAY)).toBe('stopped');
      // payée (sept.) + en retard non payée (oct.) conservées ; nov. et suivantes, pas encore dues, retirées
      expect(dates(billId)).toEqual(['2026-09-12', '2026-10-12']);
      expect(allBills()[0].stoppedOn).toBe(TODAY);
      repo.ensureOccurrences('2027-06-01');
      expect(dates(billId)).toEqual(['2026-09-12', '2026-10-12']);
    });

    it('cas 5 : résilier un abonnement garde tout l\'historique', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 2999 }, TODAY);
      expect(repo.stopRecurrence(billId, TODAY)).toBe('stopped');
      expect(active(billId)).toMatchObject([{ dueOn: '2026-11-12', paidOn: TODAY }]);
    });

    it('une facture qui n\'a ni payé ni dû est supprimée avec sa récurrence', () => {
      const { billId } = repo.createBill(bill(), TODAY);
      expect(repo.stopRecurrence(billId, TODAY)).toBe('deleted');
      expect(allBills()[0].deletedAt).not.toBeNull();
      expect(active(billId)).toEqual([]);
    });

    it('refuse d\'arrêter une facture ponctuelle ou déjà arrêtée', () => {
      const once = repo.createBill(bill({ recurrence: 'none' }), TODAY);
      expect(() => repo.stopRecurrence(once.billId, TODAY)).toThrow('Aucune récurrence à arrêter');
      const series = repo.createBill(bill({ nextDueOn: '2026-10-12' }), TODAY);
      repo.stopRecurrence(series.billId, TODAY);
      expect(() => repo.stopRecurrence(series.billId, TODAY)).toThrow('Aucune récurrence à arrêter');
    });

    it('modifier une série arrêtée n\'en relance pas le calendrier', () => {
      const { billId } = repo.createBill(bill({ nextDueOn: '2026-10-12' }), '2026-10-01');
      repo.stopRecurrence(billId, TODAY);
      repo.updateBill(billId, bill({ nextDueOn: '2027-05-05', recurrence: 'yearly', expectedAmountCents: 4000 }), TODAY);
      expect(allBills()[0]).toMatchObject({ recurrence: 'monthly', anchorDate: '2026-10-12', stoppedOn: TODAY, expectedAmountCents: 4000 });
      expect(dates(billId)).toEqual(['2026-10-12']);
    });
  });

  describe('suppression', () => {
    it('supprime la facture et toutes ses échéances, paiements compris, en une transaction', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 2999 }, TODAY);
      repo.deleteBill(billId);
      expect(allBills()[0].deletedAt).not.toBeNull();
      expect(active(billId)).toEqual([]);
      expect(occurrences(billId)).toHaveLength(4); // suppression logique : les lignes restent
      expect(repo.ensureOccurrences('2027-06-01')).toBe(0); // une facture supprimée ne se régénère pas
      expect(active(billId)).toEqual([]);
    });

    it('refuse de supprimer deux fois', () => {
      const { billId } = repo.createBill(bill(), TODAY);
      repo.deleteBill(billId);
      expect(() => repo.deleteBill(billId)).toThrow('Facture introuvable');
    });
  });

  describe('séparation avec les finances', () => {
    it('payer, rouvrir, modifier, arrêter et supprimer ne créent aucune opération et ne touchent pas aux budgets', () => {
      database.sqlite
        .prepare(
          "INSERT INTO transactions (id, user_id, type, amount_cents, payment_method, occurred_on, created_at, updated_at) VALUES ('t1','local','expense',4250,'card','2026-10-31','2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')",
        )
        .run();
      database.sqlite
        .prepare(
          "INSERT INTO categories (id, user_id, kind, name_key, icon, color, sort_order, archived, created_at, updated_at) VALUES ('c1','local','expense','categories.groceries','groceries','#112233',0,0,'2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')",
        )
        .run();
      database.sqlite
        .prepare(
          "INSERT INTO budgets (id, user_id, category_id, month, amount_cents, created_at, updated_at) VALUES ('b1','local','c1','2026-11',30000,'2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')",
        )
        .run();
      const snapshot = () => ({
        transactions: database.db.select().from(transactions).all(),
        budgets: database.db.select().from(budgets).all(),
        balance: database.sqlite.prepare('SELECT COUNT(*) AS n FROM account_snapshots').get(),
      });
      const before = snapshot();

      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 2999 }, TODAY);
      repo.reopenOccurrence(occurrenceId);
      repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 3100 }, TODAY);
      repo.updateBill(billId, bill({ expectedAmountCents: 4000, nextDueOn: '2026-12-20' }), TODAY);
      repo.ensureOccurrences('2027-03-01');
      repo.stopRecurrence(billId, '2027-03-01');
      repo.deleteBill(billId);

      expect(snapshot()).toEqual(before);
    });
  });

  describe('atomicité', () => {
    it('refuse une date impossible avant toute écriture', () => {
      expect(() => repo.createBill(bill({ nextDueOn: '2026-02-31' }), TODAY)).toThrow();
      expect(allBills()).toEqual([]);
      expect(occurrences()).toEqual([]);
    });

    it('une erreur en cours de création annule tout : pas de facture sans échéances', () => {
      database.sqlite.exec("CREATE TRIGGER fail_insert BEFORE INSERT ON bill_occurrences BEGIN SELECT RAISE(ABORT, 'panne'); END;");
      expect(() => repo.createBill(bill(), TODAY)).toThrow();
      expect(allBills()).toEqual([]);
      expect(occurrences()).toEqual([]);
    });

    it('une erreur pendant un paiement ne laisse rien de modifié', () => {
      const { billId, occurrenceId } = repo.createBill(bill(), TODAY);
      const before = active(billId);
      database.sqlite.exec("CREATE TRIGGER fail_update BEFORE UPDATE ON bill_occurrences BEGIN SELECT RAISE(ABORT, 'panne'); END;");
      expect(() => repo.markPaid(occurrenceId, { paidOn: TODAY, amountCents: 100 }, TODAY)).toThrow();
      expect(active(billId)).toEqual(before);
    });

    it('une erreur pendant la suppression ne supprime rien', () => {
      const { billId } = repo.createBill(bill(), TODAY);
      database.sqlite.exec("CREATE TRIGGER fail_bill_update BEFORE UPDATE ON bills BEGIN SELECT RAISE(ABORT, 'panne'); END;");
      expect(() => repo.deleteBill(billId)).toThrow();
      expect(allBills()[0].deletedAt).toBeNull();
      expect(active(billId)).toHaveLength(4); // les échéances n'ont pas été supprimées à moitié
    });
  });
});

describe('persistance et migration', () => {
  let folder: string;

  beforeEach(() => {
    folder = mkdtempSync(path.join(tmpdir(), 'sovmilo-bills-'));
  });
  afterEach(() => rmSync(folder, { recursive: true, force: true }));

  it('retrouve factures, échéances, paiements et montants inconnus après un redémarrage', () => {
    const file = path.join(folder, 'sovmilo.db');

    const first = openTestDatabase(file);
    const repo = loadRepository(first);
    const internet = repo.createBill(bill(), TODAY);
    const power = repo.createBill(bill({ name: 'Électricité', expectedAmountCents: null, recurrence: 'none', nextDueOn: '2026-11-20' }), TODAY);
    repo.markPaid(internet.occurrenceId, { paidOn: '2026-11-12', amountCents: 3150 }, '2026-11-12');
    first.close();

    const second = openTestDatabase(file); // nouvelle ouverture du même fichier
    const rows = second.db.select().from(billOccurrences).orderBy(asc(billOccurrences.dueOn)).all();
    expect(rows.find((row) => row.id === internet.occurrenceId)).toMatchObject({ paidOn: '2026-11-12', paidAmountCents: 3150, amountCents: 2999 });
    expect(rows.find((row) => row.billId === power.billId)).toMatchObject({ amountCents: null, paidOn: null });
    expect(rows).toHaveLength(5);

    const again = loadRepository(second);
    expect(again.ensureOccurrences(TODAY)).toBe(0); // rien de dupliqué après redémarrage
    again.reopenOccurrence(internet.occurrenceId);
    expect(second.db.select().from(billOccurrences).where(eq(billOccurrences.id, internet.occurrenceId)).get()?.paidOn).toBeNull();
    second.close();
  });

  it('la migration des factures est purement additive (aucun DROP, ALTER, DELETE ni UPDATE)', () => {
    const migrationsFolder = path.join(__dirname, '..', '..', 'db', 'migrations');
    const journal = JSON.parse(readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as { entries: { tag: string }[] };
    const sql = readFileSync(path.join(migrationsFolder, `${journal.entries[3].tag}.sql`), 'utf8');
    expect(sql).toMatch(/CREATE TABLE `bills`/);
    expect(sql).toMatch(/CREATE TABLE `bill_occurrences`/);
    const statements = sql.replace(/ON (UPDATE|DELETE) no action/gi, '');
    expect(statements).not.toMatch(/\b(DROP|ALTER|DELETE|UPDATE|INSERT)\b/i);
    expect(sql).not.toMatch(/\b(transactions|budgets|categories|account_snapshots|profiles|shopping_lists|shopping_items)\b/i);
  });

  it('appliquer la migration sur une base existante conserve les données', () => {
    const file = path.join(folder, 'existing.db');
    const legacy = new DatabaseSync(file);
    applyMigrations(legacy, 3); // l'application avant les factures (courses comprises)
    legacy
      .prepare(
        "INSERT INTO transactions (id, user_id, type, amount_cents, payment_method, occurred_on, created_at, updated_at) VALUES ('t1','local','expense',4250,'card','2026-10-31','2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')",
      )
      .run();
    legacy.prepare("INSERT INTO shopping_lists (id, user_id, name, created_at, updated_at) VALUES ('l1','local','Courses','2026-10-31T10:00:00.000Z','2026-10-31T10:00:00.000Z')").run();
    applyMigrations(legacy, 4, 3); // mise à jour : seule la nouvelle migration est jouée
    expect(() => legacy.prepare('SELECT * FROM bill_occurrences').all()).not.toThrow();
    expect(legacy.prepare('SELECT amount_cents FROM transactions WHERE id = ?').get('t1')).toMatchObject({ amount_cents: 4250 });
    expect(legacy.prepare('SELECT name FROM shopping_lists WHERE id = ?').get('l1')).toMatchObject({ name: 'Courses' });
    legacy.close();
  });
});
