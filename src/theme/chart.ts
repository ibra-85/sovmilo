import type { ThemeName } from './tokens';

/**
 * Couleurs du graphique « Dépenses par semaine » (design/DESIGN.md §5.2, « Barres du graphique »). Dégradés verticaux légers :
 * les semaines passées restent neutres ; la semaine en cours est graphite en clair, citron en sombre (OBSERVÉ).
 */
export interface ChartTokens {
  barTop: string;
  barBottom: string;
  currentTop: string;
  currentBottom: string;
  /** Anneau de 4 dp autour de la barre de la semaine en cours. */
  currentRing: string;
  /** Repère rond de 12 dp en haut de la barre en cours. */
  currentDot: string;
}

export const chartTokens: Record<ThemeName, ChartTokens> = {
  light: {
    barTop: '#F4F5F8',
    barBottom: '#E7E9EE',
    currentTop: '#43464E',
    currentBottom: '#1E2024',
    currentRing: 'rgba(32,34,39,0.06)',
    currentDot: '#F6F6F8',
  },
  dark: {
    barTop: '#2B2E34',
    barBottom: '#202328',
    currentTop: '#F2FFA0',
    currentBottom: '#D4EC4A',
    currentRing: 'rgba(255,255,255,0.08)',
    currentDot: '#090A0C',
  },
};
