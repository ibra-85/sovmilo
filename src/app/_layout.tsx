import '@/global.css';
import '@/i18n'; // initialise la langue avant le premier rendu

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedDefaultCategories } from '@/db/seed';
import { UndoProvider } from '@/features/undo/undo-provider';
import { palette, useThemeName } from '@/theme/colors';

// L'écran de démarrage reste affiché jusqu'à ce que la base soit prête : pas d'écran vide ni de clignotement.
void SplashScreen.preventAutoHideAsync();

/** Applique les migrations SQL puis crée les catégories par défaut au premier lancement. */
function useDatabaseReady() {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error>();

  useEffect(() => {
    if (!success) return;
    try {
      seedDefaultCategories(db);
      setSeeded(true);
    } catch (e) {
      setSeedError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [success]);

  return { ready: success && seeded, error: error ?? seedError };
}

export default function RootLayout() {
  const { t } = useTranslation();
  const themeName = useThemeName();
  const colors = palette[themeName];
  const { ready, error } = useDatabaseReady();

  useEffect(() => {
    if (ready || error) void SplashScreen.hideAsync();
  }, [ready, error]);

  // On reprend le thème de navigation par défaut en y remplaçant les couleurs par celles de Sovmilo.
  const base = themeName === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      primary: colors.sage,
    },
  };

  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-bg p-6">
        <Text className="text-center text-xl font-semibold text-ink">{t('startup.dbError')}</Text>
        <Text className="text-center text-base text-muted">{error.message}</Text>
      </View>
    );
  }
  if (!ready) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <UndoProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="budget-limit/[categoryId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="balance" options={{ presentation: 'modal' }} />
        </Stack>
      </UndoProvider>
    </ThemeProvider>
  );
}
