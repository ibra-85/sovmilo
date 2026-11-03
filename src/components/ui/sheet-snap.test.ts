import { motionDistances } from '@/theme/motion';

import {
  COMPACT_RATIO,
  EXPAND_EPSILON,
  MIN_BODY_HEIGHT,
  MIN_DISMISS_OFFSET,
  SHEET_FLOATING_MARGIN,
  SHEET_HANDLE_ZONE,
  SHEET_TOP_GAP,
  SNAP_VELOCITY,
  computeSheetHeights,
  resolveSheetDrag,
  resolveSheetRelease,
  restingHeight,
  type SheetMetricsInput,
} from './sheet-snap';

const RATIO = motionDistances.sheetDismissRatio;

/** Appareils simulés : hauteur de fenêtre, marge haute, remplissage bas (barre de navigation comprise). */
const SMALL = { windowHeight: 640, insetTop: 24, bottomPadding: 20 };
const MEDIUM = { windowHeight: 800, insetTop: 32, bottomPadding: 24 };
const LARGE = { windowHeight: 1000, insetTop: 40, bottomPadding: 34 };

const base = (device: Pick<SheetMetricsInput, 'windowHeight' | 'insetTop' | 'bottomPadding'>, overrides: Partial<SheetMetricsInput> = {}): SheetMetricsInput => ({
  ...device,
  keyboardHeight: 0,
  contentHeight: 620, // formulaire long (Nouvel objectif)
  footerHeight: 66,
  ...overrides,
});

describe('hauteurs du panneau', () => {
  it.each([
    ['petit écran', SMALL],
    ['écran moyen', MEDIUM],
    ['grand écran', LARGE],
  ])('%s : le compact est une part de la fenêtre, le déployé reste dans la zone sûre', (_name, device) => {
    const heights = computeSheetHeights(base(device));
    const usable = device.windowHeight - device.insetTop - SHEET_TOP_GAP;
    expect(heights.compact).toBe(Math.round(usable * COMPACT_RATIO));
    expect(heights.expanded).toBeLessThanOrEqual(usable);
    expect(heights.expanded).toBeGreaterThan(heights.compact);
    expect(heights.expandable).toBe(true);
  });

  it('ne dépend pas d\'une hauteur en pixels : doubler la fenêtre double à peu près le compact', () => {
    const small = computeSheetHeights(base({ windowHeight: 600, insetTop: 0, bottomPadding: 20 }, { contentHeight: 2000 }));
    const large = computeSheetHeights(base({ windowHeight: 1200, insetTop: 0, bottomPadding: 20 }, { contentHeight: 2000 }));
    expect(large.compact / small.compact).toBeGreaterThan(1.8);
    expect(large.compact / small.compact).toBeLessThan(2.2);
  });

  it('contenu court : un seul état, à la hauteur naturelle, sans poignée extensible', () => {
    const heights = computeSheetHeights(base(MEDIUM, { contentHeight: 150 }));
    expect(heights.natural).toBe(SHEET_HANDLE_ZONE + 150 + 66 + MEDIUM.bottomPadding);
    expect(heights.expanded).toBe(heights.natural);
    expect(heights.compact).toBe(heights.natural);
    expect(heights.expandable).toBe(false);
  });

  it('contenu un peu plus haut que le compact : extensible seulement si l\'écart est visible', () => {
    const wanted = Math.round((MEDIUM.windowHeight - MEDIUM.insetTop - SHEET_TOP_GAP) * COMPACT_RATIO);
    const chrome = SHEET_HANDLE_ZONE + 66 + MEDIUM.bottomPadding;
    const contentFor = (extra: number) => wanted - chrome + extra;
    expect(computeSheetHeights(base(MEDIUM, { contentHeight: contentFor(EXPAND_EPSILON - 2) })).expandable).toBe(false);
    expect(computeSheetHeights(base(MEDIUM, { contentHeight: contentFor(EXPAND_EPSILON + 40) })).expandable).toBe(true);
  });

  it('contenu plus grand que l\'écran : le déployé s\'arrête à la zone sûre (le contenu défile)', () => {
    const heights = computeSheetHeights(base(SMALL, { contentHeight: 5000 }));
    expect(heights.natural).toBeGreaterThan(heights.available);
    expect(heights.expanded).toBe(heights.available);
    expect(heights.expanded).toBe(SMALL.windowHeight - SMALL.insetTop - SHEET_TOP_GAP);
  });

  it('texte agrandi : un contenu plus haut augmente la hauteur naturelle sans jamais dépasser l\'écran', () => {
    const normal = computeSheetHeights(base(SMALL, { contentHeight: 500 }));
    const large = computeSheetHeights(base(SMALL, { contentHeight: 500 * 1.8, footerHeight: 66 * 1.5 }));
    expect(large.natural).toBeGreaterThan(normal.natural);
    expect(large.expanded).toBeLessThanOrEqual(SMALL.windowHeight - SMALL.insetTop - SHEET_TOP_GAP);
    expect(large.compact).toBeGreaterThanOrEqual(SHEET_HANDLE_ZONE + 66 * 1.5 + SMALL.bottomPadding + MIN_BODY_HEIGHT - 1);
  });

  it('clavier ouvert : le déployé tient au-dessus du clavier, l\'état compact ne change pas', () => {
    const closed = computeSheetHeights(base(MEDIUM));
    const open = computeSheetHeights(base(MEDIUM, { keyboardHeight: 320 }));
    expect(open.available).toBe(closed.available - 320 - SHEET_FLOATING_MARGIN);
    expect(open.expanded).toBe(open.available);
    expect(open.compact).toBeLessThanOrEqual(open.expanded);
    expect(SHEET_TOP_GAP + MEDIUM.insetTop + open.expanded + SHEET_FLOATING_MARGIN + 320).toBeLessThanOrEqual(MEDIUM.windowHeight);
  });

  it('clavier fermé : retour exact aux hauteurs précédentes (aucun saut résiduel)', () => {
    const before = computeSheetHeights(base(MEDIUM));
    computeSheetHeights(base(MEDIUM, { keyboardHeight: 300 }));
    expect(computeSheetHeights(base(MEDIUM))).toEqual(before);
  });

  it('petit écran avec clavier : la place disponible peut devenir très faible sans valeur négative ni NaN', () => {
    const heights = computeSheetHeights(base({ windowHeight: 480, insetTop: 24, bottomPadding: 20 }, { keyboardHeight: 400 }));
    for (const value of [heights.compact, heights.expanded, heights.available, heights.natural]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(heights.compact).toBeLessThanOrEqual(heights.expanded);
  });

  it('mesures absentes ou invalides : jamais de NaN, compact ≤ déployé', () => {
    const heights = computeSheetHeights({ windowHeight: Number.NaN, insetTop: -5, bottomPadding: Number.POSITIVE_INFINITY, keyboardHeight: Number.NaN, contentHeight: Number.NaN, footerHeight: -1 });
    for (const value of Object.values(heights)) {
      if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
    }
    expect(heights.compact).toBeLessThanOrEqual(heights.expanded);
    expect(heights.expandable).toBe(false);
  });

  it('changement dynamique de hauteur : un contenu qui grandit puis rétrécit repasse par les mêmes valeurs', () => {
    const short = computeSheetHeights(base(MEDIUM, { contentHeight: 200 }));
    const long = computeSheetHeights(base(MEDIUM, { contentHeight: 900 }));
    const shortAgain = computeSheetHeights(base(MEDIUM, { contentHeight: 200 }));
    expect(short.expandable).toBe(false);
    expect(long.expandable).toBe(true);
    expect(shortAgain).toEqual(short);
  });

  it('hauteur au repos : le clavier ouvert ou l\'état déployé donnent la hauteur maximale, sinon le compact', () => {
    const heights = computeSheetHeights(base(MEDIUM));
    expect(restingHeight(heights, 'compact', false)).toBe(heights.compact);
    expect(restingHeight(heights, 'expanded', false)).toBe(heights.expanded);
    expect(restingHeight(heights, 'compact', true)).toBe(heights.expanded);
  });
});

describe('geste de poignée', () => {
  const compact = 400;
  const expanded = 700;

  it('compact → déployé : tirer vers le haut agrandit, borné au déployé', () => {
    expect(resolveSheetDrag(compact, -100, compact, expanded)).toEqual({ height: 500, offset: 0 });
    const beyond = resolveSheetDrag(compact, -500, compact, expanded);
    expect(beyond.height).toBe(expanded);
    expect(beyond.offset).toBeLessThan(0);
    expect(beyond.offset).toBeGreaterThan(-30);
  });

  it('déployé → compact : tirer vers le bas réduit sans descendre sous le compact', () => {
    expect(resolveSheetDrag(expanded, 150, compact, expanded)).toEqual({ height: 550, offset: 0 });
    expect(resolveSheetDrag(expanded, 300, compact, expanded)).toEqual({ height: compact, offset: 0 });
  });

  it('au-delà du compact, le panneau descend (fermeture) ; la hauteur reste au compact', () => {
    expect(resolveSheetDrag(compact, 80, compact, expanded)).toEqual({ height: compact, offset: 80 });
    expect(resolveSheetDrag(expanded, 420, compact, expanded)).toEqual({ height: compact, offset: 120 });
  });

  it('geste nul : rien ne bouge', () => {
    expect(resolveSheetDrag(compact, 0, compact, expanded)).toEqual({ height: compact, offset: 0 });
  });
});

describe('relâchement', () => {
  const compact = 400;
  const expanded = 700;
  const release = (overrides: Partial<Parameters<typeof resolveSheetRelease>[0]>) =>
    resolveSheetRelease({ startHeight: compact, height: compact, offset: 0, velocityY: 0, compact, expanded, dismissRatio: RATIO, ...overrides });

  it('fermeture volontaire : depuis le compact, tirer au-delà de 30 % de la hauteur', () => {
    expect(release({ offset: compact * RATIO + 1 })).toBe('dismiss');
  });

  it('petit geste annulé : un faible écart vers le bas revient au compact', () => {
    expect(release({ offset: 20 })).toBe('compact');
    expect(release({ offset: compact * RATIO })).toBe('compact');
  });

  it('geste rapide vers le bas depuis le compact : ferme après un vrai déplacement, pas sur un effleurement', () => {
    expect(release({ offset: MIN_DISMISS_OFFSET + 1, velocityY: 1500 })).toBe('dismiss');
    expect(release({ offset: MIN_DISMISS_OFFSET - 1, velocityY: 3000 })).toBe('compact');
    expect(release({ offset: 0, velocityY: 3000 })).toBe('compact');
  });

  it('un geste qui commence DÉPLOYÉ ne ferme jamais, même rapide et même tiré très bas : il réduit', () => {
    expect(release({ startHeight: expanded, height: compact, offset: 300, velocityY: 3000 })).toBe('compact');
    expect(release({ startHeight: expanded, height: 520, offset: 0, velocityY: 2000 })).toBe('compact');
  });

  it('compact → déployé : un geste rapide vers le haut déploie, même court', () => {
    expect(release({ height: 430, velocityY: -(SNAP_VELOCITY + 1) })).toBe('expanded');
  });

  it('sans vitesse nette, la moitié du parcours décide', () => {
    expect(release({ height: 551, velocityY: 100 })).toBe('expanded');
    expect(release({ height: 549, velocityY: 100 })).toBe('compact');
    expect(release({ startHeight: expanded, height: 560, velocityY: -100 })).toBe('expanded');
  });

  it('panneau non extensible (compact = déployé) : ne fait que fermer ou rester', () => {
    expect(resolveSheetRelease({ startHeight: 400, height: 400, offset: 0, velocityY: -2000, compact: 400, expanded: 400, dismissRatio: RATIO })).toBe('compact');
    expect(resolveSheetRelease({ startHeight: 400, height: 400, offset: 150, velocityY: 0, compact: 400, expanded: 400, dismissRatio: RATIO })).toBe('dismiss');
  });

  it('geste interrompu (vitesse et écart nuls à la fin) : retour à l\'état de départ', () => {
    expect(release({})).toBe('compact');
    expect(release({ startHeight: expanded, height: expanded })).toBe('expanded');
  });

  it('réouverture après fermeture : le panneau repart du compact', () => {
    // Le BottomSheet réinitialise son état à la fermeture ; la logique pure ne garde aucune mémoire entre deux gestes.
    const first = release({ offset: compact * RATIO + 5 });
    const second = release({});
    expect(first).toBe('dismiss');
    expect(second).toBe('compact');
  });
});
