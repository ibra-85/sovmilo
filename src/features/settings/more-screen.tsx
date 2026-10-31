import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { tabContentStyle } from '@/components/navigation';
import { AppScreen, Button, Divider, Icon, Pressable, ScreenHeader, Surface, Text } from '@/components/ui';
import { APP_LOCALES } from '@/domain/types';
import { BalanceCard } from '@/features/balance/balance-card';
import { setAppLocale } from '@/i18n';
import { useLocale } from '@/i18n/use-locale';
import { sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

/**
 * Services : solde du compte, épargne et langue. Le design ne dessine pas cet écran (À CONCEVOIR) : il est composé avec
 * les éléments du design system (en-tête sans sélecteur de période, cartes, boutons, lignes à choix unique).
 */
export function MoreScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <AppScreen>
      <ScreenHeader title={t('tabs.more')} />

      <ScrollView
        contentContainerStyle={[{ paddingHorizontal: space.screen, paddingTop: 14, gap: space.section }, tabContentStyle]}
        showsVerticalScrollIndicator={false}>
        <BalanceCard />

        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text variant="titleSection" accessibilityRole="header">
              {t('services.savingsTitle')}
            </Text>
            <Text variant="secondary" tone="muted">
              {t('services.savingsHelp')}
            </Text>
          </View>
          <Button
            label={t('services.savingsAction')}
            variant="secondary"
            icon="savings"
            onPress={() => router.push({ pathname: '/add', params: { type: 'transfer' } })}
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

          <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
            <View accessibilityRole="radiogroup">
              {APP_LOCALES.map((option, index) => {
                const selected = option === locale;
                return (
                  <View key={option}>
                    {index > 0 && <Divider inset={space.gutter} />}
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      pressTranslate={0}
                      onPress={() => void setAppLocale(option)}
                      style={({ pressed }) => ({
                        minHeight: sizes.minTouch + 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: space.gutter,
                        backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                      })}>
                      <Text variant={selected ? 'bodyStrong' : 'body'}>{t(`languages.${option}`)}</Text>
                      {selected && <Icon name="check" size={20} />}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </Surface>
        </View>
      </ScrollView>
    </AppScreen>
  );
}
