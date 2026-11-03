import { readFileSync } from 'node:fs';

import { MAX_BACKUP_BYTES, BackupError, type BackupErrorCode, type BackupPreferences } from './format';
import { createBackup } from './create';
import { populate } from './fixtures';
import { inspectBackup, stampBackup, type BackupEnv } from './inspect';
import { discardInspection, restoreBackup, type RestoreOutcome } from './restore';
import { createHarness, dumpTables, NodeConnection, type NodeBackupHarness } from './test-support';

/*
 * Sauvegarde et restauration sur une VRAIE base SQLite (vraies migrations Drizzle, vrais dépôts de l'application). Ces tests
 * comparent les DONNÉES elles-mêmes (toutes les lignes, tous les champs), pas seulement des compteurs. L'API native d'Expo
 * (`backupDatabaseAsync`) est émulée : elle ne se vérifie que sur un téléphone (docs/backup-restore.md § 9).
 */

// `require` est voulu ici : la fabrique de `jest.mock` ne peut pas référencer un import ordinaire.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const PREFS: BackupPreferences = { 'sovmilo.languagePreference': 'ru', 'sovmilo.theme': 'dark' };

let harness: NodeBackupHarness;
let env: BackupEnv;

beforeEach(() => {
  harness = createHarness();
  env = harness.env;
});
afterEach(() => harness.dispose());

async function populatedApp(name = 'source.db'): Promise<NodeConnection> {
  const connection = await harness.openApplicationDatabase(name);
  populate(connection);
  return connection;
}

async function expectRejected(bytes: Uint8Array, code: BackupErrorCode) {
  await expect(inspectBackup(bytes, env)).rejects.toMatchObject({ name: 'BackupError', code });
}

/** Réécrit un fichier de sauvegarde valide après modification (pour fabriquer des fichiers invalides RÉALISTES). */
async function tamper(bytes: Uint8Array, sql: string): Promise<Uint8Array> {
  const connection = await env.openFromBytes(bytes);
  await connection.execAsync(sql);
  const result = await connection.serializeAsync();
  await connection.closeAsync();
  return result;
}

function restoreDeps(live: NodeConnection, applied: BackupPreferences[] = [], written: Uint8Array[] = []) {
  return {
    env,
    live,
    writeSafetyCopy: async (bytes: Uint8Array) => {
      written.push(bytes);
    },
    applyPreferences: (preferences: BackupPreferences) => {
      applied.push(preferences);
    },
  };
}

describe('création d\'une sauvegarde', () => {
  it('produit un fichier identifiable, vérifié, avec des compteurs lus dans la base, sans modifier la base source', async () => {
    const source = await populatedApp();
    const before = dumpTables(source.sqlite);
    const backup = await createBackup(source, env, PREFS);

    expect(backup.fileName).toMatch(/^sovmilo-backup-\d{4}-\d{2}-\d{2}-\d{4}\.db$/);
    expect(backup.meta).toMatchObject({ appId: 'sovmilo', formatVersion: 1, appVersion: '1.0.0', schemaVersion: 5, createdAt: '2026-11-02T14:30:00.000Z' });
    expect(backup.counts).toEqual({
      transactions: 9,
      categories: 15,
      budgets: 4,
      accountSnapshots: 2,
      shoppingLists: 2,
      shoppingItems: 3,
      bills: 3,
      billOccurrences: expect.any(Number),
      savingsGoals: 3,
      savingsMovements: 4,
    });
    expect(backup.counts.billOccurrences).toBeGreaterThanOrEqual(3);
    // Identité dans l'en-tête SQLite : « SOVM » aux octets 68 à 71.
    expect(Array.from(backup.bytes.slice(68, 72))).toEqual([0x53, 0x4f, 0x56, 0x4d]);
    // La base source est strictement inchangée.
    expect(dumpTables(source.sqlite)).toEqual(before);
    expect(source.sqlite.prepare('SELECT name FROM sqlite_master WHERE name LIKE ?').all('sovmilo_backup_%')).toEqual([]);
  });

  it('une seconde sauvegarde après de nouvelles données est indépendante de la première', async () => {
    const source = await populatedApp();
    const first = await createBackup(source, env, PREFS);
    source.sqlite.exec("UPDATE transactions SET note = 'modifiée' WHERE note = 'Salaire'");
    const second = await createBackup(source, env, PREFS);
    expect(second.bytes).not.toEqual(first.bytes);
    const reopened = await inspectBackup(first.bytes, env);
    const rows = await reopened.connection.getAllAsync<{ note: string }>("SELECT note FROM transactions WHERE note IN ('Salaire', 'modifiée')");
    expect(rows).toEqual([{ note: 'Salaire' }]);
    await discardInspection(reopened);
  });

  it('refuse de « sauvegarder » une base déjà incohérente (clé étrangère orpheline)', async () => {
    const source = await populatedApp();
    source.sqlite.exec('PRAGMA foreign_keys = OFF');
    source.sqlite.exec("UPDATE transactions SET category_id = 'inexistante' WHERE note = 'Salaire'");
    await expect(createBackup(source, env, PREFS)).rejects.toMatchObject({ code: 'sourceDamaged' });
  });

  it('une panne de lecture de la base est une erreur, jamais un faux succès', async () => {
    const source = await populatedApp();
    const before = dumpTables(source.sqlite);
    source.serializeAsync = async () => {
      throw new Error('espace insuffisant');
    };
    await expect(createBackup(source, env, PREFS)).rejects.toMatchObject({ code: 'unreadable' });
    expect(dumpTables(source.sqlite)).toEqual(before);
  });

  it('une vérification qui échoue après la création n\'annonce pas de succès', async () => {
    const source = await populatedApp();
    const failing: BackupEnv = {
      ...env,
      openFromBytes: (() => {
        let calls = 0;
        return async (bytes: Uint8Array) => {
          calls += 1;
          if (calls === 2) throw new Error('mémoire insuffisante'); // la relecture du fichier produit
          return env.openFromBytes(bytes);
        };
      })(),
    };
    await expect(createBackup(source, failing, PREFS)).rejects.toMatchObject({ code: 'verification' });
  });
});

describe('aller-retour : les données restaurées sont identiques', () => {
  it('restaure dans une application vide : toutes les lignes, tous les champs, les préférences', async () => {
    const source = await populatedApp();
    const expected = dumpTables(source.sqlite);
    const backup = await createBackup(source, env, PREFS);

    const target = await harness.openApplicationDatabase('cible.db');
    const inspected = await inspectBackup(backup.bytes, env);
    expect(inspected.migrated).toBe(false);
    expect(inspected.counts).toEqual(backup.counts);
    const applied: BackupPreferences[] = [];
    const outcome = await restoreBackup(inspected, restoreDeps(target, applied));
    await discardInspection(inspected);

    expect(outcome).toEqual({ status: 'restored', counts: backup.counts });
    expect(dumpTables(target.sqlite)).toEqual(expected);
    expect(applied).toEqual([PREFS]);
    // Aucune trace de l'identité de sauvegarde dans la base de l'application.
    expect(target.sqlite.prepare('SELECT name FROM sqlite_master WHERE name LIKE ?').all('sovmilo_backup_%')).toEqual([]);
    expect((target.sqlite.prepare('PRAGMA application_id').get() as { application_id: number }).application_id).toBe(0);
    expect((target.sqlite.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check).toBe('ok');
    expect(target.sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('montants exacts et relations conservés (centimes, dates, catégories, objectifs)', async () => {
    const source = await populatedApp();
    const backup = await createBackup(source, env, PREFS);
    const target = await harness.openApplicationDatabase('cible.db');
    const inspected = await inspectBackup(backup.bytes, env);
    await restoreBackup(inspected, restoreDeps(target));
    await discardInspection(inspected);

    const sum = (db: NodeConnection, sql: string) => db.sqlite.prepare(sql).get();
    for (const query of [
      "SELECT SUM(amount_cents) AS total, COUNT(*) AS n, MIN(occurred_on) AS first, MAX(occurred_on) AS last FROM transactions",
      "SELECT SUM(amount_cents) AS total FROM budgets",
      "SELECT SUM(real_balance_cents) AS total FROM account_snapshots",
      "SELECT SUM(amount_cents) AS total FROM savings_movements",
      "SELECT t.note, c.name_key, c.custom_name FROM transactions t JOIN categories c ON c.id = t.category_id ORDER BY t.note",
    ]) {
      expect(sum(target, query)).toEqual(sum(source, query));
    }
    expect(sum(target, "SELECT amount_cents FROM transactions WHERE note = 'Продукты и «кафе»'")).toEqual({ amount_cents: 99_999_999 });
    expect(sum(target, 'SELECT real_balance_cents FROM account_snapshots ORDER BY real_balance_cents LIMIT 1')).toEqual({ real_balance_cents: -12_345 });
    // Ordre personnalisé des objectifs et archives conservés.
    const order = (db: NodeConnection) => db.sqlite.prepare('SELECT name, sort_order, archived_at IS NOT NULL AS archived FROM savings_goals ORDER BY archived_at IS NOT NULL, sort_order').all();
    expect(order(target)).toEqual(order(source));
  });

  it('remplace des données existantes (aucune fusion) et garde une copie de sécurité fidèle des anciennes', async () => {
    const source = await populatedApp('source.db');
    const backup = await createBackup(source, env, PREFS);
    const target = await populatedApp('cible.db');
    target.sqlite.exec("UPDATE transactions SET note = 'données locales' WHERE note = 'Salaire'");
    target.sqlite.exec("INSERT INTO shopping_lists (id, user_id, name, created_at, updated_at) VALUES ('seule-ici', 'local', 'Liste locale', 'x', 'x')");
    const localBefore = dumpTables(target.sqlite);

    const written: Uint8Array[] = [];
    const inspected = await inspectBackup(backup.bytes, env);
    const outcome = await restoreBackup(inspected, restoreDeps(target, [], written));
    await discardInspection(inspected);

    expect(outcome.status).toBe('restored');
    expect(dumpTables(target.sqlite)).toEqual(dumpTables(source.sqlite));
    expect(target.sqlite.prepare("SELECT id FROM shopping_lists WHERE id = 'seule-ici'").all()).toEqual([]);
    // La copie de sécurité contient exactement les anciennes données locales.
    expect(written).toHaveLength(1);
    const safety = await env.openFromBytes(written[0]);
    expect(dumpTables((safety as NodeConnection).sqlite)).toEqual(localBefore);
  });

  it('restaurer deux fois la même sauvegarde donne le même résultat', async () => {
    const source = await populatedApp();
    const backup = await createBackup(source, env, PREFS);
    const target = await harness.openApplicationDatabase('cible.db');
    for (let i = 0; i < 2; i += 1) {
      const inspected = await inspectBackup(backup.bytes, env);
      expect((await restoreBackup(inspected, restoreDeps(target))).status).toBe('restored');
      await discardInspection(inspected);
    }
    expect(dumpTables(target.sqlite)).toEqual(dumpTables(source.sqlite));
  });
});

describe('fichiers refusés avant toute modification', () => {
  let valid: Uint8Array;
  let live: NodeConnection;
  let liveBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    const source = await populatedApp('source.db');
    valid = (await createBackup(source, env, PREFS)).bytes;
    live = await populatedApp('courante.db');
    liveBefore = dumpTables(live.sqlite);
  });
  afterEach(() => {
    // Dans tous les cas, la base courante n'a pas bougé.
    expect(dumpTables(live.sqlite)).toEqual(liveBefore);
  });

  it('fichier vide', async () => expectRejected(new Uint8Array(0), 'empty'));
  it('mauvais fichier (texte)', async () => expectRejected(new TextEncoder().encode('Ceci est une photo de chat. '.repeat(20)), 'notSqlite'));
  it('fichier trop volumineux', async () => expectRejected(new Uint8Array(MAX_BACKUP_BYTES + 1), 'tooLarge'));
  it('fichier tronqué (copie interrompue)', async () => expectRejected(valid.slice(0, Math.floor(valid.length / 2)), 'truncated'));

  it('fichier corrompu au milieu des données', async () => {
    const damaged = valid.slice();
    for (let i = 4096 * 3; i < 4096 * 3 + 600; i += 1) damaged[i] = 0xff;
    await expect(inspectBackup(damaged, env)).rejects.toBeInstanceOf(BackupError);
  });

  it('base SQLite valide mais étrangère à Sovmilo', async () => {
    const foreign = await env.openFromBytes(valid);
    await foreign.execAsync('DROP TABLE sovmilo_backup_meta; DROP TABLE sovmilo_backup_prefs; PRAGMA application_id = 0');
    const bytes = await foreign.serializeAsync();
    await expectRejected(bytes, 'notSovmilo');
  });

  it('identité Sovmilo dans l\'en-tête mais métadonnées absentes', async () => expectRejected(await tamper(valid, 'DROP TABLE sovmilo_backup_meta'), 'notSovmilo'));
  it('autre application', async () => expectRejected(await tamper(valid, "UPDATE sovmilo_backup_meta SET value = 'autre' WHERE key = 'app_id'"), 'notSovmilo'));
  it('version de format inconnue', async () => expectRejected(await tamper(valid, "UPDATE sovmilo_backup_meta SET value = '2' WHERE key = 'format_version'"), 'unknownFormat'));

  it('schéma plus récent que l\'application (jamais de migration à l\'envers)', async () => {
    const future = await tamper(
      valid,
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('', 9999999999999); UPDATE sovmilo_backup_meta SET value = '6' WHERE key = 'schema_version'",
    );
    await expectRejected(future, 'futureSchema');
  });

  it('migrations enregistrées qui ne sont pas celles de Sovmilo', async () => expectRejected(await tamper(valid, 'UPDATE __drizzle_migrations SET created_at = 1 WHERE created_at = 1793386204518'), 'unknownSchema'));
  it('version de schéma des métadonnées incohérente', async () => expectRejected(await tamper(valid, "UPDATE sovmilo_backup_meta SET value = '4' WHERE key = 'schema_version'"), 'inconsistent'));
  it('clé étrangère invalide', async () => {
    const orphan = await tamper(valid, "PRAGMA foreign_keys = OFF; UPDATE transactions SET category_id = 'fantome' WHERE note = 'Salaire'");
    await expectRejected(orphan, 'inconsistent');
  });
  it('compteurs annoncés différents du contenu', async () => expectRejected(await tamper(valid, "DELETE FROM transactions WHERE note = 'Salaire'"), 'inconsistent'));
  it('déclencheur ou vue cachés dans la base (aucun SQL du fichier n\'est exécuté)', async () => {
    await expectRejected(await tamper(valid, 'CREATE TRIGGER piege AFTER INSERT ON transactions BEGIN DELETE FROM budgets; END'), 'unexpectedObjects');
    await expectRejected(await tamper(valid, 'CREATE VIEW voir AS SELECT * FROM transactions'), 'unexpectedObjects');
  });
  it('table inconnue ajoutée', async () => expectRejected(await tamper(valid, 'CREATE TABLE intrus (a INTEGER)'), 'unexpectedObjects'));
  it('colonne manquante dans une table de l\'application', async () => {
    const mutilated = await tamper(valid, 'ALTER TABLE savings_movements DROP COLUMN note');
    await expectRejected(mutilated, 'unknownSchema');
  });

  it('annulation par l\'utilisatrice : rien n\'est écrit, la copie validée est simplement fermée', async () => {
    const inspected = await inspectBackup(valid, env);
    await discardInspection(inspected);
    expect((inspected.connection as NodeConnection).closed).toBe(true);
  });
});

describe('anciennes sauvegardes (migration en avant, dans la copie isolée)', () => {
  const insertOld = (db: NodeConnection, count: number) => {
    db.sqlite.exec(
      "INSERT INTO categories (id, user_id, kind, name_key, icon, color, sort_order, archived, created_at, updated_at) VALUES ('c1', 'local', 'expense', 'groceries', 'x', '#000', 0, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');" +
        "INSERT INTO transactions (id, user_id, type, amount_cents, category_id, payment_method, occurred_on, note, created_at, updated_at) VALUES ('t1', 'local', 'expense', 1234, 'c1', 'card', '2026-01-02', 'Ancienne note', '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z')",
    );
    if (count >= 2) {
      db.sqlite.exec("INSERT INTO account_snapshots (id, user_id, real_balance_cents, recorded_at, created_at, updated_at) VALUES ('a1', 'local', -500, '2026-01-03T00:00:00.000Z', 'x', 'x')");
    }
  };

  async function olderBackup(count: number): Promise<{ bytes: Uint8Array; rows: unknown }> {
    const old = await harness.openOlderDatabase(count);
    insertOld(old, count);
    const rows = old.sqlite.prepare('SELECT id, amount_cents, occurred_on, note FROM transactions').all();
    const image = await env.openFromBytes(await old.serializeAsync());
    await stampBackup(
      image,
      {
        appId: 'sovmilo',
        formatVersion: 1,
        appVersion: '0.9.0',
        schemaVersion: count,
        schemaLastMigration: env.knownMigrations[count - 1],
        createdAt: '2026-01-05T10:00:00.000Z',
        counts: { transactions: 1, categories: 1, budgets: 0, accountSnapshots: count >= 2 ? 1 : 0, shoppingLists: 0, shoppingItems: 0, bills: 0, billOccurrences: 0, savingsGoals: 0, savingsMovements: 0 },
      },
      PREFS,
    );
    return { bytes: await image.serializeAsync(), rows };
  }

  it.each([1, 2, 3, 4])('schéma %i : migré vers le schéma courant, données conservées', async (count) => {
    const { bytes, rows } = await olderBackup(count);
    const inspected = await inspectBackup(bytes, env);
    expect(inspected.migrated).toBe(true);
    expect(inspected.originalSchemaVersion).toBe(count);
    expect(inspected.meta.appVersion).toBe('0.9.0');

    const target = await harness.openApplicationDatabase('cible.db');
    const outcome = await restoreBackup(inspected, restoreDeps(target));
    await discardInspection(inspected);
    expect(outcome.status).toBe('restored');
    expect(target.sqlite.prepare('SELECT id, amount_cents, occurred_on, note FROM transactions').all()).toEqual(rows);
    expect((target.sqlite.prepare('SELECT COUNT(*) AS n FROM __drizzle_migrations').get() as { n: number }).n).toBe(5);
    // Les tables ajoutées par les migrations existent, vides.
    expect(target.sqlite.prepare('SELECT COUNT(*) AS n FROM savings_goals').get()).toEqual({ n: 0 });
  });

  it('une migration qui échoue refuse la sauvegarde sans toucher à la base courante', async () => {
    const { bytes } = await olderBackup(2);
    const live = await populatedApp('courante.db');
    const before = dumpTables(live.sqlite);
    harness.injection.duringMigration = () => {
      throw new Error('migration impossible');
    };
    await expectRejected(bytes, 'migrationFailed');
    expect(dumpTables(live.sqlite)).toEqual(before);
  });
});

describe('échec pendant la restauration : les données précédentes survivent', () => {
  async function scenario() {
    const source = await populatedApp('source.db');
    const backup = await createBackup(source, env, PREFS);
    const live = await populatedApp('courante.db');
    live.sqlite.exec("UPDATE transactions SET note = 'avant restauration' WHERE note = 'Salaire'");
    const before = dumpTables(live.sqlite);
    const inspected = await inspectBackup(backup.bytes, env);
    return { backup, live, before, inspected, source };
  }

  it('erreur pendant le remplacement : retour arrière vérifié, préférences non appliquées', async () => {
    const { live, before, inspected } = await scenario();
    harness.injection.duringCopy = (index) => {
      if (index === 1) throw new Error('disque plein');
    };
    const applied: BackupPreferences[] = [];
    const outcome = await restoreBackup(inspected, restoreDeps(live, applied));
    await discardInspection(inspected);
    expect(outcome).toEqual({ status: 'rolledBack', cause: 'verification' });
    expect(dumpTables(live.sqlite)).toEqual(before);
    expect(applied).toEqual([]);
  });

  it('copie impossible dès le départ (base verrouillée)', async () => {
    const { live, before, inspected } = await scenario();
    harness.injection.beforeCopy = (_dest, index) => {
      if (index === 1) throw new Error('database is locked');
    };
    const outcome = await restoreBackup(inspected, restoreDeps(live));
    await discardInspection(inspected);
    expect(outcome.status).toBe('rolledBack');
    expect(dumpTables(live.sqlite)).toEqual(before);
  });

  it('remplacement « réussi » mais contenu incorrect : détecté, puis retour arrière', async () => {
    const { live, before, inspected } = await scenario();
    harness.injection.duringCopy = (index) => {
      if (index === 1) live.sqlite.exec('DELETE FROM transactions');
    };
    const applied: BackupPreferences[] = [];
    const outcome = await restoreBackup(inspected, restoreDeps(live, applied));
    await discardInspection(inspected);
    expect(outcome).toEqual({ status: 'rolledBack', cause: 'verification' });
    expect(dumpTables(live.sqlite)).toEqual(before);
    expect(applied).toEqual([]);
  });

  it('le retour arrière échoue aussi : annoncé comme tel, base inchangée (copie atomique), copie de sécurité écrite', async () => {
    const { live, before, inspected } = await scenario();
    harness.injection.beforeCopy = () => {
      throw new Error('stockage indisponible');
    };
    const written: Uint8Array[] = [];
    const outcome = await restoreBackup(inspected, restoreDeps(live, [], written));
    await discardInspection(inspected);
    expect(outcome.status).toBe('failed');
    expect(written).toHaveLength(1);
    expect(dumpTables(live.sqlite)).toEqual(before);
  });

  it('copie de sécurité impossible à écrire : la restauration est refusée AVANT toute modification', async () => {
    const { live, before, inspected } = await scenario();
    let copies = 0;
    harness.injection.beforeCopy = () => {
      copies += 1;
    };
    await expect(
      restoreBackup(inspected, { ...restoreDeps(live), writeSafetyCopy: async () => Promise.reject(new Error('espace insuffisant')) }),
    ).rejects.toMatchObject({ code: 'storage' });
    await discardInspection(inspected);
    expect(copies).toBe(0);
    expect(dumpTables(live.sqlite)).toEqual(before);
  });

  it('base courante illisible au moment de la copie de sécurité : refus avant modification', async () => {
    const { live, before, inspected } = await scenario();
    live.serializeAsync = async () => {
      throw new Error('lecture impossible');
    };
    await expect(restoreBackup(inspected, restoreDeps(live))).rejects.toBeInstanceOf(BackupError);
    await discardInspection(inspected);
    expect(dumpTables(live.sqlite)).toEqual(before);
  });

  it('erreur lors de l\'application des préférences : la restauration vérifiée est conservée', async () => {
    const { live, source, inspected } = await scenario();
    const outcome = await restoreBackup(inspected, {
      ...restoreDeps(live),
      applyPreferences: () => {
        throw new Error('stockage des préférences indisponible');
      },
    });
    await discardInspection(inspected);
    expect(outcome.status).toBe('restored');
    expect(dumpTables(live.sqlite)).toEqual(dumpTables(source.sqlite));
  });
});

describe('cycle de vie', () => {
  it('sauvegarde, nouvelles données, restauration de l\'ancienne sauvegarde, puis nouvelle sauvegarde', async () => {
    const app = await populatedApp();
    const first = await createBackup(app, env, PREFS);
    const firstState = dumpTables(app.sqlite);
    app.sqlite.exec("INSERT INTO shopping_lists (id, user_id, name, created_at, updated_at) VALUES ('nouvelle', 'local', 'Nouvelle liste', 'x', 'x')");
    const second = await createBackup(app, env, PREFS);
    expect(second.counts.shoppingLists).toBe(first.counts.shoppingLists + 1);

    const inspected = await inspectBackup(first.bytes, env);
    expect((await restoreBackup(inspected, restoreDeps(app))).status).toBe('restored');
    await discardInspection(inspected);
    expect(dumpTables(app.sqlite)).toEqual(firstState);

    // L'application continue de fonctionner normalement : écriture puis nouvelle sauvegarde valide.
    app.sqlite.exec("INSERT INTO shopping_lists (id, user_id, name, created_at, updated_at) VALUES ('apres', 'local', 'Après', 'x', 'x')");
    const third = await createBackup(app, env, PREFS);
    expect(third.counts.shoppingLists).toBe(first.counts.shoppingLists + 1);
  });

  it('le fichier est lisible par n\'importe quel outil SQLite et ne contient que les tables attendues', async () => {
    const source = await populatedApp();
    const backup = await createBackup(source, env, PREFS);
    const reopened = await env.openFromBytes(backup.bytes);
    const tables = (await reopened.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map((row) => row.name);
    expect(tables).toEqual(
      [
        '__drizzle_migrations',
        'account_snapshots',
        'bill_occurrences',
        'bills',
        'budgets',
        'categories',
        'profiles',
        'savings_goals',
        'savings_movements',
        'shopping_items',
        'shopping_lists',
        'sovmilo_backup_meta',
        'sovmilo_backup_prefs',
        'transactions',
      ].sort(),
    );
    const prefs = await reopened.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM sovmilo_backup_prefs ORDER BY key');
    expect(prefs).toEqual([
      { key: 'sovmilo.languagePreference', value: 'ru' },
      { key: 'sovmilo.theme', value: 'dark' },
    ]);
  });

  it('les préférences inconnues ou démesurées d\'un fichier ne sont jamais appliquées', async () => {
    const source = await populatedApp();
    const backup = await createBackup(source, env, PREFS);
    const modified = await tamper(
      backup.bytes,
      `INSERT INTO sovmilo_backup_prefs (key, value) VALUES ('autre.cle', 'x'); UPDATE sovmilo_backup_prefs SET value = '${'z'.repeat(80)}' WHERE key = 'sovmilo.theme'`,
    );
    const inspected = await inspectBackup(modified, env);
    expect(inspected.preferences).toEqual({ 'sovmilo.languagePreference': 'ru' });
    await discardInspection(inspected);
  });

  it('la copie de sécurité écrite est un fichier SQLite complet', async () => {
    const live = await populatedApp();
    const source = await populatedApp('source.db');
    const backup = await createBackup(source, env, PREFS);
    const inspected = await inspectBackup(backup.bytes, env);
    const written: Uint8Array[] = [];
    await restoreBackup(inspected, restoreDeps(live, [], written));
    await discardInspection(inspected);
    expect(Buffer.from(written[0].slice(0, 15)).toString('latin1')).toBe('SQLite format 3');
    const file = readFileSync(live.file);
    expect(file.length).toBeGreaterThan(0);
  });
});

describe('résultats typés', () => {
  it('un résultat de restauration est l\'un des trois états documentés', () => {
    const outcomes: RestoreOutcome['status'][] = ['restored', 'rolledBack', 'failed'];
    expect(outcomes).toHaveLength(3);
  });
});
