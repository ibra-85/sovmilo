/**
 * Placement d'un popover (menu « ⋯ », sélecteur de mois) par rapport à son déclencheur. Fonctions pures, testées :
 * toute la géométrie est ici, le composant ne fait que l'animer.
 *
 * Coordonnées : celles de la fenêtre (`measureInWindow`), la même origine que la fenêtre `Modal` plein écran
 * (barre d'état et de navigation translucides).
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PopoverPlacementInput {
  trigger: Rect;
  /** Hauteur souhaitée du popover (contenu complet). */
  contentHeight: number;
  /** Largeur souhaitée. */
  width: number;
  window: { width: number; height: number };
  insets: Insets;
  /** Marge minimale avec les bords de l'écran et les zones système. */
  margin: number;
  /** Espace entre le déclencheur et le popover. */
  gap: number;
}

export interface PopoverPlacement {
  left: number;
  top: number;
  width: number;
  /** Hauteur réellement affichée : celle du contenu, réduite s'il manque de la place (le contenu défile alors). */
  height: number;
  /** `below` : sous le déclencheur ; `above` : au-dessus (pas assez de place dessous). */
  side: 'below' | 'above';
}

/** Hauteur d'un menu : lignes de `rowHeight`, filet de 1 dp entre deux lignes, marge intérieure `padding` en haut et en bas. */
export function estimateMenuHeight(rowCount: number, rowHeight: number, padding: number): number {
  const rows = Math.max(0, rowCount);
  return rows * rowHeight + Math.max(0, rows - 1) + padding * 2;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function computePopoverPlacement(input: PopoverPlacementInput): PopoverPlacement {
  const { trigger, contentHeight, window, insets, margin, gap } = input;

  const minLeft = insets.left + margin;
  const maxRight = window.width - insets.right - margin;
  const width = Math.min(input.width, Math.max(0, maxRight - minLeft));

  // Le popover est aligné sur le bord DROIT du déclencheur (là où se trouvent « ⋯ » et le sélecteur de période) ;
  // il est ensuite ramené dans l'écran.
  const left = clamp(trigger.x + trigger.width - width, minLeft, maxRight - width);

  const spaceBelow = window.height - insets.bottom - margin - (trigger.y + trigger.height + gap);
  const spaceAbove = trigger.y - gap - (insets.top + margin);

  let side: 'below' | 'above';
  if (contentHeight <= spaceBelow) side = 'below';
  else if (contentHeight <= spaceAbove) side = 'above';
  else side = spaceBelow >= spaceAbove ? 'below' : 'above';

  const available = Math.max(0, side === 'below' ? spaceBelow : spaceAbove);
  const height = Math.min(contentHeight, available);
  const top = side === 'below' ? trigger.y + trigger.height + gap : trigger.y - gap - height;

  return { left, top, width, height, side };
}
