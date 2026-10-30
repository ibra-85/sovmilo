import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { AppLocale } from '@/domain/types';

import fr from './locales/fr.json';
import ru from './locales/ru.json';

export const resources = {
  fr: { translation: fr },
  ru: { translation: ru },
} as const;

/** Rend `t('home.addButton')` vérifié par TypeScript : une clé inexistante ne compile pas. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof fr };
  }
}

/**
 * Crée une instance i18next. Séparée de la détection de langue (language.ts) pour rester testable sans module natif.
 * Les pluriels (notamment les 3 formes russes : 1 операция / 2 операции / 5 операций) sont gérés
 * par i18next via `Intl.PluralRules` : il suffit d'écrire les clés `_one`, `_few`, `_many`, `_other`.
 */
export function createI18n(locale: AppLocale): I18nInstance {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false }, // React Native n'interprète pas le HTML
    initAsync: false, // les ressources sont en mémoire : initialisation synchrone, pas d'écran vide au démarrage
    returnNull: false,
  });
  return instance;
}
