/** Éléments SVG présents dans le jeu d'icônes du design (grille 24 × 24, trait arrondi). */
export type IconElement =
  | { type: 'path'; d: string }
  | { type: 'circle'; cx: string; cy: string; r: string }
  | { type: 'rect'; x: string; y: string; width: string; height: string; rx?: string };

export interface IconDefinition {
  /** Épaisseur de trait d'origine (1,8 par défaut ; 2,2 pour l'onglet actif, 3 pour la coche de sélection…). */
  strokeWidth: number;
  elements: readonly IconElement[];
}
