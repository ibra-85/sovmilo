import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { FloatingNavigation } from '@/components/navigation';
import { useTheme } from '@/theme/use-theme';

/**
 * Écrans d'onglets : Accueil, Opérations, Budgets, Services.
 *
 * La barre d'onglets native est désactivée (`tabBar` renvoie rien) : la navigation flottante du design est dessinée
 * par-dessus les écrans, pour que le voile du menu + recouvre le contenu. Les routes (`index`, `history`, `budget`,
 * `more`) gardent leur nom ; seuls les libellés ont changé (voir docs/design-deviations.md).
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="budget" />
        <Tabs.Screen name="more" />
      </Tabs>
      <FloatingNavigation />
    </View>
  );
}
