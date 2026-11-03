/**
 * « Époque » des données en direct : un compteur partagé par toutes les requêtes `useLive`. L'incrémenter (`refreshLiveData`)
 * fait ré-exécuter chaque requête SQLite des écrans montés et reposer leur abonnement aux changements : c'est la relecture réelle
 * derrière « tirer pour actualiser ». Aucune donnée n'est écrite ; une relecture lit l'état de la base AU MOMENT où elle
 * s'exécute (SQLite est synchrone), donc elle ne peut pas remettre une ancienne valeur par-dessus une écriture plus récente.
 *
 * Module sans React : le compteur, les abonnements et la dernière erreur de requête sont testés à part.
 */
let epoch = 0;
let lastError: unknown = null;
const listeners = new Set<() => void>();

export function getLiveEpoch(): number {
  return epoch;
}

export function subscribeLiveEpoch(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Demande à toutes les requêtes en direct de se relire. Renvoie la nouvelle époque. */
export function refreshLiveData(): number {
  epoch += 1;
  for (const listener of [...listeners]) listener();
  return epoch;
}

/** Une requête en direct a échoué (mémorisé pour que l'actualisation puisse le signaler). */
export function recordLiveError(error: unknown): void {
  lastError = error;
}

/** Dernière erreur de requête, une seule fois : la lire la remet à zéro. */
export function takeLiveError(): unknown {
  const error = lastError;
  lastError = null;
  return error;
}
