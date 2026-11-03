/**
 * Format de sauvegarde Sovmilo (voir docs/backup-restore.md). Module PUR (aucun accès natif) : constantes, identification d'un
 * fichier, politique de compatibilité, nom de fichier. Un fichier de sauvegarde est une base SQLite valide ; son identité tient dans
 * l'en-tête SQLite (`application_id`) et dans une table de métadonnées, jamais dans son nom.
 */

/** Identité LOGIQUE du produit (pas le paquet Android : une sauvegarde de « Sovmilo (preview) » doit se restaurer dans « Sovmilo »). */
export const BACKUP_APP_ID = 'sovmilo';
/** Version de la structure du fichier de sauvegarde (tables de métadonnées, préférences). À incrémenter si cette structure change. */
export const BACKUP_FORMAT_VERSION = 1;
/** « SOVM » : valeur de `PRAGMA application_id`, lisible dans l'en-tête SQLite sans ouvrir la base (octets 68 à 71). */
export const SQLITE_APPLICATION_ID = 0x534f564d;

export const META_TABLE = 'sovmilo_backup_meta';
export const PREFS_TABLE = 'sovmilo_backup_prefs';
export const MIGRATIONS_TABLE = '__drizzle_migrations';

/** Au-delà, le fichier n'est pas une sauvegarde Sovmilo (une base de plusieurs années pèse quelques Mo) : refus avant lecture. */
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

/** Préférences hors de la base SQLite de l'application (`kv-store`) qui voyagent avec la sauvegarde. */
export const BACKUP_PREFERENCE_KEYS = ['sovmilo.languagePreference', 'sovmilo.theme'] as const;
export type BackupPreferences = Partial<Record<(typeof BACKUP_PREFERENCE_KEYS)[number], string>>;

/** Compteurs lus DANS la base (jamais déclarés) : suppression logique exclue. */
export const COUNT_KEYS = [
  'transactions',
  'categories',
  'budgets',
  'accountSnapshots',
  'shoppingLists',
  'shoppingItems',
  'bills',
  'billOccurrences',
  'savingsGoals',
  'savingsMovements',
] as const;
export type CountKey = (typeof COUNT_KEYS)[number];
export type BackupCounts = Record<CountKey, number>;

export interface BackupMeta {
  appId: string;
  formatVersion: number;
  appVersion: string;
  /** Nombre de migrations appliquées dans cette base. */
  schemaVersion: number;
  /** Date (`when` du journal) de la dernière migration appliquée. */
  schemaLastMigration: number;
  /** UTC, ISO. */
  createdAt: string;
  counts: BackupCounts;
}

/** Raisons de refus ou d'échec. Jamais de texte venant du fichier : aucun message ne peut contenir de données personnelles. */
export const BACKUP_ERROR_CODES = [
  'unreadable',
  'empty',
  'tooLarge',
  'notSqlite',
  'notSovmilo',
  'truncated',
  'corrupt',
  'unknownFormat',
  'futureSchema',
  'unknownSchema',
  'unexpectedObjects',
  'inconsistent',
  'migrationFailed',
  'sourceDamaged',
  'storage',
  'verification',
  'busy',
] as const;
export type BackupErrorCode = (typeof BACKUP_ERROR_CODES)[number];

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  constructor(code: BackupErrorCode) {
    super(code);
    this.name = 'BackupError';
    this.code = code;
  }
}

const SQLITE_MAGIC = 'SQLite format 3\u0000';
const HEADER_SIZE = 100;

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

/**
 * Premier contrôle, sans ouvrir la base : taille, en-tête SQLite, identité Sovmilo, fichier tronqué.
 * Un fichier tronqué (copie interrompue) est détecté ici : l'en-tête annonce un nombre de pages que le fichier n'atteint pas.
 */
export function checkHeader(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new BackupError('empty');
  if (bytes.length > MAX_BACKUP_BYTES) throw new BackupError('tooLarge');
  if (bytes.length < HEADER_SIZE) throw new BackupError('notSqlite');
  for (let i = 0; i < SQLITE_MAGIC.length; i += 1) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) throw new BackupError('notSqlite');
  }
  if (readUint32(bytes, 68) !== SQLITE_APPLICATION_ID) throw new BackupError('notSovmilo');
  const rawPageSize = (bytes[16] << 8) | bytes[17];
  const pageSize = rawPageSize === 1 ? 65536 : rawPageSize;
  const pageCount = readUint32(bytes, 28);
  // `pageCount` n'est fiable que si le compteur de modifications et « version-valid-for » concordent (sinon : ancien écrivain).
  const reliable = pageCount > 0 && readUint32(bytes, 24) === readUint32(bytes, 92);
  if (pageSize < 512 || (reliable && bytes.length < pageCount * pageSize)) throw new BackupError('truncated');
}

export type SchemaDecision = 'current' | 'migrate' | 'future' | 'unknown';

/** Politique de compatibilité (docs/backup-restore.md § 6) : jamais de migration à l'envers. */
export function decideSchema(backupVersion: number, currentVersion: number): SchemaDecision {
  if (!Number.isInteger(backupVersion) || backupVersion < 1) return 'unknown';
  if (backupVersion === currentVersion) return 'current';
  return backupVersion < currentVersion ? 'migrate' : 'future';
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

/** `sovmilo-backup-2026-11-02-1530.db` (heure locale : celle que l'utilisatrice voit dans son gestionnaire de fichiers). */
export function backupFileName(date: Date): string {
  return `sovmilo-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.db`;
}

export function emptyCounts(): BackupCounts {
  return Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as BackupCounts;
}

export function sameCounts(a: BackupCounts, b: BackupCounts): boolean {
  return COUNT_KEYS.every((key) => a[key] === b[key]);
}
