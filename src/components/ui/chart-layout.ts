import { textWidthEm } from '@/theme/amount-fit';

/**
 * Géométrie du graphique par semaine pour les gros montants. Fonctions pures, testées.
 *
 * Deux problèmes : (1) les valeurs arrondies sous chaque barre (« 2 010 200 € ») peuvent être plus larges que leur colonne
 * et se toucher ; (2) l'indicateur exact de la barre choisie doit rester entier, sans sortir de la carte.
 */
const SAFETY = 1.04;

/** Largeur estimée d'un texte de `size` sp, texte agrandi compris. */
export function labelWidth(text: string, size: number, fontScale = 1): number {
  return textWidthEm(text) * size * fontScale * SAFETY;
}

/**
 * Les valeurs sous les barres sont-elles toutes affichables côte à côte ? Sinon (gros montants), seule la barre choisie
 * montre sa valeur — dans l'indicateur — et les autres s'en passent : un graphique lisible vaut mieux que quatre
 * nombres qui se chevauchent. Le résumé pour TalkBack garde toutes les valeurs.
 */
export function barValuesFit(texts: readonly string[], columnWidth: number, size: number, fontScale = 1): boolean {
  const gutter = 4;
  return texts.every((text) => labelWidth(text, size, fontScale) + gutter <= columnWidth);
}

export interface IndicatorInput {
  index: number;
  count: number;
  /** Largeur de la zone des barres. */
  chartWidth: number;
  textWidth: number;
  /** Combien l'indicateur peut dépasser de la zone des barres de chaque côté (la marge de la carte). */
  overflow: number;
  padding: number;
}

/**
 * Position de l'indicateur d'une barre, RELATIVE à sa colonne : centré sur la barre, aussi large que son texte, puis
 * ramené dans les limites (zone des barres ± `overflow`). Il ne dépasse jamais de la carte.
 */
export function indicatorBox({ index, count, chartWidth, textWidth, overflow, padding }: IndicatorInput): {
  left: number;
  width: number;
} {
  const column = chartWidth / count;
  const width = Math.min(textWidth + padding * 2, chartWidth + overflow * 2);
  const center = column * (index + 0.5);
  const minLeft = -overflow;
  const maxLeft = chartWidth + overflow - width;
  const left = Math.min(Math.max(center - width / 2, minLeft), Math.max(minLeft, maxLeft));
  return { left: left - column * index, width };
}
