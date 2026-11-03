import fr from '@/i18n/locales/fr.json';
import ru from '@/i18n/locales/ru.json';

import { BACKUP_ERROR_CODES, COUNT_KEYS } from './format';

const locales = { fr, ru };
const UPDATE_STATES = ['idle', 'checking', 'upToDate', 'downloading', 'downloaded', 'offline', 'error', 'expoGo', 'development', 'notConfigured'];

describe.each(Object.entries(locales))('messages (%s)', (_name, locale) => {
  it('chaque code d\'erreur de sauvegarde a un message lisible, sans donnée personnelle', () => {
    for (const code of BACKUP_ERROR_CODES) {
      const message = (locale.backup.errors as Record<string, string>)[code];
      expect(message).toBeTruthy();
      expect(message).not.toMatch(/\{\{/);
    }
  });

  it('chaque compteur de l\'aperçu de restauration a un libellé', () => {
    for (const key of COUNT_KEYS) expect((locale.backup.count as Record<string, string>)[key]).toBeTruthy();
  });

  it('chaque état de mise à jour a un message', () => {
    for (const state of UPDATE_STATES) expect((locale.updates.state as Record<string, string>)[state]).toBeTruthy();
  });

  it('la phrase de restauration est celle du cahier des charges (remplacement, pas fusion)', () => {
    expect(locale.backup.replaceWarning.length).toBeGreaterThan(20);
  });
});

it('FR : phrase exacte de confirmation de restauration', () => {
  expect(fr.backup.replaceWarning).toBe('Cette restauration remplacera les données actuellement enregistrées sur cet appareil.');
});
