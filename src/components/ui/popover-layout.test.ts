import {
  computePopoverPlacement,
  estimateMenuHeight,
  fallbackAnchor,
  isUsableRect,
  pointInRect,
  resolveAnchor,
  sameRect,
  type PopoverPlacementInput,
} from './popover-layout';

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

  it('se centre sous une tuile quand on le demande, puis reste dans l’écran', () => {
    const tile = { x: 150, y: 300, width: 58, height: 58 };
    const centered = computePopoverPlacement({ ...base, trigger: tile, align: 'center' });
    expect(centered.left + centered.width / 2).toBeCloseTo(179);
    const edge = computePopoverPlacement({ ...base, trigger: { ...tile, x: 300 }, align: 'center' });
    expect(edge.left + edge.width).toBeLessThanOrEqual(360 - 10);
    const near = computePopoverPlacement({ ...base, trigger: { ...tile, x: 4 }, align: 'center' });
    expect(near.left).toBeGreaterThanOrEqual(10);
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

describe('computePopoverPlacement : mode cover (le déclencheur se transforme en menu)', () => {
  const cover: PopoverPlacementInput = { ...base, mode: 'cover', gap: 0 };

  it('part de l’arête haute du déclencheur et le recouvre, bord droit aligné', () => {
    const placement = computePopoverPlacement(cover);
    expect(placement.side).toBe('below');
    expect(placement.top).toBe(base.trigger.y);
    expect(placement.left + placement.width).toBe(base.trigger.x + base.trigger.width);
    // la surface finale contient tout le rectangle du déclencheur
    expect(placement.left).toBeLessThanOrEqual(base.trigger.x);
    expect(placement.top + placement.height).toBeGreaterThanOrEqual(base.trigger.y + base.trigger.height);
  });

  it('s’ouvre vers le haut, arête basse du déclencheur conservée, quand il manque de place dessous', () => {
    const trigger = { x: 300, y: 700, width: 44, height: 44 };
    const placement = computePopoverPlacement({ ...cover, trigger });
    expect(placement.side).toBe('above');
    expect(placement.top + placement.height).toBe(trigger.y + trigger.height);
  });

  it('se centre sur une tuile proche du bord gauche sans sortir de l’écran', () => {
    const tile = { x: 4, y: 300, width: 58, height: 58 };
    const placement = computePopoverPlacement({ ...cover, trigger: tile, align: 'center' });
    expect(placement.left).toBe(10); // ramené à la marge de l'écran, pas à la position idéale (−83)
    expect(placement.left + placement.width).toBeGreaterThanOrEqual(tile.x + tile.width);
  });

  it('un bouton en haut à droite garde son bord haut et son bord droit : la surface ne fait que s’étendre', () => {
    const trigger = { x: 306, y: 44, width: 40, height: 40 };
    const placement = computePopoverPlacement({ ...cover, trigger });
    expect(placement.left + placement.width).toBe(346); // bord droit inchangé
    expect(placement.top).toBe(44); // bord haut inchangé
  });

  it('réduit la hauteur et laisse le contenu défiler quand un contenu long ne tient dans aucun sens', () => {
    const placement = computePopoverPlacement({ ...cover, contentHeight: 2000, trigger: { x: 300, y: 380, width: 44, height: 44 } });
    expect(placement.height).toBeLessThan(2000);
    expect(placement.top).toBeGreaterThanOrEqual(32);
    expect(placement.top + placement.height).toBeLessThanOrEqual(800 - 24 - 10);
  });

  it('contenu long : choisit le côté qui offre le plus de place', () => {
    const lowTrigger = { x: 300, y: 560, width: 44, height: 44 };
    const placement = computePopoverPlacement({ ...cover, trigger: lowTrigger, contentHeight: 600 });
    expect(placement.side).toBe('above');
    expect(placement.height).toBeLessThanOrEqual(600);
  });

  it('textes russes longs (menu étroit, contenu haut) : tient dans la fenêtre', () => {
    const placement = computePopoverPlacement({
      ...cover,
      width: 232,
      contentHeight: 5 * 92, // cinq lignes de libellés russes sur trois lignes
      trigger: { x: 316, y: 44, width: 40, height: 40 },
    });
    expect(placement.top + placement.height).toBeLessThanOrEqual(800 - 24 - 10);
    expect(placement.height).toBe(460);
  });
});

describe('computePopoverPlacement : clavier et déclencheur hors zone', () => {
  const cover: PopoverPlacementInput = { ...base, mode: 'cover', gap: 0 };

  it('ne passe jamais derrière le clavier : bascule vers le haut', () => {
    const trigger = { x: 300, y: 420, width: 44, height: 44 };
    const without = computePopoverPlacement({ ...cover, trigger });
    expect(without.side).toBe('below');
    const withKeyboard = computePopoverPlacement({ ...cover, trigger, keyboardHeight: 420 });
    expect(withKeyboard.side).toBe('above');
    expect(withKeyboard.top + withKeyboard.height).toBeLessThanOrEqual(trigger.y + trigger.height);
  });

  it('le clavier réduit la zone utilisable en bas même quand il est plus bas que la barre système', () => {
    const placement = computePopoverPlacement({ ...cover, trigger: { x: 300, y: 300, width: 44, height: 44 }, contentHeight: 300, keyboardHeight: 500 });
    expect(placement.top + placement.height).toBeLessThanOrEqual(800 - 500 - 10);
  });

  it('un déclencheur qui sort par le bas (défilement) donne quand même un menu visible', () => {
    const placement = computePopoverPlacement({ ...cover, trigger: { x: 300, y: 790, width: 44, height: 44 } });
    expect(placement.top).toBeGreaterThanOrEqual(32);
    expect(placement.top + placement.height).toBeLessThanOrEqual(800 - 24);
    expect(placement.height).toBeGreaterThan(0);
  });

  it('un déclencheur qui sort par le haut donne un menu sous la barre d’état', () => {
    const placement = computePopoverPlacement({ ...cover, trigger: { x: 300, y: -30, width: 44, height: 44 } });
    expect(placement.top).toBeGreaterThanOrEqual(32);
  });

  it('un clavier de hauteur négative ou absente est ignoré', () => {
    expect(computePopoverPlacement({ ...cover, keyboardHeight: -50 })).toEqual(computePopoverPlacement(cover));
  });
});

describe('mesures et repli', () => {
  it('reconnaît un rectangle utilisable', () => {
    expect(isUsableRect({ x: 1, y: 2, width: 3, height: 4 })).toBe(true);
    expect(isUsableRect({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
    expect(isUsableRect({ x: NaN, y: 0, width: 10, height: 10 })).toBe(false);
    expect(isUsableRect(null)).toBe(false);
    expect(isUsableRect(undefined)).toBe(false);
  });

  it('choisit la mesure fraîche, sinon la dernière bonne, sinon le repli', () => {
    const fresh = { x: 10, y: 10, width: 40, height: 40 };
    const last = { x: 20, y: 20, width: 40, height: 40 };
    const fallback = fallbackAnchor({ width: 360 }, { top: 32, bottom: 24, left: 0, right: 0 }, 10);
    expect(resolveAnchor(fresh, last, fallback)).toBe(fresh);
    expect(resolveAnchor({ x: 0, y: 0, width: 0, height: 0 }, last, fallback)).toBe(last);
    expect(resolveAnchor(null, null, fallback)).toBe(fallback);
  });

  it('le repli est un carré de 44 dp en haut à droite de la zone utilisable', () => {
    expect(fallbackAnchor({ width: 360 }, { top: 32, bottom: 24, left: 0, right: 8 }, 10)).toEqual({
      x: 360 - 8 - 10 - 44,
      y: 42,
      width: 44,
      height: 44,
    });
  });

  it('compare deux rectangles et teste l’appartenance avec marge', () => {
    expect(sameRect({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 })).toBe(true);
    expect(sameRect({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 5 })).toBe(false);
    expect(sameRect(null, null)).toBe(true);
    expect(sameRect(null, { x: 0, y: 0, width: 1, height: 1 })).toBe(false);
    expect(pointInRect(5, 5, { x: 10, y: 10, width: 10, height: 10 }, 6)).toBe(true);
    expect(pointInRect(2, 5, { x: 10, y: 10, width: 10, height: 10 }, 6)).toBe(false);
  });
});
