import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import journal from '@/db/migrations/meta/_journal.json';
import * as schema from '@/db/schema';
import { asExpoClient } from '@/db/test-support';

import type { BackupEnv, SqlConnection } from './inspect';

/**
 * Aides des TESTS uniquement : une vraie base SQLite de Node derrière l'interface `SqlConnection`, avec les vraies migrations.
 * `copyInto` émule l'API de sauvegarde de SQLite d'Expo (copie dans une connexion ouverte, tout ou rien, dans une transaction) :
 * l'API native elle-même ne se vérifie que sur un téléphone (docs/backup-restore.md § 9).
 */

export class NodeConnection implements SqlConnection {
  closed = false;
  constructor(
    readonly sqlite: DatabaseSync,
    readonly file: string,
    private readonly dir: string,
  ) {}

  async getAllAsync<T>(sql: string): Promise<T[]> {
    return this.sqlite.prepare(sql).all() as T[];
  }

  async execAsync(sql: string): Promise<void> {
    this.sqlite.exec(sql);
  }

  /** Image cohérente de la base (copie par pages de SQLite), comme `serializeAsync` d'expo-sqlite. */
  async serializeAsync(): Promise<Uint8Array> {
    const target = path.join(this.dir, `image-${Math.random().toString(36).slice(2)}.db`);
    await backup(this.sqlite, target);
    const bytes = new Uint8Array(readFileSync(target));
    rmSync(target, { force: true });
    return bytes;
  }

  async closeAsync(): Promise<void> {
    if (!this.closed) this.sqlite.close();
    this.closed = true;
  }
}

export interface FailureInjection {
  /** Appelée au début de `copyInto` : peut lever (copie impossible). */
  beforeCopy?: (dest: NodeConnection, copyIndex: number) => void;
  /** Appelée au milieu de la copie, la transaction ouverte : peut lever (échec pendant le remplacement). */
  duringCopy?: (copyIndex: number) => void;
  /** Appelée pendant la migration d'une copie isolée. */
  duringMigration?: () => void;
}

export interface NodeBackupHarness {
  dir: string;
  env: BackupEnv;
  injection: FailureInjection;
  /** Ouvre (ou crée) la base « de l'application » : un fichier, avec les vraies migrations et les clés étrangères actives. */
  openApplicationDatabase(name?: string): Promise<NodeConnection>;
  /** Une base du schéma d'une ancienne version : les `count` premières migrations seulement. */
  openOlderDatabase(count: number, name?: string): Promise<NodeConnection>;
  dispose(): void;
}

const migrationConfig = () => ({
  journal,
  migrations: Object.fromEntries(
    journal.entries.map((entry) => [`m${String(entry.idx).padStart(4, '0')}`, readFileSync(path.resolve(__dirname, '../../db/migrations', `${entry.tag}.sql`), 'utf8')]),
  ),
});

export function createHarness(now = () => new Date('2026-11-02T14:30:00.000Z')): NodeBackupHarness {
  const dir = mkdtempSync(path.join(tmpdir(), 'sovmilo-backup-'));
  const injection: FailureInjection = {};
  let counter = 0;
  let copies = 0;
  const opened: NodeConnection[] = [];

  const track = (file: string): NodeConnection => {
    const connection = new NodeConnection(new DatabaseSync(file), file, dir);
    opened.push(connection);
    return connection;
  };

  const env: BackupEnv = {
    knownMigrations: journal.entries.map((entry) => entry.when),
    appVersion: '1.0.0',
    now,
    async openFromBytes(bytes) {
      counter += 1;
      const file = path.join(dir, `isolated-${counter}.db`);
      writeFileSync(file, bytes);
      const connection = track(file);
      // Une base corrompue ne s'ouvre parfois qu'à la première lecture : on force cette lecture ici, comme le ferait le téléphone.
      connection.sqlite.prepare('SELECT count(*) FROM sqlite_master').get();
      return connection;
    },
    async copyInto(dest, source) {
      const to = dest as NodeConnection;
      const from = source as NodeConnection;
      copies += 1;
      injection.beforeCopy?.(to, copies);
      to.sqlite.exec('PRAGMA foreign_keys = OFF');
      to.sqlite.exec(`ATTACH DATABASE '${from.file.replace(/'/g, "''")}' AS src`);
      try {
        to.sqlite.exec('BEGIN IMMEDIATE');
        try {
          const own = to.sqlite.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
          for (const { name } of own) to.sqlite.exec(`DROP TABLE "${name}"`);
          const definitions = from.sqlite
            .prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END")
            .all() as { type: string; name: string; sql: string }[];
          for (const definition of definitions) to.sqlite.exec(definition.sql);
          for (const definition of definitions.filter((entry) => entry.type === 'table')) {
            to.sqlite.exec(`INSERT INTO main."${definition.name}" SELECT * FROM src."${definition.name}"`);
          }
          injection.duringCopy?.(copies);
          to.sqlite.exec('COMMIT');
        } catch (error) {
          to.sqlite.exec('ROLLBACK');
          throw error;
        }
      } finally {
        to.sqlite.exec('DETACH DATABASE src');
        to.sqlite.exec('PRAGMA foreign_keys = ON');
      }
    },
    async migrate(connection) {
      injection.duringMigration?.();
      const to = connection as NodeConnection;
      await migrate(drizzle(asExpoClient(to.sqlite) as never, { schema }), migrationConfig());
    },
  };

  const applicationDatabase = async (name: string, count: number) => {
    const connection = track(path.join(dir, name));
    connection.sqlite.exec('PRAGMA foreign_keys = ON');
    // Même chemin que l'application : le migrateur de Drizzle (qui tient `__drizzle_migrations`), limité aux `count` premières migrations.
    const config = migrationConfig();
    await migrate(drizzle(asExpoClient(connection.sqlite) as never, { schema }), { journal: { ...journal, entries: journal.entries.slice(0, count) }, migrations: config.migrations });
    return connection;
  };

  return {
    dir,
    env,
    injection,
    openApplicationDatabase: (name = 'sovmilo.db') => applicationDatabase(name, journal.entries.length),
    openOlderDatabase: (count, name = `older-${count}.db`) => applicationDatabase(name, count),
    dispose() {
      for (const connection of opened) {
        try {
          if (!connection.closed) connection.sqlite.close();
        } catch {
          // déjà fermée
        }
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Contenu COMPLET des tables de l'application (lignes triées par identifiant) : sert à comparer les données elles-mêmes. */
export function dumpTables(sqlite: DatabaseSync): Record<string, unknown[]> {
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'sovmilo_backup_%' ORDER BY name")
    .all() as { name: string }[];
  return Object.fromEntries(tables.map(({ name }) => [name, sqlite.prepare(`SELECT * FROM "${name}" ORDER BY 1, 2`).all()]));
}
