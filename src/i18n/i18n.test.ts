import { createI18n, resources } from './config';

describe('pluriels russes', () => {
  const ru = createI18n('ru');

  it.each([
    [0, '0 операций в этом месяце'],
    [1, '1 операция в этом месяце'],
    [2, '2 операции в этом месяце'],
    [4, '4 операции в этом месяце'],
    [5, '5 операций в этом месяце'],
    [11, '11 операций в этом месяце'],
    [21, '21 операция в этом месяце'],
    [22, '22 операции в этом месяце'],
    [25, '25 операций в этом месяце'],
    [111, '111 операций в этом месяце'],
  ])('%i → « %s »', (count, expected) => {
    expect(ru.t('home.monthCount', { count })).toBe(expected);
  });
});

describe('pluriels français', () => {
  const fr = createI18n('fr');

  it.each([
    [0, '0 opération ce mois-ci'], // en français, 0 est au singulier
    [1, '1 opération ce mois-ci'],
    [2, '2 opérations ce mois-ci'],
    [12, '12 opérations ce mois-ci'],
  ])('%i → « %s »', (count, expected) => {
    expect(fr.t('home.monthCount', { count })).toBe(expected);
  });
});

describe('changement de langue', () => {
  it('bascule sans toucher aux autres instances', async () => {
    const instance = createI18n('fr');
    expect(instance.t('home.addButton')).toBe('Ajouter');
    await instance.changeLanguage('ru');
    expect(instance.t('home.addButton')).toBe('Добавить');
  });
});

/** Liste les clés d'un fichier de traduction, en ramenant `x_one`, `x_few`… à `x` (les formes plurielles diffèrent selon la langue). */
function baseKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => baseKeys(value, prefix ? `${prefix}.${key}` : key));
}
const withoutPluralSuffix = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');
const uniqueBaseKeys = (translation: unknown) => [...new Set(baseKeys(translation).map(withoutPluralSuffix))].sort();

describe('complétude des traductions', () => {
  it('FR et RU ont exactement les mêmes clés', () => {
    expect(uniqueBaseKeys(resources.ru.translation)).toEqual(uniqueBaseKeys(resources.fr.translation));
  });

  it('aucune traduction n’est vide', () => {
    for (const lang of ['fr', 'ru'] as const) {
      const empty = baseKeys(resources[lang].translation).filter((k) => k === '');
      expect(empty).toEqual([]);
    }
  });

  it('chaque clé plurielle russe a ses 4 formes (one, few, many, other)', () => {
    const keys = baseKeys(resources.ru.translation);
    const pluralBases = new Set(keys.filter((k) => /_(one|few|many|other)$/.test(k)).map(withoutPluralSuffix));
    for (const base of pluralBases) {
      for (const form of ['one', 'few', 'many', 'other']) {
        expect(keys).toContain(`${base}_${form}`);
      }
    }
  });
});
