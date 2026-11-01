import { bottomReserve, navigationBottom, sizes, toastBottom } from './layout';

describe('placement des notifications', () => {
  it('se pose au-dessus de la navigation flottante', () => {
    const nav = navigationBottom(0);
    expect(toastBottom(0, 0)).toBe(nav + sizes.navHeight + sizes.toastGap);
    expect(toastBottom(0, 0)).toBeGreaterThan(nav + sizes.navHeight);
  });

  it('suit la zone système en bas (geste Android à 3 boutons ou à gestes)', () => {
    expect(toastBottom(48, 0)).toBeGreaterThan(toastBottom(0, 0));
    expect(navigationBottom(48)).toBe(60);
  });

  it('passe au-dessus du clavier quand il est ouvert', () => {
    expect(toastBottom(24, 300)).toBe(300 + sizes.toastGap);
  });
});

describe('marge basse des écrans d’onglets', () => {
  it('ne descend jamais sous la réserve de base', () => {
    expect(bottomReserve(0)).toBeGreaterThanOrEqual(sizes.bottomReserve);
  });

  it('laisse toujours le dernier élément passer au-dessus de la navigation', () => {
    for (const inset of [0, 24, 48, 80]) {
      expect(bottomReserve(inset)).toBeGreaterThan(navigationBottom(inset) + sizes.navHeight);
    }
  });
});
