import { darken, withAlpha } from './color-utils';

describe('darken', () => {
  it('assombrit de 6 % : le citron du bouton principal sombre', () => {
    expect(darken('#E8FF70', 0.06)).toBe('#DAF069');
  });

  it('ne change pas la couleur à 0 et donne du noir à 1', () => {
    expect(darken('#202227', 0)).toBe('#202227');
    expect(darken('#FFFFFF', 1)).toBe('#000000');
  });

  it('refuse une couleur qui n\'est pas #RRGGBB', () => {
    expect(() => darken('rgba(0,0,0,0.5)', 0.1)).toThrow();
  });
});

describe('withAlpha', () => {
  it('produit un rgba() à partir d\'un hexadécimal', () => {
    expect(withAlpha('#E8FF70', 0.1)).toBe('rgba(232,255,112,0.1)');
  });
});
