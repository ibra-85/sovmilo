import { useTranslation } from 'react-i18next';

import type { AppLocale } from '@/domain/types';

/** Langue active de l'interface ; le composant se met à jour quand l'utilisatrice change de langue. */
export function useLocale(): AppLocale {
  const { i18n } = useTranslation();
  return i18n.language === 'ru' ? 'ru' : 'fr';
}
