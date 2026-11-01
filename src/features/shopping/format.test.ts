import { createI18n } from '@/i18n/config';
import { SHOPPING_UNITS } from '@/domain/shopping';

import { formatItemDetails, formatQuantity, formatUnitPrice } from './format';

const fr = createI18n('fr');
const ru = createI18n('ru');
const NBSP = ' ';

describe('formatQuantity', () => {
  it('pièces : « × 3 »', () => {
    expect(formatQuantity(3000, 'piece', 'fr', fr.t)).toBe('× 3');
    expect(formatQuantity(12_000, 'piece', 'ru', ru.t)).toBe('× 12');
  });

  it('décimales exactes, virgule dans les deux langues, unité insécable', () => {
    expect(formatQuantity(1500, 'kg', 'fr', fr.t)).toBe(`1,5${NBSP}kg`);
    expect(formatQuantity(1500, 'kg', 'ru', ru.t)).toBe(`1,5${NBSP}кг`);
    expect(formatQuantity(250, 'kg', 'fr', fr.t)).toBe(`0,25${NBSP}kg`);
    expect(formatQuantity(1, 'l', 'fr', fr.t)).toBe(`0,001${NBSP}L`);
    expect(formatQuantity(250_000, 'g', 'fr', fr.t)).toBe(`250${NBSP}g`);
    expect(formatQuantity(500_000, 'ml', 'ru', ru.t)).toBe(`500${NBSP}мл`);
  });

  it('grandes quantités lisibles', () => {
    expect(formatQuantity(9_999_999, 'kg', 'fr', fr.t)).toMatch(/^9[\s  ]999,999[\s ]kg$/);
  });
});

describe('formatUnitPrice', () => {
  it('prix au kg / au litre pour les grammes et les millilitres', () => {
    expect(formatUnitPrice(420, 'g', 'fr', fr.t)).toMatch(/^4,20[\s ]€\/kg$/);
    expect(formatUnitPrice(190, 'ml', 'ru', ru.t)).toMatch(/^1,90[\s ]€\/л$/);
    expect(formatUnitPrice(120, 'piece', 'fr', fr.t)).toMatch(/^1,20[\s ]€\/pièce$/);
  });
});

describe('formatItemDetails', () => {
  it('sans prix : seulement la quantité', () => {
    expect(formatItemDetails({ quantityMilli: 2000, unit: 'piece', unitPriceCents: null }, 'fr', fr.t)).toBe('× 2');
  });

  it('avec prix : quantité · prix unitaire', () => {
    expect(formatItemDetails({ quantityMilli: 1500, unit: 'kg', unitPriceCents: 399 }, 'fr', fr.t)).toMatch(/^1,5[\s ]kg · 3,99[\s ]€\/kg$/);
  });
});

describe('traductions des courses', () => {
  it.each(SHOPPING_UNITS)('l’unité « %s » a un nom et une abréviation en français et en russe', (unit) => {
    for (const i18n of [fr, ru]) {
      expect(i18n.t(`shopping.units.${unit}`)).not.toMatch(/^shopping\./);
      expect(i18n.t(`shopping.unitShort.${unit}`)).not.toMatch(/^shopping\./);
    }
  });

  it('pluriels français', () => {
    expect(fr.t('shopping.listRemaining', { count: 0 })).toBe('0 article à acheter');
    expect(fr.t('shopping.listRemaining', { count: 1 })).toBe('1 article à acheter');
    expect(fr.t('shopping.listRemaining', { count: 3 })).toBe('3 articles à acheter');
  });

  it.each([
    [1, '1 товар осталось купить'],
    [2, '2 товара осталось купить'],
    [5, '5 товаров осталось купить'],
    [11, '11 товаров осталось купить'],
    [21, '21 товар осталось купить'],
    [22, '22 товара осталось купить'],
  ])('pluriels russes : %i → « %s »', (count, expected) => {
    expect(ru.t('shopping.listRemaining', { count })).toBe(expected);
  });

  it('textes du total partiel et de la suppression, avec leurs pluriels', () => {
    expect(fr.t('shopping.estimatePartial', { count: 1 })).toBe('Total partiel : 1 article n’a pas de prix.');
    expect(fr.t('shopping.estimatePartial', { count: 2 })).toBe('Total partiel : 2 articles n’ont pas de prix.');
    expect(ru.t('shopping.estimatePartial', { count: 3 })).toBe('Неполная сумма: у 3 товаров нет цены.');
    expect(ru.t('shopping.deleteText', { count: 2 })).toBe('В нём 2 товара, они будут удалены вместе со списком.');
  });

  it('textes d’erreur et libellés d’accessibilité interpolés', () => {
    expect(fr.t('shopping.errors.nameTooLong', { max: 80 })).toContain('80');
    expect(fr.t('shopping.deleteA11y', { name: 'Samedi' })).toBe('Supprimer la liste Samedi');
    expect(ru.t('shopping.listA11y', { name: 'Молоко', status: 'Всё куплено' })).toBe('Молоко, Всё куплено');
  });
});
