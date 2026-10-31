import { readFileSync } from 'fs';
import { join } from 'path';

import { palette } from './colors';
import { contrastRatio } from './contrast';
import { colorTokens, type ColorTokens, type ThemeName } from './tokens';

const css = readFileSync(join(__dirname, '..', 'global.css'), 'utf8');

/** Extrait les variables `--color-xxx: R G B;` d'un bloc CSS et les convertit en #RRGGBB. */
function parseVariables(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of block.matchAll(/--color-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
    const hex = [match[2], match[3], match[4]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    result[match[1]] = `#${hex}`.toUpperCase();
  }
  return result;
}

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const cssByTheme: Record<ThemeName, Record<string, string>> = {
  light: parseVariables(css.slice(0, darkStart)),
  dark: parseVariables(css.slice(darkStart)),
};

/** Ancien nom (Tailwind, global.css) → jeton du design system. */
const legacyToToken: Record<string, keyof ColorTokens> = {
  bg: 'bg',
  surface: 'surface',
  line: 'progressTrack',
  ink: 'text',
  muted: 'textMuted',
  sage: 'primary',
  'sage-soft': 'surfaceMuted',
  coral: 'danger',
  'coral-soft': 'surfaceMuted',
  amber: 'text',
  'on-accent': 'onPrimary',
};

describe('anciens noms global.css ↔ jetons du design system', () => {
  it.each(Object.keys(legacyToToken))('%s suit son jeton en clair et en sombre', (legacyName) => {
    for (const theme of ['light', 'dark'] as const) {
      expect(cssByTheme[theme][legacyName]).toBe(colorTokens[theme][legacyToToken[legacyName]].toUpperCase());
    }
  });

  it('le pont TypeScript (palette) renvoie les mêmes valeurs que global.css', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const [name, value] of Object.entries(palette[theme])) {
        expect(value.toUpperCase()).toBe(cssByTheme[theme][name]);
      }
    }
  });
});

describe('jetons de couleur', () => {
  it('clair et sombre définissent exactement les mêmes jetons', () => {
    expect(Object.keys(colorTokens.dark).sort()).toEqual(Object.keys(colorTokens.light).sort());
  });

  it('chaque valeur est une couleur #RRGGBB, #RRGGBBAA ou rgba()', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const [name, value] of Object.entries(colorTokens[theme])) {
        expect({ theme, name, ok: /^(#[0-9A-Fa-f]{6}|rgba\(\d+,\d+,\d+,[\d.]+\))$/.test(value) }).toEqual({
          theme,
          name,
          ok: true,
        });
      }
    }
  });
});

describe('contrastes (WCAG AA : 4,5:1 pour le texte, 3:1 pour les icônes et grands textes)', () => {
  const pairs: [string, keyof ColorTokens, keyof ColorTokens, number][] = [
    ['texte sur fond', 'text', 'bg', 4.5],
    ['texte sur surface', 'text', 'surface', 4.5],
    ['texte secondaire sur fond', 'textMuted', 'bg', 4.5],
    ['texte secondaire sur surface', 'textMuted', 'surface', 4.5],
    ['texte du bouton principal', 'onPrimary', 'primary', 4.5],
    ['icône du bouton +', 'fabIcon', 'fab', 3],
    ['alerte sur fond', 'danger', 'bg', 4.5],
    ['alerte sur surface', 'danger', 'surface', 4.5],
    ['sélection sur surface', 'selectedBorder', 'surface', 3],
  ];

  it.each(pairs)('%s', (_label, foreground, background, minimum) => {
    for (const theme of ['light', 'dark'] as const) {
      const ratio = contrastRatio(colorTokens[theme][foreground], colorTokens[theme][background]);
      expect({ theme, ok: ratio >= minimum, ratio: Math.round(ratio * 10) / 10 }).toEqual({
        theme,
        ok: true,
        ratio: Math.round(ratio * 10) / 10,
      });
    }
  });

  it('calcule noir sur blanc = 21:1 et un gris moyen sous 4,5:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#8F949C', '#FFFFFF')).toBeLessThan(4.5);
  });
});
