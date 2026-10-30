import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { APP_LOCALES } from '@/domain/types';
import { BalanceCard } from '@/features/balance/balance-card';
import { setAppLocale } from '@/i18n';
import { useLocale } from '@/i18n/use-locale';

/** Onglet « Plus » : solde du compte et choix de la langue ; les autres réglages viendront aux étapes suivantes. */
export function MoreScreen() {
  const { t } = useTranslation();
  const locale = useLocale();

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 px-4 pb-6 pt-4">
        <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
          {t('settings.title')}
        </Text>

        <BalanceCard />

        <View className="gap-2">
          <Text accessibilityRole="header" className="text-xl font-bold text-ink">
            {t('settings.language')}
          </Text>
          <Text className="text-base text-muted">{t('settings.languageHelp')}</Text>

          <View accessibilityRole="radiogroup" className="overflow-hidden rounded-3xl border border-line bg-surface">
            {APP_LOCALES.map((option, index) => {
              const selected = option === locale;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => void setAppLocale(option)}
                  className={`min-h-[64px] flex-row items-center justify-between px-4 active:bg-line ${
                    index > 0 ? 'border-t border-line' : ''
                  }`}>
                  <Text className={`text-xl ${selected ? 'font-bold text-sage' : 'font-medium text-ink'}`}>
                    {t(`languages.${option}`)}
                  </Text>
                  {selected && <Text className="text-2xl font-bold text-sage">✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
