import { amountWidth, effectiveFontScale, fitAmountScale, textWidthEm } from './amount-fit';
import { amountSizes, layoutAmount, NO_BREAK_SPACE, type AmountSize } from './amount-layout';

/** Cas limites demandés (en centimes). */
const AMOUNTS: readonly [string, number][] = [
  ['0 €', 0],
  ['12,50 €', 1250],
  ['1 248,60 €', 124860],
  ['−10 200,00 €', -1020000],
  ['−1 000 000,00 €', -100000000],
  ['−2 010 200,00 €', -201020000],
  ['2 800,00 €', 280000],
  ['2 010 200,00 €', 201020000],
];

const SIZES = Object.keys(amountSizes) as AmountSize[];

describe('mise en forme des montants extrêmes', () => {
  describe.each(['fr', 'ru'] as const)('langue %s', (locale) => {
    it.each(AMOUNTS)('« %s » : le symbole € reste collé au nombre (aucune espace sécable)', (_label, cents) => {
      const { number, unitText } = layoutAmount({ cents, locale, size: 'row', fontScale: 1 });
      const whole = `${number}${unitText}`;
      expect(whole).not.toContain(' '); // U+0020, la seule espace où le texte peut passer à la ligne
      expect(unitText).toBe(`${NO_BREAK_SPACE}€`);
    });

    it('garde le vrai signe moins et les séparateurs de milliers insécables', () => {
      const { number } = layoutAmount({ cents: -201020000, locale, size: 'home', fontScale: 1 });
      expect(number.startsWith('−')).toBe(true);
      expect(number).toMatch(/^−2[  ]010[  ]200,00$/);
    });

    it('écrit « + » pour un revenu quand le signe est demandé', () => {
      const { number } = layoutAmount({ cents: 124860, locale, size: 'row', signed: true, fontScale: 1 });
      expect(number.startsWith('+')).toBe(true);
    });
  });
});

describe('textWidthEm', () => {
  it('compte plus large un nombre à 7 chiffres qu’un nombre à 3 chiffres', () => {
    expect(textWidthEm('2 010 200,00')).toBeGreaterThan(textWidthEm('312,00'));
  });

  it('est nulle pour un texte vide', () => {
    expect(textWidthEm('')).toBe(0);
  });
});

describe('fitAmountScale', () => {
  const run = (text: string, size = 16) => [{ text, size }];

  it('ne touche pas à un montant qui tient', () => {
    expect(fitAmountScale({ runs: run('12,50 €'), available: 200, minScale: 0.875 })).toEqual({ scale: 1, fits: true });
  });

  it('réduit un montant trop large, sans descendre sous l’échelle minimale', () => {
    const text = '−2 010 200,00 €';
    const wide = amountWidth(run(text));
    const result = fitAmountScale({ runs: run(text), available: wide * 0.9, minScale: 0.875 });
    expect(result.fits).toBe(true);
    expect(result.scale).toBeLessThan(1);
    expect(result.scale).toBeGreaterThanOrEqual(0.875);
    expect(amountWidth(run(text), result.scale)).toBeLessThanOrEqual(wide * 0.9 + 1e-9);
  });

  it('signale qu’il faut changer de structure quand même la taille minimale ne suffit pas', () => {
    const text = '−2 010 200,00 €';
    const result = fitAmountScale({ runs: run(text), available: amountWidth(run(text)) * 0.5, minScale: 0.875 });
    expect(result).toEqual({ scale: 0.875, fits: false });
  });

  it('tient compte du texte agrandi du système', () => {
    const text = '1 248,60 €';
    const available = amountWidth(run(text)) * 1.1;
    expect(fitAmountScale({ runs: run(text), available, minScale: 0.5, fontScale: 1 }).scale).toBe(1);
    expect(fitAmountScale({ runs: run(text), available, minScale: 0.5, fontScale: 1.3 }).scale).toBeLessThan(1);
  });
});

describe('effectiveFontScale', () => {
  it('plafonne l’échelle du système au maximum du style et ignore une échelle réduite', () => {
    expect(effectiveFontScale(1.5, 1.1)).toBe(1.1);
    expect(effectiveFontScale(1.5, 1.8)).toBe(1.5);
    expect(effectiveFontScale(0.85, 1.8)).toBe(1);
  });
});

describe('les montants extrêmes tiennent dans les zones de l’interface', () => {
  const zones: [string, AmountSize, number][] = [
    // largeurs utiles sur un écran de 360 dp (marges de 20 dp déduites)
    ['résultat du mois (Accueil), pleine largeur', 'home', 320],
    ['résumé Budgets, pleine largeur', 'summary', 320],
    ['détail d’un budget, pleine largeur', 'hero', 320],
    ['détail d’une opération, pleine largeur', 'detail', 320],
    ['cellule Revenus / Dépenses en pile (160 − 28)', 'row', 132],
    ['montant d’une ligne d’opération (moitié de la ligne)', 'row', 160],
  ];

  describe.each(AMOUNTS)('montant %s', (_label, cents) => {
    it.each(zones)('%s', (_zone, size, width) => {
      const { fit } = layoutAmount({ cents, locale: 'fr', size, maxWidth: width, fontScale: 1 });
      expect(fit.fits).toBe(true);
      expect(fit.scale).toBeGreaterThanOrEqual(amountSizes[size].minScale);
    });
  });

  it('une cellule Revenus / Dépenses étroite change de structure pour un montant de 7 chiffres', () => {
    // À côté de l’icône : 160 − 28 − 40 − 12 = 80 dp. 2 010 200,00 € n’y tient pas à 14 sp au moins : la cellule passe en pile.
    const beside = layoutAmount({ cents: -201020000, locale: 'fr', size: 'row', maxWidth: 80, fontScale: 1 }).fit;
    expect(beside.fits).toBe(false);
    const small = layoutAmount({ cents: 1250, locale: 'fr', size: 'row', maxWidth: 80, fontScale: 1 }).fit;
    expect(small.fits).toBe(true);
  });

  it('le texte agrandi à 130 % fait réduire davantage, jamais passer à la ligne', () => {
    const normal = layoutAmount({ cents: -201020000, locale: 'ru', size: 'home', maxWidth: 320, fontScale: 1 }).fit.scale;
    const large = layoutAmount({ cents: -201020000, locale: 'ru', size: 'home', maxWidth: 320, fontScale: 1.3 }).fit.scale;
    expect(large).toBeLessThanOrEqual(normal);
  });

  it('un montant ne descend jamais sous l’échelle minimale de sa taille', () => {
    for (const size of SIZES) {
      const { fit } = layoutAmount({ cents: -201020000, locale: 'fr', size, maxWidth: 10, fontScale: 1 });
      expect(fit.scale).toBe(amountSizes[size].minScale);
    }
  });

  it('une ligne de liste ne descend pas sous 14 sp', () => {
    expect(16 * amountSizes.row.minScale).toBeGreaterThanOrEqual(14);
  });
});
