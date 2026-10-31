import { DEFAULT_THEME_PREFERENCE, isThemePreference, parseThemePreference, toColorSchemeOverride } from './preference';

describe('préférence d’apparence', () => {
  it('reconnaît les trois valeurs et rien d’autre', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(1)).toBe(false);
  });

  it('retombe sur « Système » pour une valeur mémorisée illisible', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('???')).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseThemePreference(undefined)).toBe('system');
  });

  it('« Système » laisse Android décider, les autres forcent le thème', () => {
    expect(toColorSchemeOverride('system')).toBe('auto');
    expect(toColorSchemeOverride('light')).toBe('light');
    expect(toColorSchemeOverride('dark')).toBe('dark');
  });
});
