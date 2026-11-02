import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { backupDatabaseAsync, deserializeDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';

import { sqliteDatabase } from '@/db/client';
import { beginMaintenance, endMaintenance } from '@/db/maintenance';
import { refreshLiveData } from '@/db/live-store';
import journal from '@/db/migrations/meta/_journal.json';
import migrations from '@/db/migrations/migrations';
import * as schema from '@/db/schema';
import { setLanguagePreference } from '@/i18n';
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '@/i18n/resolve';
import { THEME_PREFERENCES, type ThemePreference } from '@/theme/preference';
import { setThemePreference } from '@/theme/use-theme-preference';

import { createBackup, type CreatedBackup } from './create';
import { BACKUP_PREFERENCE_KEYS, BackupError, MAX_BACKUP_BYTES, type BackupPreferences } from './format';
import { inspectBackup, type BackupEnv, type InspectedBackup, type SqlConnection } from './inspect';
import { discardInspection, restoreBackup, type RestoreOutcome } from './restore';

/**
 * Colle la logique de sauvegarde (testée sous Node, `create.ts` / `inspect.ts` / `restore.ts`) à Android : SQLite d'Expo, sélecteurs de
 * dossier et de fichier du système (Storage Access Framework : aucune autorisation de stockage à demander), stockage privé pour la
 * copie de sécurité. Rien ici n'a pu être exécuté hors d'un téléphone : voir docs/backup-restore.md § 9.
 */

const asConnection = (database: SQLiteDatabase): SqlConnection => database;

export const platformEnv: BackupEnv = {
  knownMigrations: journal.entries.map((entry) => entry.when),
  appVersion: Constants.expoConfig?.version ?? 'inconnue',
  now: () => new Date(),
  async openFromBytes(bytes) {
    return asConnection(await deserializeDatabaseAsync(bytes));
  },
  async copyInto(dest, source) {
    await backupDatabaseAsync({ sourceDatabase: source as SQLiteDatabase, destDatabase: dest as SQLiteDatabase });
  },
  async migrate(connection) {
    await migrate(drizzle(connection as SQLiteDatabase, { schema }), migrations);
  },
};

// --- Préférences hors base (kv-store) --------------------------------------------------------------------------------------------

export function readPreferences(): BackupPreferences {
  const result: BackupPreferences = {};
  for (const key of BACKUP_PREFERENCE_KEYS) {
    try {
      const value = Storage.getItemSync(key);
      if (typeof value === 'string') result[key] = value;
    } catch {
      // une préférence illisible n'empêche pas la sauvegarde des données
    }
  }
  return result;
}

/** N'applique que des valeurs connues, par les mêmes fonctions que l'écran Paramètres (donc mémorisées et visibles tout de suite). */
export function applyPreferences(preferences: BackupPreferences): void {
  const language = preferences['sovmilo.languagePreference'];
  if (language !== undefined && (LANGUAGE_PREFERENCES as readonly string[]).includes(language)) setLanguagePreference(language as LanguagePreference);
  const theme = preferences['sovmilo.theme'];
  if (theme !== undefined && (THEME_PREFERENCES as readonly string[]).includes(theme)) setThemePreference(theme as ThemePreference);
}

// --- Dernière sauvegarde enregistrée -----------------------------------------------------------------------------------------------

const LAST_BACKUP_KEY = 'sovmilo.backup.last';

export interface LastBackup {
  /** Date à laquelle le fichier a été ÉCRIT et RELU dans le dossier choisi (pas la date de simple création en mémoire). */
  savedAt: string;
  fileName: string;
}

export function readLastBackup(): LastBackup | null {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(LAST_BACKUP_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object' && typeof (parsed as LastBackup).savedAt === 'string' && typeof (parsed as LastBackup).fileName === 'string') {
      return parsed as LastBackup;
    }
  } catch {
    // information d'affichage seulement
  }
  return null;
}

function writeLastBackup(value: LastBackup): void {
  try {
    Storage.setItemSync(LAST_BACKUP_KEY, JSON.stringify(value));
  } catch {
    // le fichier est bien enregistré ; seul le rappel dans Paramètres manquera
  }
}

// --- Sauvegarde ----------------------------------------------------------------------------------------------------------------

/** Étape 1 : image cohérente, vérifiée, en mémoire. Rien n'est encore écrit nulle part. */
export async function prepareBackup(): Promise<CreatedBackup> {
  if (!beginMaintenance('backup')) throw new BackupError('busy');
  try {
    return await createBackup(asConnection(sqliteDatabase), platformEnv, readPreferences());
  } finally {
    endMaintenance();
  }
}

export type SaveResult = { status: 'saved'; fileName: string; savedAt: string } | { status: 'cancelled' };

const looksCancelled = (error: unknown) => /cancel|annul|dismiss/i.test(error instanceof Error ? `${error.name} ${error.message}` : String(error));

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Étape 2 : l'utilisatrice choisit un dossier (sélecteur Android : Téléchargements, Drive, carte…), le fichier y est écrit puis RELU et
 * comparé octet par octet. Seulement alors « enregistrée ». Annuler le sélecteur n'est pas une erreur.
 */
export async function saveBackup(backup: CreatedBackup): Promise<SaveResult> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (looksCancelled(error)) return { status: 'cancelled' };
    throw new BackupError('storage');
  }
  try {
    const file = directory.createFile(backup.fileName, 'application/octet-stream');
    await file.write(backup.bytes);
    if (file.size !== backup.bytes.length || !sameBytes(await file.bytes(), backup.bytes)) throw new BackupError('verification');
    const savedAt = new Date().toISOString();
    writeLastBackup({ savedAt, fileName: file.name });
    return { status: 'saved', fileName: file.name, savedAt };
  } catch (error) {
    throw error instanceof BackupError ? error : new BackupError('storage');
  }
}

// --- Restauration --------------------------------------------------------------------------------------------------------------

export type PickResult = { status: 'picked'; inspected: InspectedBackup; fileName: string } | { status: 'cancelled' };

/**
 * Sélection, lecture et PRÉVALIDATION complète d'un fichier. La base de l'application n'est pas touchée. L'appelant doit soit
 * restaurer, soit appeler `discardInspection`.
 */
export async function pickAndInspectBackup(): Promise<PickResult> {
  let file: File;
  try {
    const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
    if (picked.canceled) return { status: 'cancelled' };
    file = picked.result;
  } catch (error) {
    if (looksCancelled(error)) return { status: 'cancelled' };
    throw new BackupError('unreadable');
  }
  let bytes: Uint8Array;
  try {
    const size = file.size;
    if (size !== null && size > MAX_BACKUP_BYTES) throw new BackupError('tooLarge');
    bytes = await file.bytes();
  } catch (error) {
    throw error instanceof BackupError ? error : new BackupError('unreadable');
  }
  const inspected = await inspectBackup(bytes, platformEnv);
  return { status: 'picked', inspected, fileName: file.name };
}

const SAFETY_FILE_NAME = 'sovmilo-avant-restauration.db';

async function writeSafetyCopy(bytes: Uint8Array): Promise<void> {
  const file = new File(Paths.document, SAFETY_FILE_NAME);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  if (file.size !== bytes.length) throw new BackupError('storage');
}

/**
 * Restaure la sauvegarde VALIDÉE. Pendant l'opération la maintenance est active (pas de seconde opération, pas de redémarrage de mise
 * à jour). Après une restauration réussie, toutes les requêtes sont relues : aucun écran ne garde de données de l'ancienne base.
 */
export async function restoreInspectedBackup(inspected: InspectedBackup): Promise<RestoreOutcome> {
  if (!beginMaintenance('restore')) throw new BackupError('busy');
  try {
    const outcome = await restoreBackup(inspected, { env: platformEnv, live: asConnection(sqliteDatabase), writeSafetyCopy, applyPreferences });
    // Dans tous les cas (réussie ou annulée par le retour arrière), les écrans relisent la base telle qu'elle est maintenant.
    refreshLiveData();
    return outcome;
  } finally {
    await discardInspection(inspected);
    endMaintenance();
  }
}

export { discardInspection };
