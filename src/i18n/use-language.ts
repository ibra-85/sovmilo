import { useSyncExternalStore } from 'react';

import type { LanguageState } from './controller';
import { languageController } from './index';

/** Choix de langue (Automatique, Français, Русский) et langue effective, pour l'écran Paramètres. */
export function useLanguageState(): LanguageState {
  return useSyncExternalStore(languageController.subscribe, languageController.getState, languageController.getState);
}
