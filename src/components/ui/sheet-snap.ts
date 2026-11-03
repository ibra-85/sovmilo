import { DISMISS_VELOCITY, UPWARD_RESISTANCE } from './sheet-dismiss';

/**
 * Hauteurs et gestes d'un panneau inférieur EXTENSIBLE (`BottomSheet expandable`). Fonctions pures, sans rendu, testées.
 *
 * Deux états seulement : `compact` (une partie utile du contenu) et `expanded` (toute la place disponible, contenu défilant).
 * Aucune hauteur en pixels écrite en dur : tout se déduit de la fenêtre, des marges système, du clavier et de la hauteur MESURÉE du
 * contenu. Un contenu court donne un panneau de sa hauteur naturelle, sans second état.
 */

/** Hauteur de la zone de la poignée (même valeur que le BottomSheet). */
export const SHEET_HANDLE_ZONE = 28;
/** Espace laissé libre sous la barre d'état quand le panneau est entièrement déployé. */
export const SHEET_TOP_GAP = 16;
/** Marge du panneau détaché au-dessus du clavier (design : 10 dp). */
export const SHEET_FLOATING_MARGIN = 10;
/** Part de la hauteur utilisable de la fenêtre occupée par l'état compact. */
export const COMPACT_RATIO = 0.55;
/** Hauteur minimale de la zone défilante visible en état compact : au moins quelques champs. */
export const MIN_BODY_HEIGHT = 160;
/** En dessous de cet écart, deux états ne se distinguent pas : le panneau n'est pas extensible. */
export const EXPAND_EPSILON = 24;
/** Vitesse (px/s) au-delà de laquelle un geste vers le haut déploie et un geste vers le bas réduit, quelle que soit la distance. */
export const SNAP_VELOCITY = 600;
/** Un geste rapide ne ferme qu'après avoir déjà tiré le panneau d'au moins cette distance sous l'état compact. */
export const MIN_DISMISS_OFFSET = 24;

export interface SheetMetricsInput {
  /** Hauteur de la fenêtre (dp). */
  windowHeight: number;
  /** Marge de la barre d'état. */
  insetTop: number;
  /** Remplissage bas réellement appliqué au panneau (barre de navigation Android comprise). */
  bottomPadding: number;
  /** Hauteur du clavier ; 0 s'il est fermé. */
  keyboardHeight: number;
  /** Hauteur mesurée du contenu défilant (toute sa longueur, pas seulement la partie visible). */
  contentHeight: number;
  /** Hauteur mesurée du pied (bouton principal). */
  footerHeight: number;
}

export interface SheetHeights {
  /** Hauteur de l'état compact. */
  compact: number;
  /** Hauteur de l'état déployé. */
  expanded: number;
  /** Hauteur naturelle (contenu entier, sans limite d'écran). */
  natural: number;
  /** Place disponible pour le panneau, clavier déduit. */
  available: number;
  /** Deux états distincts existent : la poignée peut agrandir et réduire. */
  expandable: boolean;
}

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Valeur finie et positive, sinon 0 : une mesure absente ou invalide ne doit jamais produire une hauteur `NaN`. */
const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export function computeSheetHeights(input: SheetMetricsInput): SheetHeights {
  const windowHeight = safe(input.windowHeight);
  const keyboard = safe(input.keyboardHeight);
  const chrome = SHEET_HANDLE_ZONE + safe(input.footerHeight) + safe(input.bottomPadding);
  const natural = chrome + safe(input.contentHeight);

  // Place réelle : sous la barre d'état, et au-dessus du clavier (avec sa marge) quand il est ouvert.
  const usable = Math.max(0, windowHeight - safe(input.insetTop) - SHEET_TOP_GAP);
  const available = Math.max(0, keyboard > 0 ? usable - keyboard - SHEET_FLOATING_MARGIN : usable);

  const expanded = Math.min(natural, available);
  // L'état compact ne dépend PAS du clavier : il est calculé sur la fenêtre, pour ne pas varier d'un appareil ou d'un instant à l'autre.
  const wanted = Math.round(usable * COMPACT_RATIO);
  const smallest = chrome + MIN_BODY_HEIGHT;
  const compact = clampNumber(wanted, Math.min(smallest, expanded), expanded);

  return { compact, expanded, natural, available, expandable: expanded - compact > EXPAND_EPSILON };
}

/** Hauteur cible au repos : le clavier ouvert occupe toute la place disponible ; sinon l'état choisi. */
export function restingHeight(heights: SheetHeights, mode: 'compact' | 'expanded', keyboardOpen: boolean): number {
  'worklet';
  return keyboardOpen || mode === 'expanded' ? heights.expanded : heights.compact;
}

export interface SheetDrag {
  /** Hauteur du panneau pendant le geste (toujours entre compact et déployé). */
  height: number;
  /** Écart vers le bas sous l'état compact (fermeture) ; négatif : léger étirement au-dessus du déployé. */
  offset: number;
}

/**
 * Position du panneau pendant un geste de poignée. `startHeight` est la hauteur au début du geste, `translationY` le déplacement du
 * doigt (négatif vers le haut). Vers le haut, la hauteur grandit jusqu'au déployé (résistance au-delà) ; vers le bas, elle diminue
 * jusqu'au compact, puis le panneau descend (fermeture).
 */
export function resolveSheetDrag(startHeight: number, translationY: number, compact: number, expanded: number): SheetDrag {
  'worklet';
  const raw = startHeight - translationY;
  if (raw > expanded) return { height: expanded, offset: (expanded - raw) * UPWARD_RESISTANCE };
  if (raw >= compact) return { height: raw, offset: 0 };
  return { height: compact, offset: compact - raw };
}

export type SheetRelease = 'compact' | 'expanded' | 'dismiss';

export interface SheetReleaseInput {
  /** Hauteur au début du geste. */
  startHeight: number;
  /** Hauteur et écart courants (voir `resolveSheetDrag`). */
  height: number;
  offset: number;
  velocityY: number;
  compact: number;
  expanded: number;
  /** Part de la hauteur à tirer vers le bas pour fermer (design : 30 %). */
  dismissRatio: number;
}

/**
 * Que fait le panneau au relâchement ?
 *  - `dismiss` : seulement si le geste a COMMENCÉ en état compact et que le panneau a été tiré assez loin (ratio de sa hauteur) ou assez
 *    vite après un vrai déplacement. Un geste qui commence déployé ne ferme JAMAIS : il réduit.
 *  - sinon `expanded` ou `compact` : la vitesse décide si elle est nette, la moitié du parcours sinon.
 */
export function resolveSheetRelease(input: SheetReleaseInput): SheetRelease {
  'worklet';
  const { startHeight, height, offset, velocityY, compact, expanded, dismissRatio } = input;
  const startedCompact = startHeight <= compact + 1;
  if (startedCompact && offset > 0 && (offset > height * dismissRatio || (velocityY > DISMISS_VELOCITY && offset > MIN_DISMISS_OFFSET))) {
    return 'dismiss';
  }
  if (expanded - compact <= 1) return 'compact';
  if (velocityY < -SNAP_VELOCITY) return 'expanded';
  if (velocityY > SNAP_VELOCITY) return 'compact';
  return height >= (compact + expanded) / 2 ? 'expanded' : 'compact';
}
