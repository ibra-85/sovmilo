import { computePopoverPlacement, estimateMenuHeight, type PopoverPlacementInput } from './popover-layout';

const base: PopoverPlacementInput = {
  trigger: { x: 300, y: 40, width: 44, height: 44 },
  contentHeight: 112,
  width: 232,
  window: { width: 360, height: 800 },
  insets: { top: 32, bottom: 24, left: 0, right: 0 },
  margin: 10,
  gap: 6,
};

describe('estimateMenuHeight', () => {
  it('additionne lignes, filets et marges intérieures', () => {
    expect(estimateMenuHeight(2, 50, 6)).toBe(2 * 50 + 1 + 12);
    expect(estimateMenuHeight(1, 50, 6)).toBe(62);
    expect(estimateMenuHeight(0, 50, 6)).toBe(12);
  });
});

describe('computePopoverPlacement', () => {
  it('place le menu sous le déclencheur, aligné sur son bord droit', () => {
    const placement = computePopoverPlacement(base);
    expect(placement.side).toBe('below');
    expect(placement.top).toBe(40 + 44 + 6);
    expect(placement.left + placement.width).toBe(344);
    expect(placement.height).toBe(112);
  });

  it('ne recouvre jamais le déclencheur ni l’en-tête', () => {
    const placement = computePopoverPlacement(base);
    expect(placement.top).toBeGreaterThanOrEqual(base.trigger.y + base.trigger.height);
  });

  it('reste dans l’écran quand le déclencheur est collé au bord droit', () => {
    const placement = computePopoverPlacement({ ...base, trigger: { x: 340, y: 40, width: 44, height: 44 } });
    expect(placement.left + placement.width).toBeLessThanOrEqual(360 - 10);
  });

  it('reste dans l’écran quand le déclencheur est près du bord gauche', () => {
    const placement = computePopoverPlacement({ ...base, trigger: { x: 8, y: 40, width: 44, height: 44 } });
    expect(placement.left).toBeGreaterThanOrEqual(10);
  });

  it('se réduit sur un écran étroit', () => {
    const placement = computePopoverPlacement({ ...base, window: { width: 200, height: 800 } });
    expect(placement.width).toBe(180);
    expect(placement.left).toBe(10);
  });

  it('passe au-dessus du déclencheur s’il n’y a pas assez de place dessous', () => {
    const placement = computePopoverPlacement({ ...base, trigger: { x: 300, y: 700, width: 44, height: 44 } });
    expect(placement.side).toBe('above');
    expect(placement.top + placement.height).toBe(700 - 6);
  });

  it('respecte les zones système en bas et en haut', () => {
    const below = computePopoverPlacement({ ...base, trigger: { x: 300, y: 600, width: 44, height: 44 } });
    expect(below.top + below.height).toBeLessThanOrEqual(800 - 24 - 10);
    const above = computePopoverPlacement({ ...base, trigger: { x: 300, y: 700, width: 44, height: 44 }, contentHeight: 300 });
    expect(above.top).toBeGreaterThanOrEqual(32 + 10);
  });

  it('réduit la hauteur (le contenu défile) quand aucun côté ne suffit', () => {
    const placement = computePopoverPlacement({
      ...base,
      contentHeight: 900,
      trigger: { x: 300, y: 300, width: 44, height: 44 },
    });
    expect(placement.height).toBeLessThan(900);
    expect(placement.top).toBeGreaterThanOrEqual(32 + 10);
    expect(placement.top + placement.height).toBeLessThanOrEqual(800 - 24 - 10);
  });

  it('tient compte des encoches latérales', () => {
    const placement = computePopoverPlacement({ ...base, insets: { top: 32, bottom: 24, left: 40, right: 40 } });
    expect(placement.left).toBeGreaterThanOrEqual(50);
    expect(placement.left + placement.width).toBeLessThanOrEqual(360 - 50);
  });
});
