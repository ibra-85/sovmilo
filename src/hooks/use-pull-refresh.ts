import { useCallback, useRef, useState } from 'react';

export type RefreshOutcome = 'done' | 'skipped' | 'failed';

/**
 * Exécute `task` une seule fois à la fois : tant que `gate.running` est vrai, un nouvel appel est ignoré (`skipped`) au lieu de
 * lancer un second traitement en parallèle. Le verrou est TOUJOURS relâché, même si la tâche échoue (`failed`). Aucun délai
 * artificiel : la durée est celle de la tâche.
 */
export async function runGuarded(gate: { running: boolean }, task: () => void | Promise<void>): Promise<RefreshOutcome> {
  if (gate.running) return 'skipped';
  gate.running = true;
  try {
    await task();
    return 'done';
  } catch {
    return 'failed';
  } finally {
    gate.running = false;
  }
}

/**
 * « Tirer pour actualiser » : `refreshing` pilote le `RefreshControl`, `onRefresh` lance `task` (relecture ou recalcul RÉEL,
 * jamais une attente factice). Un tirage pendant une actualisation en cours est ignoré ; en cas d'échec, `onError` est appelé et
 * l'indicateur s'arrête quand même. `enabled: false` (par exemple pendant une réorganisation) rend le geste sans effet.
 */
export function usePullRefresh(task: () => void | Promise<void>, options: { enabled?: boolean; onError?: () => void } = {}) {
  const { enabled = true, onError } = options;
  const gate = useRef({ running: false });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!enabled || gate.current.running) return;
    setRefreshing(true);
    const outcome = await runGuarded(gate.current, task);
    if (outcome === 'failed') onError?.();
    setRefreshing(false);
  }, [enabled, task, onError]);

  return { refreshing, onRefresh };
}
