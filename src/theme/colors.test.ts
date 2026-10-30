import { readFileSync } from 'fs';
import { join } from 'path';

import { palette } from './colors';

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
const light = parseVariables(css.slice(0, darkStart));
const dark = parseVariables(css.slice(darkStart));

describe('palette TypeScript ↔ global.css', () => {
  it.each(['bg', 'surface', 'line', 'ink', 'muted', 'sage', 'coral'] as const)('%s est identique en clair et en sombre', (name) => {
    expect(palette.light[name].toUpperCase()).toBe(light[name]);
    expect(palette.dark[name].toUpperCase()).toBe(dark[name]);
  });
});
