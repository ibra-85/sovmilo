import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Updates from 'expo-updates';
import { useCallback, useRef, useState } from 'react';

import { currentMaintenance } from '@/db/maintenance';

import { applyUpdate, checkForUpdate, unavailableReason, type UpdateEnvironment, type UpdateState } from './update-flow';

function readEnvironment(): UpdateEnvironment {
  return {
    isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    isDevelopmentBuild: __DEV__,
    isUpdatesEnabled: Updates.isEnabled,
  };
}

export type UpdateNotice = 'blocked' | 'error' | null;

/**
 * Colle `update-flow.ts` (testé) à `expo-updates`. Dans Expo Go ou en développement, l'état est « indisponible » dès l'ouverture et
 * l'API native n'est JAMAIS appelée. Le téléchargement n'applique rien : le redémarrage est une seconde action, confirmée.
 */
export function useUpdates() {
  const [environment] = useState(readEnvironment);
  const initialReason = unavailableReason(environment);
  const [state, setState] = useState<UpdateState>(initialReason ? { phase: 'unavailable', reason: initialReason } : { phase: 'idle' });
  const [notice, setNotice] = useState<UpdateNotice>(null);
  const running = useRef(false);

  const check = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setNotice(null);
    try {
      await checkForUpdate(Updates, environment, setState);
    } finally {
      running.current = false;
    }
  }, [environment]);

  const apply = useCallback(async () => {
    const result = await applyUpdate(Updates, () => currentMaintenance() !== null);
    setNotice(result === 'applying' ? null : result);
  }, []);

  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const available = state.phase !== 'unavailable';

  return {
    state,
    notice,
    busy,
    available,
    check,
    apply,
    version: Constants.expoConfig?.version ?? '',
    build: Constants.expoConfig?.android?.versionCode,
    channel: Updates.channel,
  };
}
