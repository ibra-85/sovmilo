/**
 * Placement d'un popover (menu « ⋯ », sélecteur de mois, menu d'une catégorie) par rapport à son déclencheur. Fonctions
 * pures, testées : toute la géométrie est ici, le composant ne fait que l'animer.
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

export type PopoverAlign = 'end' | 'center';

/**
 * - `cover` (défaut du composant) : le déclencheur SE TRANSFORME en menu. Le menu part de l'arête du déclencheur (haut s'il
 *   s'ouvre vers le bas, bas s'il s'ouvre vers le haut) et s'étend à partir d'elle : il recouvre donc le déclencheur.
 * - `beside` : le menu se pose à côté du déclencheur, séparé de `gap`, et le laisse visible (champ qui doit rester lisible).
 */
export type PopoverMode = 'cover' | 'beside';

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
  /** Mode `beside` : espace entre le déclencheur et le popover. */
  gap: number;
  /** `end` (défaut) : bord droit sur celui du déclencheur (bouton « ⋯ »). `center` : centré sur le déclencheur (tuile). */
  align?: PopoverAlign;
  /** Hauteur du clavier à l'écran (0 s'il est fermé) : le popover ne passe jamais derrière lui. */
  keyboardHeight?: number;
  /** `beside` par défaut (compatibilité) ; le composant utilise `cover`. */
  mode?: PopoverMode;
  /** Hauteur maximale du popover, même s'il y a de la place : au-delà, le contenu défile (liste de mois). */
  maxHeight?: number;
}

export interface PopoverPlacement {
  left: number;
  top: number;
  width: number;
  /** Hauteur réellement affichée : celle du contenu, réduite s'il manque de la place (le contenu défile alors). */
  height: number;
  /** `below` : s'ouvre vers le bas ; `above` : vers le haut (pas assez de place dessous). */
  side: 'below' | 'above';
}

/** Hauteur d'un menu : lignes de `rowHeight`, filet de 1 dp entre deux lignes, marge intérieure `padding` en haut et en bas. */
export function estimateMenuHeight(rowCount: number, rowHeight: number, padding: number): number {
  const rows = Math.max(0, rowCount);
  return rows * rowHeight + Math.max(0, rows - 1) + padding * 2;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Part de la zone utilisable (hors barres système) qu'un menu peut occuper : au-delà, la liste défile à l'intérieur. */
export const MENU_MAX_HEIGHT_RATIO = 0.5;

/** Hauteur maximale d'un menu pour cette fenêtre : la moitié de la zone utilisable. Un menu d'actions (3 lignes) n'est jamais concerné. */
export function menuMaxHeight(windowHeight: number, insets: Pick<Insets, 'top' | 'bottom'>): number {
  return Math.max(0, Math.floor((windowHeight - insets.top - insets.bottom) * MENU_MAX_HEIGHT_RATIO));
}

/** Dimensions intérieures d'un menu, en dp : UNE source pour le dessin (`popover-menu.tsx`) et pour le calcul de sa largeur. */
export const MENU_METRICS = {
  /** Marge entre la bordure du menu et ses lignes. */
  padding: 6,
  /** Bordure de la surface. */
  border: 1,
  /** Marge horizontale d'une ligne. */
  rowPadding: 14,
  /** Espace entre icône, libellé et coche. */
  gap: 12,
  icon: 20,
  check: 18,
} as const;

export interface MenuWidthInput {
  labels: readonly string[];
  /** Au moins une ligne a une icône (20 dp + espace). */
  hasIcon: boolean;
  /** Une ligne peut porter la coche du choix actuel. */
  hasCheck: boolean;
  /** Largeur de base du menu : jamais plus étroit. */
  minWidth: number;
  /** Largeur maximale : celle de l'écran moins les marges. Au-delà, le libellé passe sur plusieurs lignes. */
  maxWidth: number;
  /** Taille du texte du système, déjà plafonnée comme le libellé (`maxFontScale`). */
  fontScale: number;
  /** Taille du texte du libellé (sp) avant agrandissement. */
  fontSize: number;
}

/** Largeur moyenne d'un caractère, en parts de la taille du texte (Inter, latin et cyrillique, majuscules comprises : volontairement large). */
const CHAR_WIDTH_EM = 0.58;

/**
 * Largeur dont un menu a besoin pour que son plus long libellé tienne sur UNE ligne. Estimation (le texte n'est pas mesurable
 * avant d'être dessiné) volontairement généreuse : un menu un peu large ne gêne pas, un libellé coupé si. Bornée par l'écran :
 * si même cela ne suffit pas (texte très agrandi), le libellé passe sur deux lignes et la hauteur mesurée s'adapte.
 */
export function estimateMenuWidth(input: MenuWidthInput): number {
  const chrome = MENU_METRICS;
  const longest = input.labels.reduce((max, label) => Math.max(max, label.length), 0);
  const text = longest * input.fontSize * input.fontScale * CHAR_WIDTH_EM;
  const fixed =
    chrome.padding * 2 +
    chrome.border * 2 +
    chrome.rowPadding * 2 +
    (input.hasIcon ? chrome.icon + chrome.gap : 0) +
    (input.hasCheck ? chrome.check + chrome.gap : 0);
  return Math.min(Math.max(input.minWidth, Math.ceil(text + fixed)), Math.max(input.minWidth, input.maxWidth));
}

/**
 * Position de défilement qui place la ligne `row` au milieu de la zone visible, sans jamais dépasser les extrémités du contenu.
 * Sert à montrer le choix actuel d'une longue liste (le mois consulté) dès l'ouverture.
 */
export function scrollOffsetToReveal(row: { y: number; height: number }, viewportHeight: number, contentHeight: number): number {
  if (viewportHeight <= 0 || contentHeight <= viewportHeight) return 0;
  return Math.round(clamp(row.y - (viewportHeight - row.height) / 2, 0, contentHeight - viewportHeight));
}

export function computePopoverPlacement(input: PopoverPlacementInput): PopoverPlacement {
  const { contentHeight, window, insets, margin, gap } = input;
  const mode = input.mode ?? 'beside';
  const keyboard = Math.max(0, input.keyboardHeight ?? 0);

  const minLeft = insets.left + margin;
  const maxRight = window.width - insets.right - margin;
  const width = Math.min(input.width, Math.max(0, maxRight - minLeft));

  // Zone verticale utilisable : sous la barre d'état, au-dessus de la barre de navigation OU du clavier (le plus haut des deux).
  const topLimit = insets.top + margin;
  const bottomLimit = window.height - Math.max(insets.bottom, keyboard) - margin;

  // Un déclencheur partiellement sorti de la zone utilisable (défilement, clavier) est ramené dedans POUR LE CALCUL : le menu
  // reste toujours visible. La surface, elle, part du rectangle réel du déclencheur (voir le composant).
  const trigger: Rect = {
    ...input.trigger,
    y: clamp(input.trigger.y, insets.top, bottomLimit - input.trigger.height),
  };

  // Par défaut le popover est aligné sur le bord DROIT du déclencheur (là où se trouvent « ⋯ » et le sélecteur de période) ;
  // pour une tuile, il est centré sur elle. Dans les deux cas il est ensuite ramené dans l'écran.
  const wanted =
    input.align === 'center' ? trigger.x + trigger.width / 2 - width / 2 : trigger.x + trigger.width - width;
  const left = clamp(wanted, minLeft, maxRight - width);

  // `cover` : le menu part de l'arête du déclencheur ; `beside` : il en est séparé de `gap`.
  const spaceBelow = bottomLimit - (mode === 'cover' ? trigger.y : trigger.y + trigger.height + gap);
  const spaceAbove = (mode === 'cover' ? trigger.y + trigger.height : trigger.y - gap) - topLimit;

  // Hauteur voulue : celle du contenu, plafonnée par `maxHeight` (le contenu défile alors dans la surface).
  const wantedHeight = Math.min(contentHeight, Math.max(0, input.maxHeight ?? Infinity));

  let side: 'below' | 'above';
  if (wantedHeight <= spaceBelow) side = 'below';
  else if (wantedHeight <= spaceAbove) side = 'above';
  else side = spaceBelow >= spaceAbove ? 'below' : 'above';

  const available = Math.max(0, side === 'below' ? spaceBelow : spaceAbove);
  const height = Math.min(wantedHeight, available);
  const top =
    side === 'below'
      ? mode === 'cover'
        ? trigger.y
        : trigger.y + trigger.height + gap
      : mode === 'cover'
        ? trigger.y + trigger.height - height
        : trigger.y - gap - height;

  return { left, top, width, height, side };
}

/** Un rectangle est exploitable s'il a des nombres finis et une taille non nulle (une mesure ratée renvoie souvent 0, 0, 0, 0). */
export function isUsableRect(rect: Rect | null | undefined): rect is Rect {
  return (
    !!rect &&
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Emplacement de repli quand le déclencheur ne peut pas être mesuré (référence pas encore posée, mesure nulle) : un carré de
 * 44 dp en haut à droite de la zone utilisable, là où se trouvent les boutons « ⋯ ». Le menu s'ouvre ainsi plutôt que
 * d'ignorer le toucher.
 */
export function fallbackAnchor(window: { width: number }, insets: Insets, margin: number, size = 44): Rect {
  return { x: window.width - insets.right - margin - size, y: insets.top + margin, width: size, height: size };
}

/** Choisit la meilleure mesure disponible : la mesure fraîche, sinon la dernière bonne mesure, sinon l'emplacement de repli. */
export function resolveAnchor(measured: Rect | null | undefined, lastGood: Rect | null, fallback: Rect): Rect {
  if (isUsableRect(measured)) return measured;
  if (isUsableRect(lastGood)) return lastGood;
  return fallback;
}

export function pointInRect(x: number, y: number, rect: Rect, slop = 0): boolean {
  return x >= rect.x - slop && x <= rect.x + rect.width + slop && y >= rect.y - slop && y <= rect.y + rect.height + slop;
}
