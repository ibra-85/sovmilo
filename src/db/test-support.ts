import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { drizzle } from 'drizzle-orm/expo-sqlite';

import journal from './migrations/meta/_journal.json';
import * as schema from './schema';

/**
 * Aides des TESTS uniquement (jamais importées par l'application) : une vraie base SQLite, avec les vraies migrations,
 * derrière le pilote Drizzle d'Expo. Elle remplace `expo-sqlite` (natif) sous Node pour tester les dépôts de bout en bout.
 */

/** Applique les migrations SQL du dossier `migrations`, dans l'ordre du journal : de la `from`-ième (0 = la première) jusqu'à la `count`-ième (toutes par défaut). */
export function applyMigrations(sqlite: DatabaseSync, count = journal.entries.length, from = 0): void {
  for (const entry of journal.entries.slice(from, count)) {
    const file = path.join(__dirname, 'migrations', `${entry.tag}.sql`);
    for (const statement of readFileSync(file, 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim() !== '') sqlite.exec(statement);
    }
  }
}

/** Fait ressembler un `DatabaseSync` de Node à l'objet que le pilote Drizzle d'Expo attend de `expo-sqlite`. */
export function asExpoClient(sqlite: DatabaseSync) {
  return {
    prepareSync(sql: string) {
      const objects = sqlite.prepare(sql);
      const arrays = sqlite.prepare(sql);
      arrays.setReturnArrays(true);
      const reads = objects.columns().length > 0;
      return {
        executeSync(params: never[]) {
          if (!reads) {
            const { changes, lastInsertRowid } = objects.run(...params);
            return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowid), getAllSync: () => [], getFirstSync: () => undefined };
          }
          return {
            changes: 0,
            lastInsertRowId: 0,
            getAllSync: () => objects.all(...params),
            getFirstSync: () => objects.get(...params),
          };
        },
        executeForRawResultSync(params: never[]) {
          return { getAllSync: () => arrays.all(...params) };
        },
        finalizeSync() {},
      };
    },
  };
}

export interface TestDatabase {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: DatabaseSync;
  close: () => void;
}

/**
 * Ouvre une base (en mémoire, ou le fichier donné) et y applique les migrations si elle est neuve. Rouvrir le même fichier
 * retrouve les données : c'est ainsi que les tests simulent un redémarrage de l'application.
 */
export function openTestDatabase(file = ':memory:'): TestDatabase {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const row = sqlite.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  if (!row || row.user_version === 0) {
    applyMigrations(sqlite);
    sqlite.exec(`PRAGMA user_version = ${journal.entries.length}`);
  }
  const db = drizzle(asExpoClient(sqlite) as never, { schema });
  return { db, sqlite, close: () => sqlite.close() };
}
