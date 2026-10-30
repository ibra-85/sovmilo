import type { AppLocale } from '@/domain/types';

import { createI18n } from './config';
import { loadLocale, saveLocale } from './language';

/** Instance unique de l'application, initialisée avec la langue mémorisée ou détectée. */
export const i18n = createI18n(loadLocale());

/** Change la langue de l'interface et la mémorise. */
export async function setAppLocale(locale: AppLocale): Promise<void> {
  saveLocale(locale);
  await i18n.changeLanguage(locale);
}
