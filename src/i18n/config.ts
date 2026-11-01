import { createInstance, type i18n as I18nInstance, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { AppLocale } from '@/domain/types';

import { FALLBACK_LOCALE } from './resolve';
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

/** En développement, une clé introuvable reste visible (pour être corrigée) ; en production, jamais d'identifiant technique à l'écran. */
const showTechnicalKeys = __DEV__;

/**
 * Crée une instance i18next. Séparée de la détection de langue (language.ts) pour rester testable sans module natif.
 * Les pluriels (notamment les 3 formes russes : 1 операция / 2 операции / 5 операций) sont gérés
 * par i18next via `Intl.PluralRules` : il suffit d'écrire les clés `_one`, `_few`, `_many`, `_other`.
 *
 * Repli : une clé absente de la langue demandée s'affiche en français (`fallbackLng`). Ce repli ne dispense pas de traduire : la
 * parité FR/RU est vérifiée par les tests (voir `completeness.ts`). `bundle` ne sert qu'aux tests (traductions volontairement incomplètes).
 */
export function createI18n(locale: AppLocale, bundle: Resource = resources): I18nInstance {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources: bundle,
    lng: locale,
    fallbackLng: FALLBACK_LOCALE,
    interpolation: { escapeValue: false }, // React Native n'interprète pas le HTML
    initAsync: false, // les ressources sont en mémoire : initialisation synchrone, pas d'écran vide au démarrage
    returnNull: false,
    parseMissingKeyHandler: (key: string) => (showTechnicalKeys ? key : ''),
  });
  return instance;
}
