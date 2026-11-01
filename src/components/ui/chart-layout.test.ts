import { barValuesFit, indicatorBox, labelWidth } from './chart-layout';

describe('barValuesFit', () => {
  const columnWidth = 60; // quatre colonnes d’une carte étroite

  it('affiche les valeurs sous les barres quand elles tiennent', () => {
    expect(barValuesFit(['285 €', '1 248 €', '0 €', '90 €'], columnWidth, 13)).toBe(true);
  });

  it('les retire (sauf la barre choisie) quand un gros montant ne tient plus dans sa colonne', () => {
    expect(barValuesFit(['285 €', '2 010 200 €', '0 €', '90 €'], columnWidth, 13)).toBe(false);
  });

  it('tient compte du texte agrandi', () => {
    const texts = ['1 248 €'];
    expect(barValuesFit(texts, columnWidth, 13, 1)).toBe(true);
    expect(barValuesFit(texts, columnWidth, 13, 1.8)).toBe(false);
  });
});

describe('indicatorBox', () => {
  const base = { count: 4, chartWidth: 320, overflow: 20, padding: 8 };
  const text = labelWidth('2 010 200,00 €', 13);

  it('reste centré sur sa barre quand la place le permet', () => {
    const box = indicatorBox({ ...base, index: 1, textWidth: 40 });
    expect(box.width).toBe(56);
    // colonne de 80 dp (320 / 4) : left = (80 − 56) / 2
    expect(box.left).toBeCloseTo(12);
  });

  it('ne dépasse jamais de la carte à gauche (première barre)', () => {
    const box = indicatorBox({ ...base, index: 0, textWidth: text });
    expect(box.left).toBeGreaterThanOrEqual(-20);
  });

  it('ne dépasse jamais de la carte à droite (dernière barre)', () => {
    const column = 320 / 4;
    const box = indicatorBox({ ...base, index: 3, textWidth: text });
    expect(column * 3 + box.left + box.width).toBeLessThanOrEqual(320 + 20 + 0.001);
  });

  it('est aussi large que son texte, plus la marge intérieure', () => {
    const box = indicatorBox({ ...base, index: 2, textWidth: text });
    expect(box.width).toBeCloseTo(text + 16);
  });

  it('se limite à la largeur de la carte pour un texte démesuré', () => {
    const box = indicatorBox({ ...base, index: 1, textWidth: 5000 });
    expect(box.width).toBe(360);
  });
});
