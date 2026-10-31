import { budgetStatus } from '@/domain/budget';

import { createI18n, resources } from './config';

const PERCENTS = [0, 74, 100, 108, 200, 2040, 5100];

/** Toutes les chaînes d’une langue, à plat. */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (node && typeof node === 'object') Object.values(node).forEach((child) => strings(child, out));
  return out;
}

describe.each(['fr', 'ru'] as const)('pourcentages — %s', (locale) => {
  const i18n = createI18n(locale);

  it('aucun « % » n’est séparé de son nombre par une espace sécable', () => {
    const offenders = strings(resources[locale]).filter((text) => /(\d|\}\}) %/.test(text));
    expect(offenders).toEqual([]);
  });

  it.each(PERCENTS)('affiche %i % de budget sans casser la ligne entre le nombre et « % »', (percent) => {
    const text = i18n.t('budgetRow.over', { amount: '2 010 200,00 €', percent });
    expect(text).toContain(`${percent}`);
    expect(text).not.toMatch(/\d %/);
    expect(text).toMatch(/\d[  ]%/);
  });

  it('les libellés d’état restent renseignés pour chaque état', () => {
    expect(i18n.t('budgetRow.reached')).not.toBe('budgetRow.reached');
    expect(i18n.t('budgetRow.nearLimit', { amount: '20,00 €' })).toContain('20,00');
    expect(i18n.t('budgetRow.remaining', { amount: '88,00 €', percent: 74 })).toContain('74');
  });
});

describe('état d’un budget selon le pourcentage consommé', () => {
  const limit = 10000; // 100,00 €
  const spentFor = (percent: number) => Math.round((limit * percent) / 100);

  it.each([
    [0, 'ok'],
    [74, 'ok'],
    [100, 'reached'],
    [108, 'over'],
    [200, 'over'],
    [2040, 'over'],
    [5100, 'over'],
  ])('%i % → %s', (percent, status) => {
    expect(budgetStatus(spentFor(percent), limit)).toBe(status);
  });

  it('80 % pile reste « ok », 81 % devient « presque atteint »', () => {
    expect(budgetStatus(spentFor(80), limit)).toBe('ok');
    expect(budgetStatus(spentFor(81), limit)).toBe('warning');
  });
});
