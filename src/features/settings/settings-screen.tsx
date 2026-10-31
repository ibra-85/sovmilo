import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppScreen, ChoiceGroup, ScreenHeader, Text } from '@/components/ui';
import { APP_LOCALES } from '@/domain/types';
import { setAppLocale } from '@/i18n';
import { useLocale } from '@/i18n/use-locale';
import { THEME_PREFERENCES } from '@/theme/preference';
import { setThemePreference, useThemePreference } from '@/theme/use-theme-preference';
import { space } from '@/theme/layout';

/**
 * Paramètres : Apparence (Système / Clair / Sombre) et Langue (Français / Русский). Les deux choix s'appliquent tout de suite
 * et sont mémorisés ; ils se lisent au démarrage (voir `theme/use-theme-preference.ts` et `i18n`). « Système » suit
 * le réglage d'Android et le thème change donc aussi quand Android bascule en mode sombre.
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const locale = useLocale();
  const themePreference = useThemePreference();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }

  const themeLabels = {
    system: { label: t('settings.themeSystem'), description: t('settings.themeSystemText') },
    light: { label: t('settings.themeLight'), description: undefined },
    dark: { label: t('settings.themeDark'), description: undefined },
  } as const;

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={t('settings.title')} onBack={close} backLabel={t('settings.back')} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 14, paddingBottom: 32, gap: space.section }}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text variant="titleSection" accessibilityRole="header">
              {t('settings.appearanceTitle')}
            </Text>
            <Text variant="secondary" tone="muted">
              {t('settings.appearanceHelp')}
            </Text>
          </View>
          <ChoiceGroup
            accessibilityLabel={t('settings.appearanceTitle')}
            value={themePreference}
            onChange={setThemePreference}
            options={THEME_PREFERENCES.map((value) => ({ value, ...themeLabels[value] }))}
          />
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text variant="titleSection" accessibilityRole="header">
              {t('services.languageTitle')}
            </Text>
            <Text variant="secondary" tone="muted">
              {t('services.languageHelp')}
            </Text>
          </View>
          <ChoiceGroup
            accessibilityLabel={t('services.languageTitle')}
            value={locale}
            onChange={(next) => void setAppLocale(next)}
            options={APP_LOCALES.map((value) => ({ value, label: t(`languages.${value}`) }))}
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}
