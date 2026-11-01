import { createI18n, resources } from './config';

describe('pluriels russes', () => {
  const ru = createI18n('ru');

  it.each([
    [0, '0 бюджетов'],
    [1, '1 бюджет'],
    [2, '2 бюджета'],
    [4, '4 бюджета'],
    [5, '5 бюджетов'],
    [11, '11 бюджетов'],
    [21, '21 бюджет'],
    [22, '22 бюджета'],
    [25, '25 бюджетов'],
    [111, '111 бюджетов'],
  ])('%i → « %s »', (count, expected) => {
    expect(ru.t('budget.count', { count })).toBe(expected);
  });
});

describe('pluriels français', () => {
  const fr = createI18n('fr');

  it.each([
    [0, '0 budget'], // en français, 0 est au singulier
    [1, '1 budget'],
    [2, '2 budgets'],
    [12, '12 budgets'],
  ])('%i → « %s »', (count, expected) => {
    expect(fr.t('budget.count', { count })).toBe(expected);
  });
});

describe('changement de langue', () => {
  it('bascule sans toucher aux autres instances', async () => {
    const instance = createI18n('fr');
    expect(instance.t('nav.addExpense')).toBe('Ajouter une dépense');
    await instance.changeLanguage('ru');
    expect(instance.t('nav.addExpense')).toBe('Добавить расход');
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

describe('menu d’une catégorie personnalisée : libellés courts, noms d’accessibilité explicites', () => {
  const fr = createI18n('fr');
  const ru = createI18n('ru');

  it('affiche « Modifier » et « Supprimer » (français et russe)', () => {
    expect(fr.t('categoryManager.edit')).toBe('Modifier');
    expect(fr.t('categoryManager.delete')).toBe('Supprimer');
    expect(ru.t('categoryManager.edit')).toBe('Изменить');
    expect(ru.t('categoryManager.delete')).toBe('Удалить');
  });

  it('garde le nom de la catégorie dans le libellé lu par TalkBack', () => {
    expect(fr.t('categoryManager.deleteA11y', { name: 'Test' })).toBe('Supprimer la catégorie Test');
    expect(fr.t('categoryManager.editA11y', { name: 'Test' })).toBe('Modifier la catégorie Test');
    expect(ru.t('categoryManager.deleteA11y', { name: 'Тест' })).toBe('Удалить категорию Тест');
    expect(ru.t('categoryManager.editA11y', { name: 'Тест' })).toBe('Изменить категорию Тест');
  });

  it('ne change pas le menu d’une opération', () => {
    expect(fr.t('detail.edit')).toBe('Modifier l’opération');
    expect(fr.t('detail.delete')).toBe('Supprimer l’opération');
    expect(ru.t('detail.delete')).toBe('Удалить операцию');
  });
});
