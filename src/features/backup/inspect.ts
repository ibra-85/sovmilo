import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';

import * as schema from '@/db/schema';

import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  BACKUP_PREFERENCE_KEYS,
  BackupError,
  decideSchema,
  emptyCounts,
  META_TABLE,
  MIGRATIONS_TABLE,
  PREFS_TABLE,
  SQLITE_APPLICATION_ID,
  checkHeader,
  type BackupCounts,
  type BackupMeta,
  type BackupPreferences,
  type CountKey,
} from './format';

/**
 * Lecture et vérification d'une base SQLite de Sovmilo, indépendamment de la plateforme : tout passe par `SqlConnection`
 * (sur téléphone, un `SQLiteDatabase` d'expo-sqlite ; dans les tests, une base SQLite de Node). Seules des requêtes FIXES écrites ici
 * sont exécutées : le contenu d'un fichier à restaurer n'est jamais interprété comme du SQL.
 */
export interface SqlConnection {
  getAllAsync<T>(sql: string): Promise<T[]>;
  execAsync(sql: string): Promise<void>;
  serializeAsync(): Promise<Uint8Array>;
  closeAsync(): Promise<void>;
}

/** Ce que la plateforme fournit. */
export interface BackupEnv {
  /** Ouvre une copie ISOLÉE (en mémoire) d'une image de base de données. */
  openFromBytes(bytes: Uint8Array): Promise<SqlConnection>;
  /** Copie ATOMIQUE de `source` dans `dest` (API de sauvegarde de SQLite) : tout ou rien. */
  copyInto(dest: SqlConnection, source: SqlConnection): Promise<void>;
  /** Applique les migrations manquantes à une copie isolée. */
  migrate(connection: SqlConnection): Promise<void>;
  /** Dates (`when`) des migrations connues de cette version de l'application, dans l'ordre : la version courante du schéma est leur nombre. */
  knownMigrations: readonly number[];
  appVersion: string;
  now(): Date;
}

interface TableInfo {
  name: string;
  columns: string[];
  countKey: CountKey | null;
}

const COUNT_KEY_BY_TABLE: Record<string, CountKey> = {
  transactions: 'transactions',
  categories: 'categories',
  budgets: 'budgets',
  account_snapshots: 'accountSnapshots',
  shopping_lists: 'shoppingLists',
  shopping_items: 'shoppingItems',
  bills: 'bills',
  bill_occurrences: 'billOccurrences',
  savings_goals: 'savingsGoals',
  savings_movements: 'savingsMovements',
};

/** Les tables de l'application, lues dans le schéma Drizzle (jamais recopiées à la main). */
export const APP_TABLES: readonly TableInfo[] = (Object.values(schema) as unknown[])
  .filter((value): value is SQLiteTable => is(value, SQLiteTable))
  .map((table) => {
    const config = getTableConfig(table);
    return { name: config.name, columns: config.columns.map((column) => column.name), countKey: COUNT_KEY_BY_TABLE[config.name] ?? null };
  });

const KNOWN_TABLES = new Set<string>([...APP_TABLES.map((table) => table.name), MIGRATIONS_TABLE, META_TABLE, PREFS_TABLE]);

/** Entiers lus, jamais d'autre type : une valeur inattendue fait échouer la vérification plutôt que de fausser un compteur. */
function asCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new BackupError('inconsistent');
  return value;
}

export async function checkIntegrity(connection: SqlConnection): Promise<void> {
  const rows = await connection.getAllAsync<Record<string, unknown>>('PRAGMA integrity_check');
  if (rows.length !== 1 || Object.values(rows[0])[0] !== 'ok') throw new BackupError('corrupt');
  const orphans = await connection.getAllAsync<unknown>('PRAGMA foreign_key_check');
  if (orphans.length > 0) throw new BackupError('inconsistent');
}

/**
 * Objets autorisés : tables et index de l'application seulement. Aucun déclencheur ni vue (rien de ce que Sovmilo crée) : un tel
 * objet viendrait d'ailleurs. `requireAll` (schéma courant) exige en plus toutes les tables et exactement leurs colonnes.
 */
export async function checkStructure(connection: SqlConnection, requireAll: boolean): Promise<void> {
  const objects = await connection.getAllAsync<{ type: string; name: string; tbl_name: string }>(
    "SELECT type, name, tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
  );
  for (const object of objects) {
    if (object.type !== 'table' && object.type !== 'index') throw new BackupError('unexpectedObjects');
    if (!KNOWN_TABLES.has(object.tbl_name)) throw new BackupError('unexpectedObjects');
  }
  if (!requireAll) return;
  const tables = new Set(objects.filter((object) => object.type === 'table').map((object) => object.name));
  if (!tables.has(MIGRATIONS_TABLE)) throw new BackupError('unknownSchema');
  for (const table of APP_TABLES) {
    if (!tables.has(table.name)) throw new BackupError('unknownSchema');
    const columns = (await connection.getAllAsync<{ name: string }>(`PRAGMA table_info("${table.name}")`)).map((column) => column.name);
    if (columns.length !== table.columns.length || !table.columns.every((column) => columns.includes(column))) throw new BackupError('unknownSchema');
  }
}

/** Nombre de migrations appliquées, après avoir vérifié que ce sont bien celles du journal (même date, même ordre). */
export async function readSchemaVersion(connection: SqlConnection, known: readonly number[]): Promise<number> {
  const exists = await connection.getAllAsync<unknown>(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${MIGRATIONS_TABLE}'`);
  if (exists.length === 0) throw new BackupError('unknownSchema');
  // Le migrateur de Drizzle laisse `id` à NULL (colonne « SERIAL », pas un alias de rowid) : l'ordre est celui des dates.
  const rows = await connection.getAllAsync<{ created_at: unknown }>(`SELECT created_at FROM "${MIGRATIONS_TABLE}" ORDER BY CAST(created_at AS INTEGER)`);
  if (rows.length > known.length) return rows.length; // schéma futur : refusé plus haut, sans comparer des migrations inconnues
  rows.forEach((row, index) => {
    if (Number(row.created_at) !== known[index]) throw new BackupError('unknownSchema');
  });
  return rows.length;
}

/** Compteurs réels (lignes non supprimées logiquement) lus dans la base. */
export async function readCounts(connection: SqlConnection): Promise<BackupCounts> {
  const counts = emptyCounts();
  for (const table of APP_TABLES) {
    if (!table.countKey) continue;
    const rows = await connection.getAllAsync<{ n: unknown }>(`SELECT COUNT(*) AS n FROM "${table.name}" WHERE deleted_at IS NULL`);
    counts[table.countKey] = asCount(rows[0]?.n);
  }
  return counts;
}

async function readKeyValues(connection: SqlConnection, table: string): Promise<Map<string, string>> {
  const rows = await connection.getAllAsync<{ key: unknown; value: unknown }>(`SELECT key, value FROM "${table}"`);
  const result = new Map<string, string>();
  for (const row of rows) {
    if (typeof row.key !== 'string' || typeof row.value !== 'string') throw new BackupError('inconsistent');
    result.set(row.key, row.value);
  }
  return result;
}

async function hasTable(connection: SqlConnection, name: string): Promise<boolean> {
  return (await connection.getAllAsync<unknown>(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '${name}'`)).length > 0;
}

export async function readMeta(connection: SqlConnection): Promise<BackupMeta> {
  if (!(await hasTable(connection, META_TABLE))) throw new BackupError('notSovmilo');
  const values = await readKeyValues(connection, META_TABLE);
  const number = (key: string) => {
    const parsed = Number(values.get(key));
    if (!Number.isSafeInteger(parsed)) throw new BackupError('unknownFormat');
    return parsed;
  };
  const appId = values.get('app_id');
  if (appId !== BACKUP_APP_ID) throw new BackupError('notSovmilo');
  const formatVersion = number('format_version');
  if (formatVersion !== BACKUP_FORMAT_VERSION) throw new BackupError('unknownFormat');
  let counts: BackupCounts;
  try {
    counts = { ...emptyCounts(), ...(JSON.parse(values.get('counts') ?? '{}') as Partial<BackupCounts>) };
  } catch {
    throw new BackupError('unknownFormat');
  }
  return {
    appId,
    formatVersion,
    appVersion: values.get('app_version') ?? '',
    schemaVersion: number('schema_version'),
    schemaLastMigration: number('schema_last_migration'),
    createdAt: values.get('created_at') ?? '',
    counts,
  };
}

/** Seules les clés connues, avec des valeurs texte : le reste du fichier n'est pas appliqué. */
export async function readPreferences(connection: SqlConnection): Promise<BackupPreferences> {
  if (!(await hasTable(connection, PREFS_TABLE))) return {};
  const values = await readKeyValues(connection, PREFS_TABLE);
  const result: BackupPreferences = {};
  for (const key of BACKUP_PREFERENCE_KEYS) {
    const value = values.get(key);
    if (value !== undefined && value.length <= 32) result[key] = value;
  }
  return result;
}

const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Écrit l'identité et les préférences DANS une copie isolée (jamais dans la base de l'application). */
export async function stampBackup(connection: SqlConnection, meta: BackupMeta, preferences: BackupPreferences): Promise<void> {
  const meta_rows: [string, string][] = [
    ['app_id', meta.appId],
    ['format_version', String(meta.formatVersion)],
    ['app_version', meta.appVersion],
    ['schema_version', String(meta.schemaVersion)],
    ['schema_last_migration', String(meta.schemaLastMigration)],
    ['created_at', meta.createdAt],
    ['counts', JSON.stringify(meta.counts)],
  ];
  const pref_rows = Object.entries(preferences).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  const values = (rows: [string, string][]) => rows.map(([key, value]) => `(${sqlText(key)}, ${sqlText(value)})`).join(', ');
  await connection.execAsync(
    [
      `DROP TABLE IF EXISTS ${META_TABLE}`,
      `DROP TABLE IF EXISTS ${PREFS_TABLE}`,
      `CREATE TABLE ${META_TABLE} (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`,
      `CREATE TABLE ${PREFS_TABLE} (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`,
      `INSERT INTO ${META_TABLE} (key, value) VALUES ${values(meta_rows)}`,
      ...(pref_rows.length > 0 ? [`INSERT INTO ${PREFS_TABLE} (key, value) VALUES ${values(pref_rows)}`] : []),
      `PRAGMA application_id = ${SQLITE_APPLICATION_ID}`,
    ].join(';\n'),
  );
}

/** Retire l'identité de sauvegarde avant de recopier la base dans l'application : elle ne doit contenir que les tables de l'application. */
export async function stripBackupStamp(connection: SqlConnection): Promise<void> {
  await connection.execAsync(`DROP TABLE IF EXISTS ${META_TABLE};\nDROP TABLE IF EXISTS ${PREFS_TABLE};\nPRAGMA application_id = 0`);
}

export interface InspectedBackup {
  /** Copie isolée, validée (et migrée si besoin), prête à être recopiée. À fermer avec `closeAsync`. */
  connection: SqlConnection;
  meta: BackupMeta;
  /** Compteurs lus dans la copie validée (après migration éventuelle). */
  counts: BackupCounts;
  preferences: BackupPreferences;
  /** Le schéma de la sauvegarde était plus ancien : il a été migré dans la copie. */
  migrated: boolean;
  /** Version du schéma de la sauvegarde telle qu'elle a été enregistrée. */
  originalSchemaVersion: number;
}

async function closeQuietly(connection: SqlConnection | null) {
  try {
    await connection?.closeAsync();
  } catch {
    // la fermeture d'une copie isolée ne doit pas masquer la vraie raison de l'échec
  }
}

/**
 * Prévalidation complète d'une sauvegarde, AVANT toute modification de la base de l'application (docs/backup-restore.md § 5).
 * Renvoie une copie isolée validée ; lève `BackupError` sinon (la copie est alors fermée).
 */
export async function inspectBackup(bytes: Uint8Array, env: BackupEnv): Promise<InspectedBackup> {
  checkHeader(bytes);
  let connection: SqlConnection | null = null;
  try {
    try {
      connection = await env.openFromBytes(bytes);
      await connection.execAsync('PRAGMA trusted_schema = OFF;\nPRAGMA query_only = ON');
      await checkIntegrity(connection);
    } catch (error) {
      throw error instanceof BackupError ? error : new BackupError('corrupt');
    }
    await checkStructure(connection, false);
    const meta = await readMeta(connection);
    const originalSchemaVersion = await readSchemaVersion(connection, env.knownMigrations);
    if (meta.schemaVersion !== originalSchemaVersion) throw new BackupError('inconsistent');
    const decision = decideSchema(originalSchemaVersion, env.knownMigrations.length);
    if (decision === 'future') throw new BackupError('futureSchema');
    if (decision === 'unknown') throw new BackupError('unknownSchema');
    const preferences = await readPreferences(connection);

    const migrated = decision === 'migrate';
    if (migrated) {
      // La migration ne touche QUE cette copie isolée.
      await connection.execAsync('PRAGMA query_only = OFF');
      try {
        await env.migrate(connection);
      } catch {
        throw new BackupError('migrationFailed');
      }
      await connection.execAsync('PRAGMA query_only = ON');
      await checkIntegrity(connection);
    }
    await checkStructure(connection, true);
    if ((await readSchemaVersion(connection, env.knownMigrations)) !== env.knownMigrations.length) throw new BackupError('unknownSchema');
    const counts = await readCounts(connection);
    // Sans migration, les compteurs annoncés doivent être exactement ceux du fichier (sinon le fichier a été modifié).
    if (!migrated && Object.keys(counts).some((key) => counts[key as CountKey] !== meta.counts[key as CountKey])) throw new BackupError('inconsistent');
    await connection.execAsync('PRAGMA query_only = OFF');
    return { connection, meta, counts, preferences, migrated, originalSchemaVersion };
  } catch (error) {
    await closeQuietly(connection);
    throw error instanceof BackupError ? error : new BackupError('corrupt');
  }
}
