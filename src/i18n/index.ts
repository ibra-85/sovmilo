import { AppState } from 'react-native';

import { createI18n, resources } from './config';
import { missingTranslations } from './completeness';
import { createLanguageController, refreshOnForeground } from './controller';
import { kvStorage, readDeviceLocales } from './language';
import type { LanguagePreference } from './resolve';

/**
 * Langue de l'application : préférence mémorisée (Automatique, Français ou Русский), résolue avec la langue du téléphone.
 * Lue de façon synchrone avant le premier rendu : pas de « flash » de mauvaise langue.
 */
export const languageController = createLanguageController({ storage: kvStorage, getDeviceLocales: readDeviceLocales });

/** Instance unique de l'application, initialisée avec la langue effective. */
export const i18n = createI18n(languageController.getState().locale);

// Appliquée seulement si la langue effective a changé : changer de préférence sans changer de langue (Automatique → Français sur
// un téléphone français) ne relance aucun rendu de traduction. Abonné AVANT les écrans, pour que le texte soit déjà à jour.
languageController.subscribe(() => {
  const { locale } = languageController.getState();
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
});

// Sur Android la langue du téléphone peut changer pendant que l'application est en arrière-plan : relue au retour au premier plan
// (mode Automatique seulement). Un seul abonnement pour toute la vie de l'application.
refreshOnForeground(languageController, AppState);

// Développement : le repli sur le français masque une clé russe manquante à l'écran, on la signale ici.
if (__DEV__) {
  const missing = missingTranslations(resources.fr.translation, resources.ru.translation);
  if (missing.length > 0) console.warn(`[i18n] ${missing.length} clé(s) absente(s) en russe (affichées en français) : ${missing.join(', ')}`);
}

/** Change le choix de langue de l'utilisatrice : appliqué tout de suite et mémorisé. */
export function setLanguagePreference(preference: LanguagePreference): void {
  languageController.setPreference(preference);
}
