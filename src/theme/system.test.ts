import { radius, sizes, spacing } from './layout';
import { durations, curves } from './motion';
import { shadowTokens } from './shadows';
import { colorTokens } from './tokens';
import { fontFamilies, maxFontScale, typography } from './typography';

describe('échelle d\'espacement', () => {
  it('est strictement croissante et contient le repère 24 entre sections', () => {
    const values = Object.values(spacing);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
    expect(sizes.sectionGap).toBe(24);
    expect(sizes.screenMargin).toBe(20);
  });
});

describe('rayons', () => {
  it('le rayon principal des surfaces est 23 et la barre de navigation le suit', () => {
    expect(radius.surface).toBe(23);
    expect(radius.nav).toBe(23);
  });

  it('respecte « rayon intérieur ≈ rayon extérieur − marge interne » pour la barre et le menu +', () => {
    expect(radius.nav - sizes.navPadding).toBe(radius.navTab);
    expect(radius.menu - 6).toBe(radius.menuItem);
  });

  it('un rayon intérieur est toujours plus petit que son conteneur', () => {
    expect(radius.navTab).toBeLessThan(radius.nav);
    expect(radius.menuItem).toBeLessThan(radius.menu);
    expect(radius.option).toBeLessThan(radius.field);
  });
});

describe('zones tactiles et barre flottante', () => {
  it('garde la barre et le bouton + à la même hauteur et au moins 48 dp de zone tactile', () => {
    expect(sizes.navHeight).toBe(sizes.fabSize);
    expect(sizes.minTouch).toBeGreaterThanOrEqual(48);
    expect(sizes.iconButton).toBeLessThanOrEqual(sizes.minTouch);
  });

  it('réserve sous les listes au moins la barre, son décalage et le bouton', () => {
    expect(sizes.bottomReserve).toBeGreaterThanOrEqual(sizes.navHeight + sizes.navBottom);
  });
});

describe('typographie', () => {
  it('n\'utilise que les trois graisses d\'Inter prévues (pas de 700)', () => {
    const families = new Set(Object.values(typography).map((style) => style.fontFamily));
    for (const family of families) expect(Object.values(fontFamilies)).toContain(family);
  });

  it('met des chiffres tabulaires et un interligne de 1,0 sur les grands montants', () => {
    for (const name of ['amountInput', 'amountHero', 'amountDetail', 'amountHome', 'amountSummary'] as const) {
      expect(typography[name].fontVariant).toEqual(['tabular-nums']);
      expect(typography[name].lineHeight).toBe(typography[name].fontSize);
    }
  });

  it('applique l\'interlettrage en pixels (em × taille) : 60 sp à −0,045 em = −2,7', () => {
    expect(typography.amountInput.letterSpacing).toBe(-2.7);
    expect(typography.body.letterSpacing).toBeUndefined();
  });

  it('garde le corps de texte à 16 sp ou plus, et plafonne la mise à l\'échelle des grands montants', () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(16);
    expect(maxFontScale.amountInput).toBeLessThanOrEqual(1.15);
    expect(maxFontScale.body).toBeUndefined();
  });
});

describe('mouvement', () => {
  it('ferme plus vite qu\'il n\'ouvre (principe DÉCIDÉ)', () => {
    expect(durations.menuOut).toBeLessThanOrEqual(durations.menuIn);
    expect(durations.dropdownOut).toBeLessThanOrEqual(durations.dropdownIn);
    expect(durations.sheetOut).toBeLessThanOrEqual(durations.sheetIn);
    expect(durations.toastOut).toBeLessThanOrEqual(durations.toastIn);
    expect(durations.scrimOut).toBeLessThanOrEqual(durations.scrimIn);
  });

  it('garde les durées courtes (< 500 ms) hors temps d\'affichage de la notification', () => {
    for (const [name, value] of Object.entries(durations)) {
      if (name === 'toastVisible') continue;
      expect({ name, ok: value <= 500 }).toEqual({ name, ok: true });
    }
    expect(durations.toastVisible).toBe(3000);
  });

  it('le fondu conservé en animations réduites ne dépasse pas 100 ms', () => {
    expect(durations.reducedFade).toBeLessThanOrEqual(100);
  });

  it('définit des courbes cubic-bezier valides (x entre 0 et 1)', () => {
    for (const [x1, , x2] of Object.values(curves)) {
      expect(x1).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(x2).toBeGreaterThanOrEqual(0);
      expect(x2).toBeLessThanOrEqual(1);
    }
  });
});

describe('matières', () => {
  it('clair et sombre définissent les mêmes recettes d\'ombres', () => {
    expect(Object.keys(shadowTokens.dark).sort()).toEqual(Object.keys(shadowTokens.light).sort());
  });

  it('chaque recette contient au moins une couche', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const layers of Object.values(shadowTokens[theme])) expect(layers.length).toBeGreaterThan(0);
    }
  });

  it('le bouton principal sombre n\'a pas de halo citron (ombres noires uniquement, VALIDÉ)', () => {
    const drops = shadowTokens.dark.primary.filter((layer) => !layer.inset);
    for (const layer of drops) expect(String(layer.color)).toMatch(/^rgba\(0,0,0,/);
    expect(colorTokens.dark.primary).toBe('#E8FF70');
  });
});
