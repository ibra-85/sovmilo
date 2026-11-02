/**
 * Mises à jour par EAS Update (docs/eas-updates.md). Logique PURE : l'API d'`expo-updates` est injectée (`UpdatesApi`), donc testable
 * sans téléphone. Rien ne simule une mise à jour : sans application installée adaptée, l'état est « indisponible », jamais un faux succès.
 */

export type UpdateUnavailableReason =
  /** Expo Go : l'API de mise à jour de production n'y fonctionne pas comme dans l'application installée. */
  | 'expoGo'
  /** Build de développement (Metro) : le code vient du serveur de développement. */
  | 'development'
  /** Application installée mais sans configuration EAS Update (`updates.url` absent) : rien à interroger. */
  | 'notConfigured';

export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'unavailable'; reason: UpdateUnavailableReason }
  | { phase: 'checking' }
  | { phase: 'upToDate'; checkedAt: string }
  | { phase: 'downloading' }
  /** Téléchargée et vérifiée par expo-updates : elle s'applique au prochain redémarrage de l'application. */
  | { phase: 'downloaded'; checkedAt: string }
  | { phase: 'offline' }
  | { phase: 'error' };

export interface UpdatesApi {
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<{ isNew: boolean }>;
  reloadAsync(): Promise<void>;
}

export interface UpdateEnvironment {
  /** `Constants.executionEnvironment === 'storeClient'`. */
  isExpoGo: boolean;
  /** `__DEV__`. */
  isDevelopmentBuild: boolean;
  /** `Updates.isEnabled`. */
  isUpdatesEnabled: boolean;
}

/** Pourquoi les mises à jour ne sont pas disponibles ici, ou `null` si elles le sont. */
export function unavailableReason(environment: UpdateEnvironment): UpdateUnavailableReason | null {
  if (environment.isExpoGo) return 'expoGo';
  if (environment.isDevelopmentBuild) return 'development';
  if (!environment.isUpdatesEnabled) return 'notConfigured';
  return null;
}

/** Une panne de réseau (hors connexion, serveur injoignable) se dit autrement qu'une vraie erreur. */
export function isNetworkFailure(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /network|internet|offline|connection|connect|unable to resolve|unknownhost|timed? ?out|econn|ssl|unreachable/i.test(text);
}

/**
 * Vérifie puis télécharge une mise à jour compatible. N'applique RIEN : le redémarrage est une décision séparée (`applyUpdate`).
 * `expo-updates` ne propose que des mises à jour de la même version d'exécution : une build incompatible n'en reçoit jamais.
 */
export async function checkForUpdate(api: UpdatesApi, environment: UpdateEnvironment, report: (state: UpdateState) => void, now: () => Date = () => new Date()): Promise<UpdateState> {
  const reason = unavailableReason(environment);
  const finish = (state: UpdateState) => {
    report(state);
    return state;
  };
  if (reason) return finish({ phase: 'unavailable', reason });
  report({ phase: 'checking' });
  try {
    const check = await api.checkForUpdateAsync();
    const checkedAt = now().toISOString();
    if (!check.isAvailable) return finish({ phase: 'upToDate', checkedAt });
    report({ phase: 'downloading' });
    const fetched = await api.fetchUpdateAsync();
    return finish(fetched.isNew ? { phase: 'downloaded', checkedAt } : { phase: 'upToDate', checkedAt });
  } catch (error) {
    return finish(isNetworkFailure(error) ? { phase: 'offline' } : { phase: 'error' });
  }
}

export type ApplyResult = 'applying' | 'blocked' | 'error';

/**
 * Redémarre l'interface sur la mise à jour téléchargée. Refusé tant qu'une sauvegarde ou une restauration est en cours (`busy`) :
 * un redémarrage au milieu couperait l'opération. L'appelant ne propose ce bouton qu'après un téléchargement réussi et l'accord explicite.
 */
export async function applyUpdate(api: UpdatesApi, busy: () => boolean): Promise<ApplyResult> {
  if (busy()) return 'blocked';
  try {
    await api.reloadAsync();
    return 'applying';
  } catch {
    return 'error';
  }
}
