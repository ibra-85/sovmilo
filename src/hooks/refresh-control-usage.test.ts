import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/*
 * Garde-fou du Hotfix 6.2.1. Sur Android, React Native clone l'élément passé à `refreshControl` et lui donne le défilement comme
 * ENFANT. Un composant maison qui n'affiche pas ses enfants vide donc tout l'écran (Accueil, Opérations, Budgets, Courses,
 * Factures, Épargne l'ont été au Lot 6.2B). Le rendu réel est vérifié par `data-screens.android.test.tsx` ; ceci empêche en plus
 * de réintroduire un composant intermédiaire : `refreshControl` reçoit soit l'élément de `useDataRefresh`, soit un vrai `RefreshControl`.
 */

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('prop refreshControl', () => {
  const uses = sourceFiles(SRC).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/refreshControl=(\{[^\n]*)/g)].map((match) => ({ file: path.relative(SRC, file), value: match[1] }));
  });

  it('est utilisée par les écrans de données', () => {
    expect(uses.length).toBeGreaterThanOrEqual(7);
  });

  it('ne reçoit jamais un composant maison', () => {
    for (const { file, value } of uses) {
      const ok = value.startsWith('{refreshControl}') || value.startsWith('{<RefreshControl');
      expect({ file, value, ok }).toEqual({ file, value, ok: true });
    }
  });
});
