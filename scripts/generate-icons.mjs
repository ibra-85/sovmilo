// Convertit les SVG validés du design (design/assets/icons/*.svg) en données TypeScript
// (src/components/ui/icon-data.ts) pour les afficher avec react-native-svg, sans lire de fichier au runtime.
//
// Usage : node scripts/generate-icons.mjs
// Seuls <path>, <circle> et <rect> existent dans le jeu d'icônes ; toute autre balise fait échouer le script
// plutôt que d'être ignorée en silence.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sourceDir = join(root, 'design', 'assets', 'icons');
const target = join(root, 'src', 'components', 'ui', 'icon-data.ts');

const ATTRIBUTES = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  rect: ['x', 'y', 'width', 'height', 'rx'],
};

const quote = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const entries = readdirSync(sourceDir)
  .filter((file) => file.endsWith('.svg'))
  .sort()
  .map((file) => {
    const name = file.replace(/\.svg$/, '');
    const svg = readFileSync(join(sourceDir, file), 'utf8');

    const strokeWidth = Number(/stroke-width="([\d.]+)"/.exec(svg)?.[1]);
    if (!Number.isFinite(strokeWidth)) throw new Error(`${file} : stroke-width introuvable`);
    if (!/viewBox="0 0 24 24"/.test(svg)) throw new Error(`${file} : grille 24 × 24 attendue`);

    const tags = [...svg.matchAll(/<([a-z]+)\b([^>]*)>/g)].filter(([, tag]) => tag !== 'svg');
    const elements = tags.map(([, tag, rawAttributes]) => {
      const allowed = ATTRIBUTES[tag];
      if (!allowed) throw new Error(`${file} : balise <${tag}> non prise en charge`);
      const found = Object.fromEntries([...rawAttributes.matchAll(/([a-z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
      const unknown = Object.keys(found).filter((key) => !allowed.includes(key));
      if (unknown.length > 0) throw new Error(`${file} : attribut(s) ${unknown.join(', ')} non pris en charge sur <${tag}>`);
      const props = allowed.filter((key) => key in found).map((key) => `${key}: ${quote(found[key])}`);
      return `{ type: '${tag}', ${props.join(', ')} }`;
    });
    if (elements.length === 0) throw new Error(`${file} : aucun tracé`);

    return `  ${quote(name)}: { strokeWidth: ${strokeWidth}, elements: [${elements.join(', ')}] },`;
  });

const output = `// FICHIER GÉNÉRÉ par scripts/generate-icons.mjs à partir de design/assets/icons — ne pas modifier à la main.
// Grille 24 × 24, trait arrondi, couleur au choix du composant. \`strokeWidth\` = épaisseur d'origine du design.
import type { IconDefinition } from './icon-types';

export const iconData = {
${entries.join('\n')}
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof iconData;
`;

writeFileSync(target, output);
console.log(`${entries.length} icônes écrites dans ${target}`);
