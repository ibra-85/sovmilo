import { contrastRatio } from '@/theme/contrast';
import { getTheme } from '@/theme/use-theme';

import { buttonLook, type ButtonVariant } from './button-look';

const REST = { pressed: false, disabled: false, focused: false };
const variants: ButtonVariant[] = ['primary', 'secondary', 'destructive'];
const themes = [getTheme('light'), getTheme('dark')];

describe('buttonLook', () => {
  it('le bouton principal est graphite en clair et citron en sombre', () => {
    expect(buttonLook(getTheme('light'), 'primary', REST).backgroundColor).toBe('#202227');
    expect(buttonLook(getTheme('dark'), 'primary', REST).backgroundColor).toBe('#E8FF70');
  });

  it('le bouton destructif n\'est jamais un aplat d\'alerte (décision validée : pas de grand bouton rouge plein)', () => {
    for (const theme of themes) {
      const look = buttonLook(theme, 'destructive', REST);
      expect(look.backgroundColor).not.toBe(theme.colors.danger);
      expect(look.backgroundColor).toBe(theme.colors.dangerSoft);
      expect(look.textColor).toBe(theme.colors.danger);
    }
  });

  it('pressé : teinte plus sombre et ombre portée réduite (bouton principal)', () => {
    for (const theme of themes) {
      const rest = buttonLook(theme, 'primary', REST);
      const pressed = buttonLook(theme, 'primary', { ...REST, pressed: true });
      expect(pressed.backgroundColor).not.toBe(rest.backgroundColor);
      const drop = (layers: typeof rest.boxShadow) =>
        Math.max(...layers.filter((layer) => !layer.inset).map((layer) => Number(layer.offsetY)));
      expect(drop(pressed.boxShadow)).toBeLessThan(drop(rest.boxShadow));
    }
  });

  it('désactivé : aucune ombre, couleurs dédiées, libellé encore lisible (contraste ≥ 3:1)', () => {
    for (const theme of themes) {
      for (const variant of variants) {
        const look = buttonLook(theme, variant, { ...REST, disabled: true });
        expect(look.boxShadow).toEqual([]);
        expect(look.backgroundColor).toBe(theme.colors.disabled);
        expect(contrastRatio(look.textColor, look.backgroundColor)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('un bouton désactivé ignore l\'état pressé', () => {
    const look = buttonLook(getTheme('light'), 'primary', { pressed: true, disabled: true, focused: false });
    expect(look.backgroundColor).toBe(getTheme('light').colors.disabled);
  });

  it('focus : ajoute un anneau de 3 dp, absent au repos', () => {
    for (const theme of themes) {
      for (const variant of variants) {
        const rest = buttonLook(theme, variant, REST);
        const focused = buttonLook(theme, variant, { ...REST, focused: true });
        expect(focused.boxShadow.length).toBe(rest.boxShadow.length + 1);
        const ring = focused.boxShadow[focused.boxShadow.length - 1];
        expect(ring.spreadDistance).toBe(3);
        expect(ring.inset).toBeUndefined();
      }
    }
  });

  it('le libellé de chaque variante au repos est lisible (contraste ≥ 4,5:1)', () => {
    for (const theme of themes) {
      expect(contrastRatio(buttonLook(theme, 'primary', REST).textColor, buttonLook(theme, 'primary', REST).backgroundColor)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(buttonLook(theme, 'secondary', REST).textColor, theme.colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.colors.danger, theme.colors.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
