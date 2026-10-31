/**
 * Préférence d'apparence choisie dans Paramètres. Fonctions pures (testées) ; le stockage et le hook sont dans
 * `use-theme-preference.ts`.
 *
 * Source de vérité unique du thème : on ne duplique PAS l'état clair / sombre. La préférence est appliquée au système
 * (`Appearance.setColorScheme`) ; ensuite `useColorScheme()` — donc `useTheme()` — et tous les composants natifs
 * (sélecteur de date, barre d'état, fenêtres modales) suivent le même réglage. « Système » rend la main à Android.
 */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Valeur mémorisée → préférence ; toute valeur illisible donne « Système ». */
export function parseThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

/** Préférence → valeur attendue par `Appearance.setColorScheme` (`'auto'` : suivre le téléphone, Android décide). */
export function toColorSchemeOverride(preference: ThemePreference): 'light' | 'dark' | 'auto' {
  return preference === 'system' ? 'auto' : preference;
}
