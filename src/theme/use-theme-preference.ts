import Storage from 'expo-sqlite/kv-store';
import { Appearance } from 'react-native';
import { useSyncExternalStore } from 'react';

import { DEFAULT_THEME_PREFERENCE, parseThemePreference, toColorSchemeOverride, type ThemePreference } from './preference';

// Même stockage synchrone que la langue : lisible avant le premier rendu, donc pas de flash du mauvais thème.
const STORAGE_KEY = 'sovmilo.theme';

let current: ThemePreference = DEFAULT_THEME_PREFERENCE;
const listeners = new Set<() => void>();

function readStored(): ThemePreference {
  try {
    return parseThemePreference(Storage.getItemSync(STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

/**
 * À appeler UNE fois, avant le premier rendu (module racine) : relit la préférence mémorisée et l'applique au système.
 * Ainsi le premier écran s'affiche déjà dans le bon thème.
 */
export function restoreThemePreference(): void {
  current = readStored();
  Appearance.setColorScheme(toColorSchemeOverride(current));
}

/** Change l'apparence : appliquée tout de suite à toute l'application, puis mémorisée. */
export function setThemePreference(preference: ThemePreference): void {
  current = preference;
  Appearance.setColorScheme(toColorSchemeOverride(preference));
  try {
    Storage.setItemSync(STORAGE_KEY, preference);
  } catch {
    // pas bloquant : le choix reste valable jusqu'à la fermeture de l'application
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Préférence choisie (« Système », « Clair », « Sombre »), pour l'écran Paramètres. Le thème effectif vient de `useTheme()`. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_THEME_PREFERENCE);
}
