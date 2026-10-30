import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, useThemeName } from '@/theme/colors';

const tabIcon = (emoji: string) =>
  function TabIcon() {
    return <Text style={{ fontSize: 24 }}>{emoji}</Text>;
  };

/**
 * Barre d'onglets. Étape 1 : Accueil et Plus. Historique et Budget seront ajoutés à l'étape 2,
 * quand ils auront un vrai contenu (pas d'onglet vide).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const colors = palette[useThemeName()];
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.sage,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 16, fontWeight: '600' }, // texte ≥ 16 sp
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 68 + insets.bottom, // zones tactiles ≥ 56 dp
          paddingTop: 6,
          paddingBottom: insets.bottom + 4,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: tabIcon('🏠') }} />
      <Tabs.Screen name="more" options={{ title: t('tabs.more'), tabBarIcon: tabIcon('⚙️') }} />
    </Tabs>
  );
}
