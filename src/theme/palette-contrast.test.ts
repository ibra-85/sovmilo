import { contrastRatio } from './contrast';
import { colorTokens, type ColorTokens } from './tokens';

/** Texte courant (≥ 14 sp) : WCAG AA exige 4,5:1. */
const AA_TEXT = 4.5;

const pairs: { name: string; foreground: keyof ColorTokens; backgrounds: (keyof ColorTokens)[] }[] = [
  { name: 'texte principal', foreground: 'text', backgrounds: ['bg', 'surface', 'surfaceMuted', 'sheet', 'field'] },
  { name: 'texte secondaire', foreground: 'textMuted', backgrounds: ['bg', 'surface', 'surfaceMuted', 'sheet', 'field'] },
  { name: 'texte du bouton principal', foreground: 'onPrimary', backgrounds: ['primary'] },
  { name: 'texte d’alerte', foreground: 'danger', backgrounds: ['bg', 'surface', 'sheet'] },
];

describe.each(Object.entries(colorTokens))('contrastes de la palette — thème %s', (_name, colors) => {
  for (const { name, foreground, backgrounds } of pairs) {
    for (const background of backgrounds) {
      const front = colors[foreground];
      const back = colors[background];
      // Les jetons translucides (rgba) ne se comparent pas sans fond : ils sont couverts par leur surface opaque.
      if (!front.startsWith('#') || !back.startsWith('#')) continue;
      it(`${name} sur « ${background} » atteint ${AA_TEXT}:1`, () => {
        expect(contrastRatio(front, back)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }
});
