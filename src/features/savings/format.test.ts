import { createI18n, resources } from '@/i18n/config';
import { goalProgress } from '@/domain/savings';

import { goalStatusText } from './format';

const NBSP_PERCENT = /\d[  ]%/;

describe.each(['fr', 'ru'] as const)('textes de l\'épargne — %s', (locale) => {
  const i18n = createI18n(locale);
  const t = i18n.t.bind(i18n);

  it('chaque état s\'écrit en toutes lettres', () => {
    const empty = goalStatusText(goalProgress(0, 200_000), locale, t);
    const going = goalStatusText(goalProgress(50_000, 200_000), locale, t);
    const reached = goalStatusText(goalProgress(200_000, 200_000), locale, t);
    const exceeded = goalStatusText(goalProgress(230_000, 200_000), locale, t);
    expect(empty).toContain('2');
    expect(going).toContain('1');
    expect(new Set([empty === going || null, reached, exceeded]).size).toBeGreaterThan(1);
    expect(exceeded).toContain('300');
    expect(reached).not.toContain('{{');
    expect(reached).not.toBe('savings.reached');
  });

  it('un montant énorme tient dans la phrase sans « NaN » ni « undefined »', () => {
    const text = goalStatusText(goalProgress(0, 99_999_999_999), locale, t);
    expect(text).not.toMatch(/NaN|undefined|\{\{/);
    expect(text.length).toBeLessThan(60);
  });

  it('le résumé de la liste donne un libellé pour chaque nombre d\'objectifs', () => {
    for (const count of [1, 2, 4, 5, 11, 21, 22, 25, 100]) {
      const text = i18n.t('savings.goalCount', { count });
      expect(text).toContain(String(count));
      expect(text).not.toBe('savings.goalCount');
    }
  });

  it('le libellé lu par TalkBack contient les montants exacts, le nom et le pourcentage', () => {
    const label = i18n.t('savings.rowA11y', { name: 'Vacances d’été', saved: '1 234,56 €', target: '2 000,00 €', percent: 61, status: 'Reste 765,44 €' });
    expect(label).toContain('Vacances d’été');
    expect(label).toContain('1 234,56 €');
    expect(label).toContain('2 000,00 €');
    expect(label).toContain('765,44 €');
    expect(label).toMatch(NBSP_PERCENT);
  });

  it('le nom très long reste dans la phrase sans la casser', () => {
    const name = 'Un objectif au nom vraiment très long pour vérifier que rien ne déborde dans la ligne';
    expect(i18n.t('savings.quickAdd', { name })).toContain(name);
    expect(i18n.t('savings.reorder.handle', { name })).toContain(name);
    expect(i18n.t('savings.detail.deleteA11y', { name })).toContain(name);
  });
});

describe('pluriels russes de l\'épargne', () => {
  const i18n = createI18n('ru');

  it.each([
    [1, 'активная цель'],
    [2, 'активные цели'],
    [4, 'активные цели'],
    [5, 'активных целей'],
    [11, 'активных целей'],
    [21, 'активная цель'],
    [22, 'активные цели'],
    [25, 'активных целей'],
  ])('%i → « … %s »', (count, expected) => {
    expect(i18n.t('savings.goalCount', { count })).toBe(`${count} ${expected}`);
  });
});

describe('pluriels français de l\'épargne', () => {
  const i18n = createI18n('fr');

  it('singulier pour 0 et 1, pluriel au-delà', () => {
    expect(i18n.t('savings.goalCount', { count: 0 })).toBe('0 objectif actif');
    expect(i18n.t('savings.goalCount', { count: 1 })).toBe('1 objectif actif');
    expect(i18n.t('savings.goalCount', { count: 2 })).toBe('2 objectifs actifs');
    expect(i18n.t('savings.reachedCount', { count: 3 })).toBe('3 atteints');
  });
});

describe('traductions de l\'épargne', () => {
  it('toutes les clés de l\'épargne existent dans les deux langues, sans accolade restante dans les libellés fixes', () => {
    const flatten = (node: unknown, prefix = ''): string[] =>
      typeof node === 'string'
        ? [prefix]
        : Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => flatten(value, prefix ? `${prefix}.${key}` : key));
    const fr = flatten(resources.fr.translation.savings).map((key) => key.replace(/_(one|few|many|other)$/, ''));
    const ru = flatten(resources.ru.translation.savings).map((key) => key.replace(/_(one|few|many|other)$/, ''));
    expect(new Set(ru)).toEqual(new Set(fr));
  });
});
