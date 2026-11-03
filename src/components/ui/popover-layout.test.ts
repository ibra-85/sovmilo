import {
  MENU_MAX_HEIGHT_RATIO,
  MENU_METRICS,
  computePopoverPlacement,
  estimateMenuHeight,
  estimateMenuWidth,
  fallbackAnchor,
  isUsableRect,
  menuMaxHeight,
  pointInRect,
  resolveAnchor,
  sameRect,
  scrollOffsetToReveal,
  type MenuWidthInput,
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

describe('hauteur maximale et défilement interne (liste de mois)', () => {
  const cover: PopoverPlacementInput = { ...base, mode: 'cover', gap: 0 };
  const monthList = estimateMenuHeight(19, 50, 6); // 6 mois à venir + mois en cours + 11 précédents + marge

  it('la hauteur maximale d\'un menu est la moitié de la zone utilisable', () => {
    expect(menuMaxHeight(800, { top: 32, bottom: 24 })).toBe(372);
    expect(menuMaxHeight(0, { top: 32, bottom: 24 })).toBe(0);
    expect(MENU_MAX_HEIGHT_RATIO).toBe(0.5);
  });

  it('une longue liste est plafonnée même quand l\'écran a la place (le contenu défile dans la surface)', () => {
    const maxHeight = menuMaxHeight(800, base.insets);
    const free = computePopoverPlacement({ ...cover, contentHeight: monthList });
    const capped = computePopoverPlacement({ ...cover, contentHeight: monthList, maxHeight });
    expect(capped.height).toBe(maxHeight);
    expect(capped.height).toBeLessThan(free.height);
    expect(capped.height).toBeLessThan(monthList);
  });

  it('un menu court n\'est pas touché par le plafond', () => {
    const actions = estimateMenuHeight(3, 50, 6);
    const maxHeight = menuMaxHeight(800, base.insets);
    expect(computePopoverPlacement({ ...cover, contentHeight: actions, maxHeight })).toEqual(
      computePopoverPlacement({ ...cover, contentHeight: actions }),
    );
  });

  it('le plafond s\'applique avant le choix du côté : une liste plafonnée peut tenir là où la liste entière non', () => {
    const maxHeight = menuMaxHeight(800, base.insets);
    const trigger = { x: 300, y: 380, width: 44, height: 44 }; // ~ 370 dp dessous : la liste entière (~1000) ne tient pas, le plafond (372) si
    const placement = computePopoverPlacement({ ...cover, trigger, contentHeight: monthList, maxHeight });
    expect(placement.side).toBe('below');
    expect(placement.top).toBe(trigger.y);
    expect(placement.height).toBeLessThanOrEqual(maxHeight);
  });

  it('près du bas de l\'écran : s\'ouvre vers le haut et reste dans la zone utilisable', () => {
    const maxHeight = menuMaxHeight(800, base.insets);
    const trigger = { x: 300, y: 700, width: 44, height: 44 };
    const placement = computePopoverPlacement({ ...cover, trigger, contentHeight: monthList, maxHeight });
    expect(placement.side).toBe('above');
    expect(placement.top).toBeGreaterThanOrEqual(base.insets.top);
    expect(placement.top + placement.height).toBe(trigger.y + trigger.height);
  });

  it('géométrie cohérente : toujours dans l\'écran, à toutes les positions et pour toutes les hauteurs', () => {
    const maxHeight = menuMaxHeight(800, base.insets);
    for (const contentHeight of [60, 160, 372, 600, 1000, 3000]) {
      for (let y = -40; y <= 840; y += 40) {
        for (const x of [0, 8, 150, 300, 356]) {
          for (const mode of ['cover', 'beside'] as const) {
            const placement = computePopoverPlacement({ ...base, mode, trigger: { x, y, width: 44, height: 44 }, contentHeight, maxHeight });
            expect(placement.height).toBeLessThanOrEqual(maxHeight);
            expect(placement.height).toBeLessThanOrEqual(contentHeight);
            expect(placement.left).toBeGreaterThanOrEqual(base.margin);
            expect(placement.left + placement.width).toBeLessThanOrEqual(base.window.width - base.margin);
            expect(placement.top).toBeGreaterThanOrEqual(base.insets.top);
            expect(placement.top + placement.height).toBeLessThanOrEqual(base.window.height - base.insets.bottom - base.margin + 0.001);
          }
        }
      }
    }
  });

  it('le clavier ouvert réduit encore la zone : la liste plafonnée ne passe pas derrière', () => {
    const placement = computePopoverPlacement({
      ...cover,
      contentHeight: monthList,
      maxHeight: menuMaxHeight(800, base.insets),
      keyboardHeight: 420,
      trigger: { x: 300, y: 200, width: 44, height: 44 },
    });
    expect(placement.top + placement.height).toBeLessThanOrEqual(800 - 420 - base.margin);
  });
});

describe('scrollOffsetToReveal : ouvrir la liste sur le choix actuel', () => {
  const row = (index: number) => ({ y: index * 51, height: 50 });

  it('ne défile pas quand tout tient', () => {
    expect(scrollOffsetToReveal(row(2), 400, 300)).toBe(0);
    expect(scrollOffsetToReveal(row(2), 0, 900)).toBe(0);
  });

  it('place le choix au milieu de la zone visible', () => {
    const offset = scrollOffsetToReveal(row(8), 372, 969);
    expect(offset).toBe(Math.round(8 * 51 - (372 - 50) / 2));
    expect(row(8).y - offset).toBeGreaterThan(0);
    expect(row(8).y + 50 - offset).toBeLessThanOrEqual(372);
  });

  it('ne dépasse jamais les extrémités du contenu', () => {
    expect(scrollOffsetToReveal(row(0), 372, 969)).toBe(0);
    expect(scrollOffsetToReveal(row(18), 372, 969)).toBe(969 - 372);
  });
});

describe('estimateMenuWidth : libellés longs', () => {
  const common = { minWidth: 232, maxWidth: 340, fontSize: 16, fontScale: 1 } as const;
  const actions = (labels: string[], extra: Partial<MenuWidthInput> = {}) =>
    estimateMenuWidth({ ...common, labels, hasIcon: true, hasCheck: false, ...extra });
  /** Largeur utile du libellé, une fois retirés les marges, l'icône et les espaces. */
  const textRoom = (width: number, hasIcon = true, hasCheck = false) =>
    width - 2 * (MENU_METRICS.padding + MENU_METRICS.border + MENU_METRICS.rowPadding) - (hasIcon ? MENU_METRICS.icon + MENU_METRICS.gap : 0) - (hasCheck ? MENU_METRICS.check + MENU_METRICS.gap : 0);

  it('des libellés courts gardent la largeur de base', () => {
    expect(actions(['Modifier', 'Supprimer'])).toBe(232);
    expect(actions([])).toBe(232);
  });

  it('« Arrêter la récurrence » ne tenait pas dans 232 dp : le menu s\'élargit pour le garder sur une ligne', () => {
    const label = 'Arrêter la récurrence';
    const needed = label.length * 16 * 0.58;
    expect(textRoom(232)).toBeLessThan(needed); // la cause de l'alerte : 160 dp utiles pour ~195 dp de texte
    const width = actions(['Modifier', label, 'Supprimer']);
    expect(width).toBeGreaterThan(232);
    expect(width).toBeLessThanOrEqual(340);
    expect(textRoom(width)).toBeGreaterThanOrEqual(needed);
  });

  it('la même chose en russe, où les mots sont plus longs', () => {
    const labels = ['Изменить', 'Остановить повтор', 'Удалить'];
    const width = actions(labels);
    expect(textRoom(width)).toBeGreaterThanOrEqual(17 * 16 * 0.58);
  });

  it('le texte agrandi élargit le menu, dans la limite de l\'écran', () => {
    const labels = ['Arrêter la récurrence'];
    const normal = actions(labels);
    const large = actions(labels, { fontScale: 1.3 });
    expect(large).toBeGreaterThan(normal);
    expect(actions(labels, { fontScale: 2 })).toBe(340); // plafonné : le libellé passera sur deux lignes, la hauteur mesurée s'adapte
  });

  it('la coche du choix actuel est comptée (liste de mois)', () => {
    const labels = ['Novembre 2026', 'Septembre 2026'];
    const withCheck = actions(labels, { hasIcon: false, hasCheck: true, fontScale: 1.8 });
    const without = actions(labels, { hasIcon: false, hasCheck: false, fontScale: 1.8 });
    expect(withCheck).toBeGreaterThanOrEqual(without);
  });

  it('un écran étroit borne la largeur, jamais sous la base', () => {
    expect(actions(['Arrêter la récurrence'], { maxWidth: 300 })).toBeLessThanOrEqual(300);
    expect(actions(['Arrêter la récurrence'], { maxWidth: 200 })).toBe(232);
  });

  it('proche d\'un bord d\'écran : le menu large reste entièrement visible', () => {
    const width = actions(['Arrêter la récurrence']);
    for (const x of [0, 4, 316, 336]) {
      const placement = computePopoverPlacement({
        ...base,
        mode: 'cover',
        gap: 0,
        width,
        trigger: { x, y: 44, width: 40, height: 40 },
      });
      expect(placement.left).toBeGreaterThanOrEqual(base.margin);
      expect(placement.left + placement.width).toBeLessThanOrEqual(base.window.width - base.margin);
    }
  });

  it('un libellé sur deux lignes : la hauteur mesurée agrandit le menu sans le sortir de l\'écran', () => {
    const twoLines = estimateMenuHeight(3, 72, 6);
    const placement = computePopoverPlacement({
      ...base,
      mode: 'cover',
      gap: 0,
      contentHeight: twoLines,
      maxHeight: menuMaxHeight(800, base.insets),
      trigger: { x: 306, y: 44, width: 40, height: 40 },
    });
    expect(placement.height).toBe(twoLines);
    expect(placement.top + placement.height).toBeLessThanOrEqual(800 - 24 - 10);
  });
});

describe('MENU_METRICS : une seule source pour le dessin et pour la largeur', () => {
  it('les valeurs du design', () => {
    expect(MENU_METRICS).toEqual({ padding: 6, border: 1, rowPadding: 14, gap: 12, icon: 20, check: 18 });
  });
});
