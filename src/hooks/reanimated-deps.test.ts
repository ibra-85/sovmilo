import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

/*
 * Garde-fou : sur Android (natif), Reanimated IGNORE le tableau de dépendances des hooks d'animation et le signale par
 * « [Reanimated] Dependencies should only be used on the web and are always ignored on native ». Les worklets déduisent
 * eux-mêmes ce qu'ils capturent (plugin Babel de Worklets) : on ne passe donc jamais de tableau à ces hooks.
 * Les hooks React ordinaires (useEffect, useMemo, useCallback) gardent évidemment leurs dépendances.
 */

/** Nombre d'arguments à partir duquel un appel passe un tableau de dépendances. */
const FIRST_DEPENDENCY_ARGUMENT: Record<string, number> = {
  useAnimatedStyle: 2,
  useAnimatedProps: 2,
  useDerivedValue: 2,
  useAnimatedReaction: 3,
  useAnimatedScrollHandler: 2,
  useHandler: 2,
};

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('hooks Reanimated sans tableau de dépendances', () => {
  const srcFolder = path.join(__dirname, '..');

  it('aucun appel de src/ ne passe de dépendances à un hook Reanimated', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(srcFolder)) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const first = FIRST_DEPENDENCY_ARGUMENT[node.expression.text];
          if (first !== undefined && node.arguments.length >= first) {
            // `useAnimatedStyle(fn, null)` ne déclenche pas l'avertissement ; un tableau (ou autre valeur) oui.
            const argument = node.arguments[first - 1];
            const isNull = argument.kind === ts.SyntaxKind.NullKeyword;
            const isUndefined = ts.isIdentifier(argument) && argument.text === 'undefined';
            if (!isNull && !isUndefined) {
              const { line } = source.getLineAndCharacterOfPosition(node.getStart());
              offenders.push(`${path.relative(srcFolder, file)}:${line + 1} ${node.expression.text}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(offenders).toEqual([]);
  });
});
