import { useColorScheme } from 'react-native';

/**
 * Palette pour les endroits où l'on ne peut pas utiliser `className` (barre d'onglets, navigation, barre d'état).
 * Doit rester identique à src/global.css : le test src/theme/colors.test.ts vérifie la correspondance.
 */
export const palette = {
  light: {
    bg: '#FAF5E8', // crème
    surface: '#FFFDF7',
    line: '#E5DDC9',
    ink: '#2B2A26',
    muted: '#6B675C',
    sage: '#4A7C59', // vert sauge (positif)
    coral: '#C95542', // corail doux (alertes)
  },
  dark: {
    bg: '#1C1B17',
    surface: '#2A2822',
    line: '#3E3B32',
    ink: '#F3EEDF',
    muted: '#A8A394',
    sage: '#8FC09B',
    coral: '#F08C7A',
  },
} as const;

export type ThemeName = keyof typeof palette;
export type ThemeColors = (typeof palette)[ThemeName];

export function useThemeName(): ThemeName {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useThemeColors(): ThemeColors {
  return palette[useThemeName()];
}
