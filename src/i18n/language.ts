import { getLocales } from 'expo-localization';
import Storage from 'expo-sqlite/kv-store';

import { APP_LOCALES, type AppLocale } from '@/domain/types';

// Stockage clé/valeur synchrone fourni par expo-sqlite : lisible avant le premier rendu, donc pas de « flash » de mauvaise langue.
const STORAGE_KEY = 'sovmilo.locale';

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

/** Russe si le téléphone est en russe, français sinon (langue par défaut de l'application). */
export function detectDeviceLocale(): AppLocale {
  const code = getLocales()[0]?.languageCode;
  return code === 'ru' ? 'ru' : 'fr';
}

/**
 * Langue choisie dans « Plus », ou détectée au tout premier lancement.
 * La détection est mémorisée : si le téléphone change de langue plus tard, l'application ne change pas toute seule.
 */
export function loadLocale(): AppLocale {
  try {
    const stored = Storage.getItemSync(STORAGE_KEY);
    if (isAppLocale(stored)) return stored;
  } catch {
    // stockage illisible : on retombe sur la détection
  }
  const detected = detectDeviceLocale();
  saveLocale(detected);
  return detected;
}

export function saveLocale(locale: AppLocale): void {
  try {
    Storage.setItemSync(STORAGE_KEY, locale);
  } catch {
    // pas bloquant : la langue sera simplement redétectée au prochain lancement
  }
}
