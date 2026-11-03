import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';

import { getLiveEpoch, recordLiveError, subscribeLiveEpoch } from './live-store';

/**
 * `useLiveQuery` de Drizzle (la requête se met à jour toute seule quand la table change), avec deux ajouts :
 *  - l'époque des données fait partie de ses dépendances : « tirer pour actualiser » (`refreshLiveData`) la relit pour de bon ;
 *  - une requête qui échoue est mémorisée (`takeLiveError`) au lieu d'être silencieusement ignorée.
 * Même signature que `useLiveQuery`.
 */
export function useLive<Query extends Parameters<typeof useLiveQuery>[0]>(query: Query, deps: unknown[] = []): ReturnType<typeof useLiveQuery<Query>> {
  const epoch = useSyncExternalStore(subscribeLiveEpoch, getLiveEpoch);
  const result = useLiveQuery(query, [...deps, epoch]);
  const { error } = result;
  useEffect(() => {
    if (error) recordLiveError(error);
  }, [error]);
  return result as ReturnType<typeof useLiveQuery<Query>>;
}
