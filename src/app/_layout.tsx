import '@/global.css';
import '@/i18n'; // initialise la langue avant le premier rendu

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ToastProvider } from '@/components/ui';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedDefaultCategories } from '@/db/seed';
import { fontAssets } from '@/theme/fonts';
import { useTheme } from '@/theme/use-theme';

// L'écran de démarrage reste affiché jusqu'à ce que la base et la police soient prêtes : pas d'écran vide ni de clignotement.
void SplashScreen.preventAutoHideAsync();

/** Crée les catégories par défaut au premier lancement ; renvoie l'erreur éventuelle plutôt que de la lever. */
function seedOnce(): Error | null {
  try {
    seedDefaultCategories(db);
    return null;
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

function StartupError({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-bg p-6">
      <Text className="text-center text-xl font-semibold text-ink">{t('startup.dbError')}</Text>
      <Text className="text-center text-base text-muted">{message}</Text>
    </View>
  );
}

/**
 * Applique les migrations SQL, puis monte l'application. L'initialisation des catégories se fait dans `AppShell`,
 * monté seulement une fois les migrations terminées (une base sans tables ne peut pas être initialisée).
 */
export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (error) void SplashScreen.hideAsync();
  }, [error]);

  if (error) return <StartupError message={error.message} />;
  if (!success) return null;
  return <AppShell />;
}

function AppShell() {
  const { colors, isDark } = useTheme();
  // Idempotent : exécuté une seule fois au montage (valeur initiale de l'état), sans effet ni rendu supplémentaire.
  const [seedError] = useState(seedOnce);
  // Inter est embarquée dans l'application (aucun téléchargement). Si le chargement échoue, on continue avec la
  // police du système plutôt que de bloquer l'application : le texte reste lisible, seule la finesse du design change.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready || seedError) void SplashScreen.hideAsync();
  }, [ready, seedError]);

  if (seedError) return <StartupError message={seedError.message} />;
  if (!ready) return null;

  // On reprend le thème de navigation par défaut en y remplaçant les couleurs par celles de Sovmilo.
  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.chrome,
      text: colors.text,
      border: colors.hairline,
      primary: colors.primary,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <ToastProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="budget-limit/[categoryId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="balance" options={{ presentation: 'modal' }} />
        </Stack>
      </ToastProvider>
    </ThemeProvider>
  );
}
