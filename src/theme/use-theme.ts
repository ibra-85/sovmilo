import { useColorScheme } from 'react-native';

import { shadowTokens, type ShadowTokens } from './shadows';
import { colorTokens, type ColorTokens, type ThemeName } from './tokens';

export interface Theme {
  name: ThemeName;
  isDark: boolean;
  colors: ColorTokens;
  shadows: ShadowTokens;
}

const themes: Record<ThemeName, Theme> = {
  light: { name: 'light', isDark: false, colors: colorTokens.light, shadows: shadowTokens.light },
  dark: { name: 'dark', isDark: true, colors: colorTokens.dark, shadows: shadowTokens.dark },
};

/** Thème courant (suit le réglage clair / sombre du téléphone). Point d'entrée unique des composants. */
export function useTheme(): Theme {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function getTheme(name: ThemeName): Theme {
  return themes[name];
}
