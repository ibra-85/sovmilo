import type { i18n as I18nInstance } from 'i18next';

import { formatDateWithYear, formatLongDate, formatMonthLabel, formatMonthName, formatShortDate } from '@/domain/dates';
import { formatMoneyAuto, formatMoneyParts } from '@/domain/money';

import { baseTranslationKeys, missingTranslations } from './completeness';
import { createI18n, resources } from './config';
import {
  LANGUAGE_PREFERENCE_KEY,
  LEGACY_LOCALE_KEY,
  createLanguageController,
  refreshOnForeground,
  type ForegroundSource,
  type LanguageStorage,
} from './controller';
import {
  LANGUAGE_PREFERENCES,
  localeFromLanguage,
  migrateLanguagePreference,
  parseLanguagePreference,
  resolveDeviceLocale,
  resolveLocale,
  type DeviceLocale,
} from './resolve';

/*
 * Tests unitaires de la langue : résolution, préférence, persistance, repli. Ils ne remplacent pas un essai sur téléphone
 * (voir les vérifications Android réelles à la fin de `docs/design-deviations.md`).
 */

/** Stockage en mémoire, partageable entre deux « démarrages » de l'application. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const writes: [string, string][] = [];
  const storage: LanguageStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
      writes.push([key, value]);
    },
  };
  return { storage, data, writes };
}

const device = (tag: string): DeviceLocale => ({ languageTag: tag, languageCode: tag.split('-')[0] });

describe('résolution de la langue du téléphone', () => {
  it.each([
    ['fr-FR', 'fr'],
    ['fr-CA', 'fr'],
    ['fr-BE', 'fr'],
    ['fr', 'fr'],
    ['ru-RU', 'ru'],
    ['ru-UA', 'ru'],
    ['ru', 'ru'],
    ['en-US', 'fr'],
    ['en-GB', 'fr'],
    ['de-DE', 'fr'],
    ['es-ES', 'fr'],
    ['uk-UA', 'fr'], // ukrainien : proche mais non pris en charge
    ['rue-UA', 'fr'], // « rue » n'est pas « ru »
  ])('téléphone en %s → %s', (tag, expected) => {
    expect(resolveDeviceLocale([device(tag)])).toBe(expected);
  });

  it('lit la langue préférée (la première) : une langue secondaire n\'est jamais choisie parce qu\'elle est disponible', () => {
    expect(resolveDeviceLocale([device('en-US'), device('ru-RU')])).toBe('fr');
    expect(resolveDeviceLocale([device('de-DE'), device('fr-FR')])).toBe('fr');
    expect(resolveDeviceLocale([device('ru-RU'), device('fr-FR')])).toBe('ru');
    expect(resolveDeviceLocale([device('fr-FR'), device('ru-RU')])).toBe('fr');
  });

  it('valeur système inconnue, absente ou illisible → français', () => {
    expect(resolveDeviceLocale([])).toBe('fr');
    expect(resolveDeviceLocale(null)).toBe('fr');
    expect(resolveDeviceLocale(undefined)).toBe('fr');
    expect(resolveDeviceLocale([{}])).toBe('fr');
    expect(resolveDeviceLocale([{ languageCode: null, languageTag: null }])).toBe('fr');
    expect(resolveDeviceLocale([{ languageCode: '', languageTag: '' }])).toBe('fr');
    expect(resolveDeviceLocale('ru' as never)).toBe('fr');
    expect(resolveDeviceLocale({ 0: { languageCode: 'ru' } } as never)).toBe('fr');
  });

  it('retombe sur l\'étiquette complète quand le code de langue manque', () => {
    expect(resolveDeviceLocale([{ languageCode: null, languageTag: 'ru-RU' }])).toBe('ru');
    expect(resolveDeviceLocale([{ languageTag: 'fr-CA' }])).toBe('fr');
    expect(resolveDeviceLocale([{ languageCode: 'ru' }])).toBe('ru');
  });

  it('reconnaît les écritures usuelles (majuscules, tiret bas, espaces)', () => {
    expect(localeFromLanguage('RU')).toBe('ru');
    expect(localeFromLanguage('ru_RU')).toBe('ru');
    expect(localeFromLanguage(' fr-fr ')).toBe('fr');
    expect(localeFromLanguage('en')).toBeNull();
    expect(localeFromLanguage('')).toBeNull();
    expect(localeFromLanguage(undefined)).toBeNull();
    expect(localeFromLanguage(null)).toBeNull();
  });
});

describe('préférence et choix manuel', () => {
  it('Automatique suit le téléphone ; un choix manuel l\'emporte toujours', () => {
    expect(resolveLocale('auto', [device('ru-RU')])).toBe('ru');
    expect(resolveLocale('auto', [device('en-US')])).toBe('fr');
    expect(resolveLocale('fr', [device('ru-RU')])).toBe('fr'); // téléphone en russe, Français choisi
    expect(resolveLocale('ru', [device('fr-FR')])).toBe('ru'); // téléphone en français, Русский choisi
    expect(resolveLocale('ru', [device('en-US')])).toBe('ru');
    expect(resolveLocale('fr', [])).toBe('fr');
  });

  it('trois préférences exactement, Automatique par défaut', () => {
    expect([...LANGUAGE_PREFERENCES]).toEqual(['auto', 'fr', 'ru']);
    expect(parseLanguagePreference(undefined)).toBe('auto');
    expect(parseLanguagePreference('de')).toBe('auto');
    expect(parseLanguagePreference(42)).toBe('auto');
    expect(parseLanguagePreference('ru')).toBe('ru');
  });
});

describe('contrôleur de langue : mode Automatique, mode manuel, persistance', () => {
  function start(storage: LanguageStorage, tag: () => string | null) {
    return createLanguageController({ storage, getDeviceLocales: () => (tag() === null ? [] : [device(tag() as string)]) });
  }

  it('nouvelle installation : Automatique, et la langue effective est celle du téléphone', () => {
    const fr = start(memoryStorage().storage, () => 'fr-FR');
    expect(fr.getState()).toEqual({ preference: 'auto', locale: 'fr' });
    const ru = start(memoryStorage().storage, () => 'ru-RU');
    expect(ru.getState()).toEqual({ preference: 'auto', locale: 'ru' });
    const en = start(memoryStorage().storage, () => 'en-US');
    expect(en.getState()).toEqual({ preference: 'auto', locale: 'fr' });
    const de = start(memoryStorage().storage, () => 'de-DE');
    expect(de.getState()).toEqual({ preference: 'auto', locale: 'fr' });
  });

  it('une nouvelle installation n\'écrit rien tant que l\'utilisatrice ne choisit pas', () => {
    const { storage, writes } = memoryStorage();
    start(storage, () => 'ru-RU');
    expect(writes).toEqual([]);
  });

  it('choix manuel : prioritaire sur le téléphone, et le téléphone qui change n\'y touche pas', () => {
    let tag: string | null = 'ru-RU';
    const controller = start(memoryStorage().storage, () => tag);
    controller.setPreference('fr');
    expect(controller.getState()).toEqual({ preference: 'fr', locale: 'fr' });
    tag = 'ru-RU';
    controller.refresh();
    expect(controller.getState()).toEqual({ preference: 'fr', locale: 'fr' });
    controller.setPreference('ru');
    tag = 'fr-FR';
    controller.refresh();
    expect(controller.getState()).toEqual({ preference: 'ru', locale: 'ru' });
  });

  it('retour au mode Automatique : la langue du téléphone reprend la main', () => {
    const controller = start(memoryStorage().storage, () => 'ru-RU');
    controller.setPreference('fr');
    expect(controller.getState().locale).toBe('fr');
    controller.setPreference('auto');
    expect(controller.getState()).toEqual({ preference: 'auto', locale: 'ru' });
  });

  it('« Automatique » et « Français choisi » restent deux préférences distinctes, même quand la langue est la même', () => {
    const auto = memoryStorage();
    const manual = memoryStorage();
    start(auto.storage, () => 'fr-FR').setPreference('auto');
    start(manual.storage, () => 'fr-FR').setPreference('fr');
    expect(auto.data.get(LANGUAGE_PREFERENCE_KEY)).toBe('auto');
    expect(manual.data.get(LANGUAGE_PREFERENCE_KEY)).toBe('fr');
    // Le téléphone passe ensuite au russe : Automatique suit, Français reste.
    expect(start(auto.storage, () => 'ru-RU').getState()).toEqual({ preference: 'auto', locale: 'ru' });
    expect(start(manual.storage, () => 'ru-RU').getState()).toEqual({ preference: 'fr', locale: 'fr' });
  });

  it('persistance : le choix survit à la fermeture et au redémarrage de l\'application', () => {
    const shared = memoryStorage();
    start(shared.storage, () => 'fr-FR').setPreference('ru');
    expect(start(shared.storage, () => 'fr-FR').getState()).toEqual({ preference: 'ru', locale: 'ru' });
    start(shared.storage, () => 'fr-FR').setPreference('auto');
    expect(start(shared.storage, () => 'ru-RU').getState()).toEqual({ preference: 'auto', locale: 'ru' });
  });

  it('seule la clé de langue est écrite : aucune autre donnée n\'est touchée par un changement de langue', () => {
    const { storage, writes } = memoryStorage({ 'sovmilo.theme': 'dark' });
    const controller = start(storage, () => 'fr-FR');
    controller.setPreference('ru');
    controller.setPreference('auto');
    controller.setPreference('fr');
    expect(writes.every(([key]) => key === LANGUAGE_PREFERENCE_KEY)).toBe(true);
    expect(storage.getItem('sovmilo.theme')).toBe('dark');
  });

  it('une valeur inconnue est ignorée', () => {
    const { storage, writes } = memoryStorage();
    const controller = start(storage, () => 'fr-FR');
    const before = controller.getState();
    controller.setPreference('de' as never);
    expect(controller.getState()).toBe(before);
    expect(writes).toEqual([]);
  });

  it('un stockage illisible ou en erreur ne bloque rien : Automatique, et le choix reste valable pendant la session', () => {
    const broken: LanguageStorage = {
      getItem: () => {
        throw new Error('illisible');
      },
      setItem: () => {
        throw new Error('plein');
      },
    };
    const controller = start(broken, () => 'ru-RU');
    expect(controller.getState()).toEqual({ preference: 'auto', locale: 'ru' });
    expect(() => controller.setPreference('fr')).not.toThrow();
    expect(controller.getState()).toEqual({ preference: 'fr', locale: 'fr' });
  });

  it('une lecture de la langue du téléphone qui échoue donne le français', () => {
    const controller = createLanguageController({
      storage: memoryStorage().storage,
      getDeviceLocales: () => {
        throw new Error('indisponible');
      },
    });
    expect(controller.getState()).toEqual({ preference: 'auto', locale: 'fr' });
    expect(() => controller.refresh()).not.toThrow();
  });
});

describe('compatibilité avec l\'ancienne préférence (clé sovmilo.locale)', () => {
  const start = (initial: Record<string, string>, tag = 'en-US') => {
    const memory = memoryStorage(initial);
    return { ...memory, controller: createLanguageController({ storage: memory.storage, getDeviceLocales: () => [device(tag)] }) };
  };

  it('ancien « fr » enregistré → Français conservé, même sur un téléphone russe', () => {
    const { controller } = start({ [LEGACY_LOCALE_KEY]: 'fr' }, 'ru-RU');
    expect(controller.getState()).toEqual({ preference: 'fr', locale: 'fr' });
  });

  it('ancien « ru » enregistré → Русский conservé, même sur un téléphone français ou anglais', () => {
    expect(start({ [LEGACY_LOCALE_KEY]: 'ru' }, 'fr-FR').controller.getState()).toEqual({ preference: 'ru', locale: 'ru' });
    expect(start({ [LEGACY_LOCALE_KEY]: 'ru' }, 'en-US').controller.getState()).toEqual({ preference: 'ru', locale: 'ru' });
  });

  it('aucune préférence enregistrée → Automatique', () => {
    expect(start({}, 'ru-RU').controller.getState()).toEqual({ preference: 'auto', locale: 'ru' });
    expect(start({}, 'en-US').controller.getState()).toEqual({ preference: 'auto', locale: 'fr' });
  });

  it('ancienne valeur illisible → Automatique (aucune intention n\'est inventée)', () => {
    expect(start({ [LEGACY_LOCALE_KEY]: 'de' }, 'ru-RU').controller.getState().preference).toBe('auto');
    expect(start({ [LEGACY_LOCALE_KEY]: '' }, 'ru-RU').controller.getState().preference).toBe('auto');
    expect(start({ [LANGUAGE_PREFERENCE_KEY]: 'klingon' }, 'ru-RU').controller.getState().preference).toBe('auto');
  });

  it('la reprise est écrite une seule fois au nouveau format ; l\'ancienne clé reste intacte', () => {
    const { data, writes } = start({ [LEGACY_LOCALE_KEY]: 'ru' }, 'fr-FR');
    expect(data.get(LANGUAGE_PREFERENCE_KEY)).toBe('ru');
    expect(data.get(LEGACY_LOCALE_KEY)).toBe('ru');
    expect(writes).toEqual([[LANGUAGE_PREFERENCE_KEY, 'ru']]);
  });

  it('la nouvelle préférence l\'emporte sur l\'ancienne clé : repasser en Automatique n\'est pas annulé au redémarrage', () => {
    const shared = memoryStorage({ [LEGACY_LOCALE_KEY]: 'fr' });
    createLanguageController({ storage: shared.storage, getDeviceLocales: () => [device('ru-RU')] }).setPreference('auto');
    const restarted = createLanguageController({ storage: shared.storage, getDeviceLocales: () => [device('ru-RU')] });
    expect(restarted.getState()).toEqual({ preference: 'auto', locale: 'ru' });
    expect(shared.data.get(LEGACY_LOCALE_KEY)).toBe('fr');
  });

  it('migrateLanguagePreference : la nouvelle valeur gagne, puis l\'ancienne, puis Automatique', () => {
    expect(migrateLanguagePreference('ru', 'fr')).toBe('ru');
    expect(migrateLanguagePreference('auto', 'ru')).toBe('auto');
    expect(migrateLanguagePreference(null, 'fr')).toBe('fr');
    expect(migrateLanguagePreference(undefined, undefined)).toBe('auto');
  });
});

describe('changement de langue d\'Android pendant que l\'application est en arrière-plan', () => {
  /** Faux `AppState` : compte les abonnements et permet d'émettre un changement d'état. */
  function fakeAppState() {
    const listeners = new Set<(status: string) => void>();
    const source: ForegroundSource = {
      addEventListener: (_type, listener) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    };
    return { source, listeners, emit: (status: string) => listeners.forEach((listener) => listener(status)) };
  }

  it('mode Automatique : la nouvelle langue est prise au retour au premier plan, sans redémarrage', () => {
    let tag = 'fr-FR';
    const controller = createLanguageController({ storage: memoryStorage().storage, getDeviceLocales: () => [device(tag)] });
    const appState = fakeAppState();
    refreshOnForeground(controller, appState.source);
    const seen: string[] = [];
    controller.subscribe(() => seen.push(controller.getState().locale));

    appState.emit('background');
    tag = 'ru-RU'; // l'utilisatrice change la langue d'Android
    expect(controller.getState().locale).toBe('fr'); // pas encore relue : l'application est en arrière-plan
    appState.emit('active');
    expect(controller.getState()).toEqual({ preference: 'auto', locale: 'ru' });
    expect(seen).toEqual(['ru']);
  });

  it('mode manuel : le changement de langue d\'Android ne modifie rien', () => {
    let tag = 'fr-FR';
    const shared = memoryStorage();
    const controller = createLanguageController({ storage: shared.storage, getDeviceLocales: () => [device(tag)] });
    controller.setPreference('fr');
    const appState = fakeAppState();
    refreshOnForeground(controller, appState.source);
    const listener = jest.fn();
    controller.subscribe(listener);
    const writesBefore = shared.writes.length;
    tag = 'ru-RU';
    appState.emit('active');
    expect(controller.getState()).toEqual({ preference: 'fr', locale: 'fr' });
    expect(listener).not.toHaveBeenCalled();
    expect(shared.writes).toHaveLength(writesBefore);
  });

  it('langue inchangée : aucune notification, aucune écriture, aucune boucle de mises à jour', () => {
    const shared = memoryStorage();
    const controller = createLanguageController({ storage: shared.storage, getDeviceLocales: () => [device('ru-RU')] });
    const appState = fakeAppState();
    refreshOnForeground(controller, appState.source);
    const listener = jest.fn();
    controller.subscribe(listener);
    for (let i = 0; i < 5; i += 1) appState.emit('active');
    expect(listener).not.toHaveBeenCalled();
    expect(shared.writes).toEqual([]);
  });

  it('un seul abonnement à l\'état de l\'application, et seul « active » relit la langue', () => {
    let reads = 0;
    const controller = createLanguageController({
      storage: memoryStorage().storage,
      getDeviceLocales: () => {
        reads += 1;
        return [device('fr-FR')];
      },
    });
    const appState = fakeAppState();
    const stop = refreshOnForeground(controller, appState.source);
    expect(appState.listeners.size).toBe(1);
    const readsAfterStart = reads;
    appState.emit('background');
    appState.emit('inactive');
    expect(reads).toBe(readsAfterStart);
    appState.emit('active');
    expect(reads).toBe(readsAfterStart + 1);
    stop();
    expect(appState.listeners.size).toBe(0);
  });

  it('plusieurs allers-retours : la langue suit le téléphone chaque fois, le choix manuel reprend la main', () => {
    let tag = 'fr-FR';
    const controller = createLanguageController({ storage: memoryStorage().storage, getDeviceLocales: () => [device(tag)] });
    const appState = fakeAppState();
    refreshOnForeground(controller, appState.source);
    for (const [next, expected] of [['ru-RU', 'ru'], ['en-US', 'fr'], ['ru-UA', 'ru'], ['fr-CA', 'fr']] as const) {
      tag = next;
      appState.emit('active');
      expect(controller.getState().locale).toBe(expected);
    }
    controller.setPreference('ru');
    tag = 'fr-FR';
    appState.emit('active');
    expect(controller.getState().locale).toBe('ru');
  });
});

describe('repli français des traductions', () => {
  /** Traductions volontairement incomplètes : le russe n'a pas `menu.extra`. */
  const partial = {
    fr: { translation: { menu: { title: 'Menu', extra: 'Seulement en français' }, count_one: '{{count}} élément', count_other: '{{count}} éléments' } },
    ru: { translation: { menu: { title: 'Меню' }, count_one: '{{count}} элемент', count_few: '{{count}} элемента', count_many: '{{count}} элементов', count_other: '{{count}} элемента' } },
  };
  const tr = (instance: I18nInstance, key: string, options?: Record<string, unknown>) => String(instance.t(key as never, options as never));

  it('clé absente en russe → le texte français correspondant, jamais l\'identifiant technique', () => {
    const ru = createI18n('ru', partial);
    expect(tr(ru, 'menu.title')).toBe('Меню');
    expect(tr(ru, 'menu.extra')).toBe('Seulement en français');
    expect(tr(ru, 'menu.extra')).not.toContain('menu.');
  });

  it('les pluriels russes restent corrects à côté du repli', () => {
    const ru = createI18n('ru', partial);
    expect(tr(ru, 'count', { count: 1 })).toBe('1 элемент');
    expect(tr(ru, 'count', { count: 3 })).toBe('3 элемента');
    expect(tr(ru, 'count', { count: 5 })).toBe('5 элементов');
    expect(tr(ru, 'count', { count: 21 })).toBe('21 элемент');
  });

  it('le repli ne masque pas l\'erreur de traduction : la clé manquante est détectée', () => {
    expect(missingTranslations(partial.fr.translation, partial.ru.translation)).toEqual(['menu.extra']);
    expect(missingTranslations(partial.ru.translation, partial.fr.translation)).toEqual([]);
    // Les formes plurielles ne comptent pas comme des clés différentes.
    expect(baseTranslationKeys(partial.ru.translation)).toEqual(['count', 'menu.title']);
  });

  it('les vraies traductions : aucune clé française absente en russe (le repli ne sert qu\'en secours)', () => {
    expect(missingTranslations(resources.fr.translation, resources.ru.translation)).toEqual([]);
    expect(missingTranslations(resources.ru.translation, resources.fr.translation)).toEqual([]);
  });

  it('clé absente partout : en développement elle reste visible pour être corrigée', () => {
    const ru = createI18n('ru', partial);
    expect(tr(ru, 'menu.inconnue')).toBe('menu.inconnue');
  });

  it('clé absente partout : en production, aucun identifiant technique à l\'écran', () => {
    const globals = globalThis as { __DEV__?: boolean };
    const original = globals.__DEV__;
    globals.__DEV__ = false;
    try {
      let production: typeof import('./config') | undefined;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        production = require('./config') as typeof import('./config');
      });
      if (!production) throw new Error('config non chargée');
      const ru = production.createI18n('ru', partial);
      expect(tr(ru, 'menu.inconnue')).toBe('');
      expect(tr(ru, 'menu.extra')).toBe('Seulement en français'); // le repli français fonctionne aussi en production
    } finally {
      globals.__DEV__ = original;
    }
  });

  it('une langue d\'interface, deux textes : le français ne devient pas du russe et inversement', () => {
    const fr = createI18n('fr');
    const ru = createI18n('ru');
    expect(tr(fr, 'settings.languageAuto')).toBe('Automatique');
    expect(tr(ru, 'settings.languageAuto')).toBe('Автоматически');
    expect(tr(fr, 'settings.languageAutoActive', { language: 'Русский' })).toBe('Suit le téléphone · Русский');
    expect(tr(ru, 'settings.languageAutoActive', { language: 'Français' })).toBe('Как в телефоне · Français');
  });
});

describe('dates, montants et libellés selon la langue effective', () => {
  it('les noms des mois et des jours changent de langue', () => {
    expect(formatMonthName('2026-11', 'fr')).toBe('novembre');
    expect(formatMonthName('2026-11', 'ru')).toBe('ноябрь');
    expect(formatMonthLabel('2026-03', 'fr')).toBe('Mars 2026');
    expect(formatMonthLabel('2026-03', 'ru')).toMatch(/^Март 2026/);
    expect(formatLongDate('2026-03-17', 'fr')).toBe('mardi 17 mars 2026');
    expect(formatLongDate('2026-03-17', 'ru')).toMatch(/вторник/);
    expect(formatShortDate('2026-11-12', 'fr')).toBe('12 nov.');
    expect(formatShortDate('2026-11-12', 'ru')).toMatch(/12\s+нояб/);
    expect(formatDateWithYear('2026-11-12', 'ru')).toMatch(/2026/);
  });

  it('les montants gardent la même valeur et la même devise (euro), seule la présentation suit la langue', () => {
    for (const locale of ['fr', 'ru'] as const) {
      expect(formatMoneyAuto(123_456, locale)).toMatch(/^1\s234,56\s€$/);
      expect(formatMoneyAuto(100_000, locale)).toMatch(/^1\s000\s€$/);
      expect(formatMoneyParts(123_456, locale).currency).toBe('€');
    }
  });

  it('un changement de langue ne modifie aucun montant : mêmes centimes en entrée, mêmes chiffres en sortie', () => {
    const digits = (text: string) => text.replace(/\D/g, '');
    for (const cents of [0, 1, 99, 2_999, 123_456, 99_999_999_999]) {
      expect(digits(formatMoneyAuto(cents, 'fr'))).toBe(digits(formatMoneyAuto(cents, 'ru')));
    }
  });

  it('les libellés de bascule sont traduits (TalkBack lit les mêmes textes)', () => {
    const fr = createI18n('fr');
    const ru = createI18n('ru');
    expect(fr.t('languages.fr')).toBe('Français');
    expect(ru.t('languages.fr')).toBe('Français'); // le nom d'une langue s'écrit toujours dans cette langue
    expect(ru.t('languages.ru')).toBe('Русский');
    expect(fr.t('settings.languageAutoText')).toBe('Suit la langue du téléphone');
    expect(ru.t('settings.languageAutoText')).toBe('Как язык телефона');
  });
});
