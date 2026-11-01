import type { AppLocale } from '@/domain/types';

import {
  isAppLocale,
  isLanguagePreference,
  migrateLanguagePreference,
  resolveLocale,
  type DeviceLocale,
  type LanguagePreference,
} from './resolve';

/** Préférence de langue : `auto`, `fr` ou `ru`. */
export const LANGUAGE_PREFERENCE_KEY = 'sovmilo.languagePreference';
/** Ancien format (avant le mode Automatique) : la langue, `fr` ou `ru`, choisie OU détectée au premier lancement. */
export const LEGACY_LOCALE_KEY = 'sovmilo.locale';

/** Stockage clé/valeur synchrone (en production : `expo-sqlite/kv-store`). Peut lever : le contrôleur n'en dépend jamais pour fonctionner. */
export interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LanguageState {
  /** Ce qu'a choisi l'utilisatrice. */
  preference: LanguagePreference;
  /** La langue de l'interface. */
  locale: AppLocale;
}

export interface LanguageController {
  /** Instantané stable : le même objet tant que rien ne change (pour `useSyncExternalStore`). */
  getState(): LanguageState;
  /** Change le choix : mémorisé et appliqué tout de suite. Une valeur inconnue est ignorée. */
  setPreference(preference: LanguagePreference): void;
  /**
   * Relit la langue du téléphone. N'a d'effet qu'en mode Automatique, et seulement si la langue effective a changé : un choix manuel
   * n'est jamais modifié, et rien n'est notifié (ni écrit) quand rien ne change.
   */
  refresh(): void;
  subscribe(listener: () => void): () => void;
}

export interface LanguageControllerDeps {
  storage: LanguageStorage;
  /** Langues du téléphone, la préférée en premier (`getLocales()` de `expo-localization`). */
  getDeviceLocales: () => readonly DeviceLocale[];
}

export function createLanguageController({ storage, getDeviceLocales }: LanguageControllerDeps): LanguageController {
  const read = (key: string): string | null => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string): void => {
    try {
      storage.setItem(key, value);
    } catch {
      // pas bloquant : le choix reste valable jusqu'à la fermeture de l'application
    }
  };
  const readDevice = (): readonly DeviceLocale[] => {
    try {
      return getDeviceLocales();
    } catch {
      return [];
    }
  };

  const stored = read(LANGUAGE_PREFERENCE_KEY);
  const legacy = read(LEGACY_LOCALE_KEY);
  const initial = migrateLanguagePreference(stored, legacy);
  // Reprise de l'ancien choix : écrite une fois, au nouveau format (l'ancienne clé reste en place, intacte).
  if (!isLanguagePreference(stored) && isAppLocale(legacy)) write(LANGUAGE_PREFERENCE_KEY, initial);

  let state: LanguageState = { preference: initial, locale: resolveLocale(initial, readDevice()) };
  const listeners = new Set<() => void>();

  const commit = (next: LanguageState): void => {
    if (next.preference === state.preference && next.locale === state.locale) return;
    state = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    setPreference(preference) {
      if (!isLanguagePreference(preference)) return;
      write(LANGUAGE_PREFERENCE_KEY, preference);
      commit({ preference, locale: resolveLocale(preference, readDevice()) });
    },
    refresh() {
      if (state.preference !== 'auto') return;
      commit({ preference: 'auto', locale: resolveLocale('auto', readDevice()) });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Ce que Sovmilo utilise de `AppState` (react-native) : un abonnement aux changements d'état. */
export interface ForegroundSource {
  addEventListener(type: 'change', listener: (status: string) => void): { remove(): void };
}

/**
 * Relit la langue du téléphone chaque fois que l'application revient au premier plan (sur Android, le réglage de langue peut
 * changer pendant qu'elle est en arrière-plan). UN seul abonnement ; renvoie sa fonction de désabonnement.
 */
export function refreshOnForeground(controller: Pick<LanguageController, 'refresh'>, source: ForegroundSource): () => void {
  const subscription = source.addEventListener('change', (status) => {
    if (status === 'active') controller.refresh();
  });
  return () => subscription.remove();
}
