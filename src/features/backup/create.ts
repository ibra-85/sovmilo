import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  BackupError,
  backupFileName,
  sameCounts,
  type BackupCounts,
  type BackupMeta,
  type BackupPreferences,
} from './format';
import {
  checkIntegrity,
  checkStructure,
  inspectBackup,
  readCounts,
  readSchemaVersion,
  stampBackup,
  type BackupEnv,
  type SqlConnection,
} from './inspect';

export interface CreatedBackup {
  bytes: Uint8Array;
  fileName: string;
  meta: BackupMeta;
  /** Compteurs lus dans le fichier produit, après relecture. */
  counts: BackupCounts;
}

async function closeQuietly(connection: SqlConnection | null) {
  try {
    await connection?.closeAsync();
  } catch {
    // sans importance : la copie est en mémoire
  }
}

/**
 * Crée une sauvegarde COHÉRENTE et VÉRIFIÉE, entièrement en mémoire (aucun fichier temporaire, la base de l'application n'est
 * jamais modifiée) :
 *  1. image cohérente de la base (`serializeAsync`) ; 2. contrôle de cette image (intégrité, clés étrangères, schéma) ; 3. ajout de
 *  l'identité et des préférences dans la COPIE ; 4. relecture du résultat avec la MÊME procédure que la restauration, qui doit
 *  retrouver exactement les mêmes compteurs. Si une étape échoue, rien n'est annoncé comme réussi.
 */
export async function createBackup(live: SqlConnection, env: BackupEnv, preferences: BackupPreferences): Promise<CreatedBackup> {
  let image: Uint8Array;
  try {
    image = await live.serializeAsync();
  } catch {
    throw new BackupError('unreadable');
  }

  let snapshot: SqlConnection | null = null;
  let stamped: Uint8Array;
  let meta: BackupMeta;
  try {
    snapshot = await env.openFromBytes(image);
    try {
      await checkIntegrity(snapshot);
      await checkStructure(snapshot, true);
    } catch {
      // On ne fabrique pas une « sauvegarde » d'une base déjà abîmée : elle serait trompeuse.
      throw new BackupError('sourceDamaged');
    }
    const schemaVersion = await readSchemaVersion(snapshot, env.knownMigrations);
    if (schemaVersion !== env.knownMigrations.length) throw new BackupError('sourceDamaged');
    meta = {
      appId: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: env.appVersion,
      schemaVersion,
      schemaLastMigration: env.knownMigrations[schemaVersion - 1],
      createdAt: env.now().toISOString(),
      counts: await readCounts(snapshot),
    };
    await stampBackup(snapshot, meta, preferences);
    stamped = await snapshot.serializeAsync();
  } catch (error) {
    throw error instanceof BackupError ? error : new BackupError('verification');
  } finally {
    await closeQuietly(snapshot);
  }

  // Relecture : le fichier produit doit être restaurable, avec les mêmes données.
  let check;
  try {
    check = await inspectBackup(stamped, env);
  } catch {
    throw new BackupError('verification');
  }
  try {
    if (check.migrated || !sameCounts(check.counts, meta.counts)) throw new BackupError('verification');
  } finally {
    await closeQuietly(check.connection);
  }
  return { bytes: stamped, fileName: backupFileName(env.now()), meta, counts: meta.counts };
}
