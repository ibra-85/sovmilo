import path from 'node:path';

// `require` est voulu : Babel est un outil de test ici, pas du code de l'application.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const babel = require('@babel/core') as typeof import('@babel/core');

/**
 * Garde-fou contre la cause du plantage Android du Lot 6 : un geste (Gesture Handler) ou un style animé exécuté sur le thread UI
 * appelait `spring('sheetResize')`, une fonction JavaScript ordinaire. Reanimated la remplace alors par un « Remote Function Guard »
 * qui LÈVE une erreur sur le thread UI (`[Worklets] Tried to synchronously call a Remote Function`) : plantage fatal, seulement
 * quand le geste se terminait sans fermer le panneau (par exemple en tirant vers le haut).
 *
 * Ce test compile les fichiers à gestes avec la configuration Babel du projet et vérifie ce que chaque worklet capture. Il ne
 * remplace pas un essai sur appareil ; il empêche seulement de réintroduire CETTE erreur.
 */

const FILES = ['src/components/ui/bottom-sheet.tsx', 'src/features/savings/reorder-list.tsx'];

/** Fonctions JavaScript ordinaires du projet qui ne doivent jamais être capturées par un worklet. */
const FORBIDDEN = new Set(['spring', 'timing', 'delay', 't', 'setMode', 'setSheetHeight', 'setContentHeight', 'setFooterHeight', 'commit', 'moveBy']);

function closures(file: string): { worklet: string; captured: string[] }[] {
  const result = babel.transformFileSync(path.join(process.cwd(), file), {
    // `platform` est lu par babel-preset-expo ; le type de Babel ne le connaît pas.
    caller: { name: 'metro', platform: 'android', bundler: 'metro', isDev: false } as babel.TransformCaller,
    cwd: process.cwd(),
  });
  const code = result?.code ?? '';
  const found: { worklet: string; captured: string[] }[] = [];
  for (const match of code.matchAll(/code:"\(function (\w+)\([^)]*\)\{([^"]*)\}\)"/g)) {
    const names = /^const\[([^\]]*)\]=this\.__closure;/.exec(match[2]);
    found.push({ worklet: match[1], captured: names ? names[1].split(',').map((name) => name.trim()) : [] });
  }
  return found;
}

describe.each(FILES)('worklets de %s', (file) => {
  const found = closures(file);

  it('contient bien des worklets analysables (le test ne passe pas à vide)', () => {
    expect(found.length).toBeGreaterThan(0);
  });

  it('ne capture aucune fonction JavaScript ordinaire (ressort, minuterie, état React)', () => {
    for (const { worklet, captured } of found) {
      const offenders = captured.filter((name) => FORBIDDEN.has(name));
      expect({ worklet, offenders }).toEqual({ worklet, offenders: [] });
    }
  });
});
