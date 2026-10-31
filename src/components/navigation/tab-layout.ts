/**
 * Géométrie de la barre d'onglets flottante (design/COMPONENTS.md « FloatingTabBar », MOTION.md « Onglets »).
 *
 * Fonctions pures, marquées « worklet » : elles tournent sur le thread UI à chaque image de l'animation, et sont
 * testées sous Jest comme du JavaScript ordinaire.
 *
 * Principe : l'onglet actif a sa largeur « icône + libellé », les autres se partagent le reste à parts égales
 * (« les autres onglets se redistribuent sans compression ni oscillation »). `position` est un nombre décimal
 * (0 = premier onglet, 1.5 = à mi-chemin entre le 2e et le 3e) : l'animation ne fait que le faire glisser, et
 * toutes les largeurs en découlent, donc la barre est toujours exactement remplie.
 */

export const TAB_ICON_SIZE = 24;
/** Espace entre l'icône et le libellé de l'onglet actif. */
export const TAB_LABEL_GAP = 8;
/** Marge interne horizontale de la pastille active. */
export const TAB_PILL_PADDING = 14;
/** Largeur minimale d'un onglet inactif : sa zone visible (la zone tactile est portée à 48 dp par `hitSlop`). */
export const TAB_MIN_INACTIVE = 44;
/** Au-delà de ce facteur d'agrandissement du texte, la barre passe en icônes seules (dessiné : 130 %). */
export const TAB_ICONS_ONLY_FONT_SCALE = 1.3;

export interface TabGeometry {
  /** Part de chaque onglet dans la pastille active : 1 sur l'onglet actif, 0 sur les autres, décimale en transition. */
  weights: number[];
  widths: number[];
  lefts: number[];
  pillLeft: number;
  pillWidth: number;
}

/** Largeur de la pastille active d'un onglet, d'après la largeur mesurée de son libellé. */
export function activeTabWidth(labelWidth: number): number {
  'worklet';
  return labelWidth + TAB_ICON_SIZE + TAB_LABEL_GAP + TAB_PILL_PADDING * 2;
}

/**
 * Faut-il n'afficher que les icônes ? Oui quand le texte système est très agrandi, ou quand le libellé actif le plus
 * long ne laisse pas 44 dp aux autres onglets (longs libellés russes, petit écran).
 */
export function shouldUseIconsOnly(innerWidth: number, activeWidths: readonly number[], fontScale: number): boolean {
  if (fontScale >= TAB_ICONS_ONLY_FONT_SCALE) return true;
  if (activeWidths.length < 2) return false;
  const widest = Math.max(...activeWidths);
  return innerWidth - widest < (activeWidths.length - 1) * TAB_MIN_INACTIVE;
}

/** Position et largeur de la pastille quand l'onglet `index` est actif et immobile. */
function restingPill(index: number, innerWidth: number, activeWidths: readonly number[], iconsOnly: boolean) {
  'worklet';
  const count = activeWidths.length;
  if (iconsOnly || count < 2) {
    const width = innerWidth / Math.max(count, 1);
    return { left: index * width, width };
  }
  const inactive = (innerWidth - activeWidths[index]) / (count - 1);
  return { left: index * inactive, width: activeWidths[index] };
}

/**
 * Abscisse de l'icône dans son onglet. Inactif : centrée. Actif : l'ensemble « icône + libellé » est centré, donc
 * l'icône se décale de la moitié de la place prise par le libellé (centrage optique).
 */
export function tabIconLeft(width: number, weight: number, labelWidth: number, iconsOnly: boolean): number {
  'worklet';
  const centered = (width - TAB_ICON_SIZE) / 2;
  return iconsOnly ? centered : centered - (weight * (labelWidth + TAB_LABEL_GAP)) / 2;
}

/** Opacité du libellé : il apparaît en fondu quand la pastille arrive (à partir de 40 % du trajet). */
export function tabLabelOpacity(weight: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (weight - 0.4) / 0.6));
}

export function computeTabLayout(
  position: number,
  innerWidth: number,
  activeWidths: readonly number[],
  iconsOnly: boolean,
): TabGeometry {
  'worklet';
  const count = activeWidths.length;
  const clamped = Math.min(Math.max(position, 0), Math.max(count - 1, 0));

  const weights: number[] = [];
  for (let k = 0; k < count; k++) weights.push(Math.max(0, 1 - Math.abs(clamped - k)));

  const widths: number[] = [];
  if (iconsOnly || count < 2) {
    for (let k = 0; k < count; k++) widths.push(innerWidth / count);
  } else {
    let activeSum = 0;
    for (let k = 0; k < count; k++) activeSum += weights[k] * activeWidths[k];
    // La somme des poids vaut 1 : (n − 1) × b + Σ poids × largeur active = largeur intérieure.
    const inactive = (innerWidth - activeSum) / (count - 1);
    for (let k = 0; k < count; k++) widths.push(inactive + weights[k] * (activeWidths[k] - inactive));
  }

  const lefts: number[] = [];
  let cursor = 0;
  for (let k = 0; k < count; k++) {
    lefts.push(cursor);
    cursor += widths[k];
  }

  // Pastille : interpolation linéaire entre ses deux positions de repos (onglet quitté → onglet visé). Elle avance donc
  // toujours dans le même sens, même si les largeurs des onglets changent pendant le trajet (une moyenne pondérée des
  // bords d'onglets, elle, reculerait par moments).
  const lower = Math.floor(clamped);
  const upper = Math.min(lower + 1, Math.max(count - 1, 0));
  const t = clamped - lower;
  const a = restingPill(lower, innerWidth, activeWidths, iconsOnly);
  const b = restingPill(upper, innerWidth, activeWidths, iconsOnly);
  const pillLeft = a.left + (b.left - a.left) * t;
  const pillWidth = a.width + (b.width - a.width) * t;
  return { weights, widths, lefts, pillLeft, pillWidth };
}
