import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Vérifie dans les fichiers de police eux-mêmes (pas sur leur taille) qu'Inter embarquée contient les glyphes dont
 * l'application a besoin : français, russe, signes des montants, et la variante de chiffres tabulaires (« tnum »).
 * Petit lecteur TrueType : table `cmap` (formats 4 et 12) et liste des fonctionnalités OpenType de `GSUB`.
 */

const FONT_DIR = join(__dirname, '..', '..', 'node_modules', '@expo-google-fonts', 'inter');
const FONT_FILES = {
  regular: join(FONT_DIR, '400Regular', 'Inter_400Regular.ttf'),
  medium: join(FONT_DIR, '500Medium', 'Inter_500Medium.ttf'),
  semibold: join(FONT_DIR, '600SemiBold', 'Inter_600SemiBold.ttf'),
} as const;

function readTables(view: DataView): Map<string, { offset: number; length: number }> {
  const tables = new Map<string, { offset: number; length: number }>();
  const count = view.getUint16(4);
  for (let i = 0; i < count; i++) {
    const record = 12 + i * 16;
    const tag = String.fromCharCode(...[0, 1, 2, 3].map((n) => view.getUint8(record + n)));
    tables.set(tag, { offset: view.getUint32(record + 8), length: view.getUint32(record + 12) });
  }
  return tables;
}

/** Ensemble des points de code ayant un glyphe (id de glyphe non nul). */
function readCoverage(view: DataView, cmapOffset: number): Set<number> {
  const covered = new Set<number>();
  const count = view.getUint16(cmapOffset + 2);
  for (let i = 0; i < count; i++) {
    const record = cmapOffset + 4 + i * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    if (platform !== 3 || (encoding !== 1 && encoding !== 10)) continue; // Unicode BMP ou complet
    const sub = cmapOffset + view.getUint32(record + 4);
    const format = view.getUint16(sub);

    if (format === 4) {
      const segCount = view.getUint16(sub + 6) / 2;
      const endCodes = sub + 14;
      const startCodes = endCodes + segCount * 2 + 2;
      const deltas = startCodes + segCount * 2;
      const rangeOffsets = deltas + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const end = view.getUint16(endCodes + s * 2);
        const start = view.getUint16(startCodes + s * 2);
        const delta = view.getInt16(deltas + s * 2);
        const rangeOffset = view.getUint16(rangeOffsets + s * 2);
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let glyph: number;
          if (rangeOffset === 0) {
            glyph = (code + delta) & 0xffff;
          } else {
            const at = rangeOffsets + s * 2 + rangeOffset + (code - start) * 2;
            const raw = view.getUint16(at);
            glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
          }
          if (glyph !== 0) covered.add(code);
        }
      }
    } else if (format === 12) {
      const groups = view.getUint32(sub + 12);
      for (let g = 0; g < groups; g++) {
        const group = sub + 16 + g * 12;
        const start = view.getUint32(group);
        const end = view.getUint32(group + 4);
        const firstGlyph = view.getUint32(group + 8);
        for (let code = start; code <= end; code++) if (firstGlyph + (code - start) !== 0) covered.add(code);
      }
    }
  }
  return covered;
}

function readFeatureTags(view: DataView, gsubOffset: number): Set<string> {
  const featureList = gsubOffset + view.getUint16(gsubOffset + 6);
  const count = view.getUint16(featureList);
  const tags = new Set<string>();
  for (let i = 0; i < count; i++) {
    const at = featureList + 2 + i * 6;
    tags.add(String.fromCharCode(...[0, 1, 2, 3].map((n) => view.getUint8(at + n))));
  }
  return tags;
}

const codes = (text: string) => [...text].map((char) => char.codePointAt(0)!);

const RUSSIAN = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const FRENCH = 'àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ«»’…–—';
const AMOUNTS = '0123456789+−-,.€%/·×'; // « − » = U+2212, le vrai signe moins des montants

describe.each(Object.entries(FONT_FILES))('Inter %s', (_name, path) => {
  const buffer = readFileSync(path);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const tables = readTables(view);
  const coverage = readCoverage(view, tables.get('cmap')!.offset);
  const missing = (text: string) => codes(text).filter((code) => !coverage.has(code)).map((c) => String.fromCodePoint(c));

  it('détecte un glyphe absent (garde-fou : le lecteur ne répond pas « oui » à tout)', () => {
    expect(missing('中')).toEqual(['中']);
  });

  it('contient tout l\'alphabet russe (majuscules, minuscules, Ё et ё)', () => {
    expect(missing(RUSSIAN)).toEqual([]);
  });

  it('contient les lettres accentuées et la ponctuation du français', () => {
    expect(missing(FRENCH)).toEqual([]);
  });

  it('contient les chiffres et les signes des montants, dont le vrai signe moins', () => {
    expect(missing(AMOUNTS)).toEqual([]);
  });

  it('propose les chiffres tabulaires (fonctionnalité OpenType « tnum »)', () => {
    expect(readFeatureTags(view, tables.get('GSUB')!.offset).has('tnum')).toBe(true);
  });
});
