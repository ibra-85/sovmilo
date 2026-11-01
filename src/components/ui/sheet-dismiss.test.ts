import { motionDistances } from '@/theme/motion';

import { DISMISS_VELOCITY, UPWARD_RESISTANCE, sheetDragOffset, sheetShouldDismiss } from './sheet-dismiss';

const HEIGHT = 400;
const RATIO = motionDistances.sheetDismissRatio;

describe('glissement d\'un panneau', () => {
  it('suit le doigt vers le bas et se freine vers le haut', () => {
    expect(sheetDragOffset(120)).toBe(120);
    expect(sheetDragOffset(0)).toBe(0);
    expect(sheetDragOffset(-100)).toBeCloseTo(-100 * UPWARD_RESISTANCE);
  });
});

describe('fermeture au relâchement', () => {
  it('se ferme au-delà de 30 % de la hauteur, même doucement', () => {
    expect(sheetShouldDismiss(HEIGHT * RATIO + 1, 0, HEIGHT, RATIO)).toBe(true);
  });

  it('reste ouvert en dessous de 30 % quand le geste est lent', () => {
    expect(sheetShouldDismiss(HEIGHT * RATIO - 1, 200, HEIGHT, RATIO)).toBe(false);
    expect(sheetShouldDismiss(HEIGHT * RATIO, 0, HEIGHT, RATIO)).toBe(false); // pile à la limite : revient
  });

  it('se ferme sur un geste rapide vers le bas même après un petit parcours', () => {
    expect(sheetShouldDismiss(20, DISMISS_VELOCITY + 1, HEIGHT, RATIO)).toBe(true);
    expect(sheetShouldDismiss(20, DISMISS_VELOCITY, HEIGHT, RATIO)).toBe(false);
  });

  it('un geste rapide vers le haut ne ferme jamais', () => {
    expect(sheetShouldDismiss(-30 * UPWARD_RESISTANCE, -2000, HEIGHT, RATIO)).toBe(false);
  });

  it('gesture annulée ou revenue au départ : aucun parcours, aucune vitesse → le panneau reste', () => {
    expect(sheetShouldDismiss(0, 0, HEIGHT, RATIO)).toBe(false);
  });

  it('suit la hauteur réelle du panneau (un petit panneau demande un petit parcours)', () => {
    expect(sheetShouldDismiss(70, 0, 200, RATIO)).toBe(true);
    expect(sheetShouldDismiss(70, 0, 600, RATIO)).toBe(false);
  });
});
