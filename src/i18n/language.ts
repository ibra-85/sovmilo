import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';

import type { LanguageStorage } from './controller';
import type { DeviceLocale } from './resolve';

// Stockage clé/valeur synchrone fourni par expo-sqlite : lisible avant le premier rendu, donc pas de « flash » de mauvaise langue.
export const kvStorage: LanguageStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
};

/** Langues du téléphone, la préférée en premier. Illisibles : liste vide, donc français (voir `resolveDeviceLocale`). */
export function readDeviceLocales(): readonly DeviceLocale[] {
  try {
    return getLocales();
  } catch {
    return [];
  }
}
