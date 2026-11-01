/**
 * Utilitaires de couleur purs (testés). Servent aux états dérivés d'une couleur de jeton, par exemple « teinte −6 % »
 * d'un bouton pressé (design/MOTION.md : « Pressé : enfoncement de 1 dp, ombre portée réduite, teinte −6 % »).
 */

function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Couleur « #RRGGBB » attendue : ${hex}`);
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

const toHex = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');

/** Mélange `color` avec du noir : `amount` = 0,06 donne une teinte 6 % plus sombre. */
export function darken(color: string, amount: number): string {
  const [r, g, b] = parseHex(color);
  const keep = 1 - amount;
  return `#${toHex(r * keep)}${toHex(g * keep)}${toHex(b * keep)}`.toUpperCase();
}

/** Ajoute une opacité (0 à 1) à une couleur « #RRGGBB » : `withAlpha('#E8FF70', 0.1)` → « rgba(232,255,112,0.1) ». */
export function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = parseHex(color);
  return `rgba(${r},${g},${b},${alpha})`;
}
