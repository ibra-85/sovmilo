import { BackupError, sameCounts, type BackupCounts, type BackupErrorCode, type BackupPreferences } from './format';
import {
  checkIntegrity,
  checkStructure,
  readCounts,
  readSchemaVersion,
  stripBackupStamp,
  type BackupEnv,
  type InspectedBackup,
  type SqlConnection,
} from './inspect';

export interface RestoreDeps {
  env: BackupEnv;
  /** La connexion de l'application. Jamais fermée ici. */
  live: SqlConnection;
  /** Écrit la copie de sécurité dans le stockage privé de l'application. */
  writeSafetyCopy(bytes: Uint8Array): Promise<void>;
  /** Applique langue et apparence (hors base), seulement après validation de la nouvelle base. */
  applyPreferences(preferences: BackupPreferences): void;
}

export type RestoreOutcome =
  /** La nouvelle base est en place ET vérifiée. */
  | { status: 'restored'; counts: BackupCounts }
  /** La bascule a échoué ou n'a pas pu être vérifiée : les données précédentes ont été remises en place et revérifiées. */
  | { status: 'rolledBack'; cause: BackupErrorCode }
  /** La bascule a échoué ET le retour arrière n'a pas pu être vérifié : la copie de sécurité reste sur l'appareil. */
  | { status: 'failed'; cause: BackupErrorCode };

const codeOf = (error: unknown): BackupErrorCode => (error instanceof BackupError ? error.code : 'verification');

async function closeQuietly(connection: SqlConnection | null) {
  try {
    await connection?.closeAsync();
  } catch {
    // copie isolée en mémoire : sans conséquence
  }
}

/** Ferme la copie validée quand la restauration n'a pas lieu (l'utilisatrice annule). */
export async function discardInspection(inspected: InspectedBackup): Promise<void> {
  await closeQuietly(inspected.connection);
}

/** La base de l'application est saine, au schéma courant, et contient exactement ce qui est attendu. */
async function verifyLive(live: SqlConnection, env: BackupEnv, expected: BackupCounts): Promise<void> {
  await checkIntegrity(live);
  await checkStructure(live, true);
  if ((await readSchemaVersion(live, env.knownMigrations)) !== env.knownMigrations.length) throw new BackupError('unknownSchema');
  if (!sameCounts(await readCounts(live), expected)) throw new BackupError('verification');
}

/**
 * Remplace les données de l'application par celles de la sauvegarde VALIDÉE `inspected` (docs/backup-restore.md § 5).
 *
 * Avant toute modification : copie de sécurité de la base courante, vérifiée puis écrite sur l'appareil ; si elle ne peut pas être
 * faite, on lève une erreur et RIEN n'est modifié. La bascule est la copie atomique de SQLite (tout ou rien) ; elle est suivie
 * d'une vérification complète. Au moindre échec, la copie de sécurité est recopiée et revérifiée.
 */
export async function restoreBackup(inspected: InspectedBackup, deps: RestoreDeps): Promise<RestoreOutcome> {
  const { env, live } = deps;
  let before: BackupCounts;
  let safety: Uint8Array;
  try {
    before = await readCounts(live);
    safety = await live.serializeAsync();
    // La copie de sécurité doit elle-même être lisible et complète avant qu'on touche à quoi que ce soit.
    const probe = await env.openFromBytes(safety);
    try {
      await checkIntegrity(probe);
      if (!sameCounts(await readCounts(probe), before)) throw new BackupError('verification');
    } finally {
      await closeQuietly(probe);
    }
    try {
      await deps.writeSafetyCopy(safety);
    } catch {
      throw new BackupError('storage');
    }
  } catch (error) {
    throw error instanceof BackupError ? error : new BackupError('verification');
  }

  let cause: BackupErrorCode;
  try {
    await stripBackupStamp(inspected.connection);
    await env.copyInto(live, inspected.connection);
    await verifyLive(live, env, inspected.counts);
    try {
      deps.applyPreferences(inspected.preferences);
    } catch {
      // langue et apparence ne valent pas d'annuler une restauration déjà vérifiée : l'interface garde ses réglages actuels
    }
    return { status: 'restored', counts: inspected.counts };
  } catch (error) {
    cause = codeOf(error);
  }

  // Retour arrière : la copie de sécurité est recopiée dans la base, puis revérifiée.
  let previous: SqlConnection | null = null;
  try {
    previous = await env.openFromBytes(safety);
    await env.copyInto(live, previous);
    await verifyLive(live, env, before);
    return { status: 'rolledBack', cause };
  } catch {
    return { status: 'failed', cause };
  } finally {
    await closeQuietly(previous);
  }
}
