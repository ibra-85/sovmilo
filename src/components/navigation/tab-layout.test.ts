import {
  TAB_ICON_SIZE,
  TAB_LABEL_GAP,
  TAB_MIN_INACTIVE,
  activeTabWidth,
  computeTabLayout,
  shouldUseIconsOnly,
  tabIconLeft,
  tabLabelOpacity,
} from './tab-layout';

const INNER = 267;
const ACTIVE = [activeTabWidth(60), activeTabWidth(75), activeTabWidth(62), activeTabWidth(66)];

describe('computeTabLayout', () => {
  it('remplit exactement la barre, à toute position', () => {
    for (const position of [0, 0.25, 0.5, 1, 1.5, 2.9, 3]) {
      const { widths } = computeTabLayout(position, INNER, ACTIVE, false);
      expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(INNER, 6);
    }
  });

  it("donne à l'onglet actif sa largeur « icône + libellé » et aux autres une part égale", () => {
    const { widths, pillWidth, pillLeft, lefts } = computeTabLayout(1, INNER, ACTIVE, false);
    expect(widths[1]).toBeCloseTo(ACTIVE[1], 6);
    expect(widths[0]).toBeCloseTo(widths[2], 6);
    expect(widths[2]).toBeCloseTo(widths[3], 6);
    expect(pillWidth).toBeCloseTo(ACTIVE[1], 6);
    expect(pillLeft).toBeCloseTo(lefts[1], 6);
  });

  it('ne comprime jamais un onglet inactif sous 44 dp quand les libellés tiennent', () => {
    for (const position of [0, 0.5, 1, 2, 3]) {
      const { widths, weights } = computeTabLayout(position, INNER, ACTIVE, false);
      widths.forEach((width, k) => {
        if (weights[k] === 0) expect(width).toBeGreaterThanOrEqual(TAB_MIN_INACTIVE);
      });
    }
  });

  it('fait glisser la pastille de façon continue et monotone', () => {
    let previous = -1;
    for (let p = 0; p <= 3; p += 0.1) {
      const { pillLeft } = computeTabLayout(p, INNER, ACTIVE, false);
      expect(pillLeft).toBeGreaterThanOrEqual(previous);
      previous = pillLeft;
    }
  });

  it('borne la position hors limites', () => {
    expect(computeTabLayout(-2, INNER, ACTIVE, false).pillLeft).toBe(0);
    const last = computeTabLayout(3, INNER, ACTIVE, false);
    expect(computeTabLayout(9, INNER, ACTIVE, false).pillLeft).toBeCloseTo(last.pillLeft, 6);
  });

  it('en icônes seules, partage la largeur à parts égales', () => {
    const { widths, pillWidth } = computeTabLayout(2, INNER, ACTIVE, true);
    widths.forEach((width) => expect(width).toBeCloseTo(INNER / 4, 6));
    expect(pillWidth).toBeCloseTo(INNER / 4, 6);
  });
});

describe('shouldUseIconsOnly', () => {
  it('garde les libellés quand tout tient', () => {
    expect(shouldUseIconsOnly(INNER, ACTIVE, 1)).toBe(false);
  });

  it('passe en icônes seules à 130 % de texte', () => {
    expect(shouldUseIconsOnly(INNER, ACTIVE, 1.3)).toBe(true);
    expect(shouldUseIconsOnly(INNER, ACTIVE, 1.29)).toBe(false);
  });

  it('passe en icônes seules quand un libellé est trop long pour laisser 44 dp aux autres', () => {
    expect(shouldUseIconsOnly(INNER, [activeTabWidth(60), activeTabWidth(120), activeTabWidth(60), activeTabWidth(60)], 1)).toBe(true);
  });
});

describe('tabIconLeft', () => {
  it("centre l'icône d'un onglet inactif", () => {
    expect(tabIconLeft(44, 0, 70, false)).toBe(10);
  });

  it("centre l'ensemble « icône + libellé » d'un onglet actif", () => {
    const label = 70;
    const width = activeTabWidth(label);
    const group = TAB_ICON_SIZE + TAB_LABEL_GAP + label;
    expect(tabIconLeft(width, 1, label, false)).toBeCloseTo((width - group) / 2, 6);
  });

  it('garde l’icône centrée en mode icônes seules', () => {
    expect(tabIconLeft(66, 1, 70, true)).toBe(21);
  });
});

describe('tabLabelOpacity', () => {
  it('est invisible tant que la pastille est loin, opaque à l’arrivée', () => {
    expect(tabLabelOpacity(0)).toBe(0);
    expect(tabLabelOpacity(0.4)).toBe(0);
    expect(tabLabelOpacity(0.7)).toBeCloseTo(0.5, 6);
    expect(tabLabelOpacity(1)).toBe(1);
  });
});
