import { APP_LOCALES, type AppLocale } from '@/domain/types';

/**
 * Choix de langue de l'utilisatrice et résolution vers la langue effective. Fonctions PURES (aucun module natif) : testées
 * telles quelles ; le stockage et la lecture des réglages d'Android sont dans `language.ts`.
 *
 * Deux notions distinctes :
 *  - la PRÉFÉRENCE (`auto`, `fr`, `ru`) : ce que l'utilisatrice a choisi, mémorisé tel quel ;
 *  - la langue EFFECTIVE (`fr`, `ru`) : celle de l'interface, déduite de la préférence et du téléphone.
 * On ne mémorise jamais la langue effective à la place de la préférence : « Automatique » et « Français choisi » seraient confondus.
 */
export const LANGUAGE_PREFERENCES = ['auto', ...APP_LOCALES] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'auto';

/** Langue utilisée quand celle du téléphone n'est pas prise en charge (et pour toute traduction manquante). */
export const FALLBACK_LOCALE: AppLocale = 'fr';

/** Ce que Sovmilo lit d'une entrée de `expo-localization` (`getLocales()`) ; les deux champs peuvent manquer. */
export interface DeviceLocale {
  languageCode?: string | null;
  languageTag?: string | null;
}

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return typeof value === 'string' && (LANGUAGE_PREFERENCES as readonly string[]).includes(value);
}

/** Valeur mémorisée → préférence ; toute valeur illisible donne « Automatique ». */
export function parseLanguagePreference(value: unknown): LanguagePreference {
  return isLanguagePreference(value) ? value : DEFAULT_LANGUAGE_PREFERENCE;
}

/** `fr`, `fr-CA`, `ru_RU`, `RU-ru` → langue prise en charge ; toute autre langue (ou valeur absente) donne `null`. */
export function localeFromLanguage(code: string | null | undefined): AppLocale | null {
  if (typeof code !== 'string') return null;
  const primary = code.trim().toLowerCase().split(/[-_]/)[0];
  return isAppLocale(primary) ? primary : null;
}

/**
 * Langue de l'interface déduite du téléphone : on lit UNIQUEMENT la langue préférée (la première). Une langue secondaire n'est
 * jamais choisie parce qu'elle est disponible : un téléphone « anglais puis russe » reste en français. Liste vide, absente ou
 * illisible : français.
 */
export function resolveDeviceLocale(deviceLocales: readonly DeviceLocale[] | null | undefined): AppLocale {
  const first = Array.isArray(deviceLocales) ? (deviceLocales[0] as DeviceLocale | undefined) : undefined;
  if (!first) return FALLBACK_LOCALE;
  return localeFromLanguage(first.languageCode) ?? localeFromLanguage(first.languageTag) ?? FALLBACK_LOCALE;
}

/** Le choix manuel l'emporte toujours sur le téléphone ; « Automatique » suit le téléphone. */
export function resolveLocale(preference: LanguagePreference, deviceLocales: readonly DeviceLocale[] | null | undefined): AppLocale {
  return preference === 'auto' ? resolveDeviceLocale(deviceLocales) : preference;
}

/**
 * Préférence à utiliser au démarrage à partir de ce qui est mémorisé.
 *  - la préférence actuelle, si elle existe : elle gagne toujours ;
 *  - sinon l'ANCIEN format (`sovmilo.locale` = `fr` ou `ru`) est repris comme choix manuel ;
 *  - sinon (nouvelle installation) : Automatique.
 * Limite : l'ancien format enregistrait aussi la langue DÉTECTÉE au premier lancement, sans pouvoir la distinguer d'un vrai choix.
 * Une valeur ancienne est donc conservée telle quelle (stratégie non destructive) ; l'utilisatrice peut repasser en Automatique.
 */
export function migrateLanguagePreference(stored: unknown, legacyLocale: unknown): LanguagePreference {
  if (isLanguagePreference(stored)) return stored;
  if (isAppLocale(legacyLocale)) return legacyLocale;
  return DEFAULT_LANGUAGE_PREFERENCE;
}
