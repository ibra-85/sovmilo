import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useTabContentStyle } from '@/components/navigation';
import { AppScreen, FieldGroup, ScreenHeader, ServiceRow, Text } from '@/components/ui';
import { BalanceCard } from '@/features/balance/balance-card';
import { space } from '@/theme/layout';

/**
 * Services : solde manuel, épargne, catégories, paramètres, et les services à venir. Le design ne dessine pas cet écran
 * (À CONCEVOIR) : il est composé avec les éléments du design system. Un service qui n'existe pas encore (Factures,
 * Statistiques) est une ligne atténuée avec la pastille « Bientôt », NON touchable : aucune fausse interaction.
 * La langue et l'apparence sont dans Paramètres.
 */
export function MoreScreen() {
  const { t } = useTranslation();
  const tabContentStyle = useTabContentStyle();
  const router = useRouter();

  return (
    <AppScreen>
      <ScreenHeader title={t('tabs.more')} />

      <ScrollView
        contentContainerStyle={[{ paddingHorizontal: space.screen, paddingTop: 14, gap: space.section }, tabContentStyle]}
        showsVerticalScrollIndicator={false}>
        <BalanceCard />

        <View style={{ gap: 12 }}>
          <Text variant="titleSection" accessibilityRole="header">
            {t('services.toolsTitle')}
          </Text>
          <FieldGroup>
            <ServiceRow
              icon="savings"
              title={t('services.savingsTitle')}
              text={t('services.savingsHelp')}
              onPress={() => router.push({ pathname: '/add', params: { type: 'transfer' } })}
            />
            <ServiceRow
              icon="tag"
              title={t('services.categoriesTitle')}
              text={t('services.categoriesText')}
              onPress={() => router.push('/categories')}
            />
            <ServiceRow
              icon="cart"
              title={t('services.groceries')}
              text={t('services.groceriesText')}
              onPress={() => router.push('/shopping')}
            />
            <ServiceRow
              icon="settings"
              title={t('services.settingsTitle')}
              text={t('services.settingsText')}
              onPress={() => router.push('/settings')}
            />
          </FieldGroup>
        </View>

        <View style={{ gap: 12 }}>
          <Text variant="titleSection" accessibilityRole="header">
            {t('services.soonTitle')}
          </Text>
          <FieldGroup>
            <ServiceRow icon="bills" title={t('services.bills')} text={t('services.billsText')} soonLabel={t('services.soon')} />
            <ServiceRow icon="budgets" title={t('services.stats')} text={t('services.statsText')} soonLabel={t('services.soon')} />
          </FieldGroup>
        </View>
      </ScrollView>
    </AppScreen>
  );
}
