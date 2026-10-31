import { useTheme } from './use-theme';
import { colorTokens, type ThemeName } from './tokens';

/**
 * PONT TEMPORAIRE vers l'ancienne palette (crème / sauge), utilisé par les écrans de l'étape 1–2a qui n'ont pas
 * encore été refaits dans le nouveau design. Il traduit les anciens noms vers les jetons Precision Glass
 * (src/theme/tokens.ts) pour que toute l'application soit déjà cohérente.
 * À supprimer quand les derniers écrans auront migré vers `useTheme()`.
 *
 * Doit rester identique à la section « anciens noms » de src/global.css : voir colors.test.ts.
 */
function legacy(name: ThemeName) {
  const c = colorTokens[name];
  return {
    bg: c.bg,
    surface: c.surface,
    line: c.progressTrack,
    ink: c.text,
    muted: c.textMuted,
    sage: c.primary,
    coral: c.danger,
    amber: c.text,
  } as const;
}

export const palette = { light: legacy('light'), dark: legacy('dark') } as const;

export type { ThemeName };
export type ThemeColors = (typeof palette)[ThemeName];

export function useThemeName(): ThemeName {
  return useTheme().name;
}

export function useThemeColors(): ThemeColors {
  return palette[useThemeName()];
}
