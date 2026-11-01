import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/use-theme';

interface AppScreenProps {
  children: ReactNode;
  /** Marge pour la barre de gestes en bas : écrans secondaires sans navigation flottante. */
  bottomInset?: boolean;
}

/** Fond d'écran du design (« AppBackground » : uni, sans texture) qui respecte l'encoche et la barre d'état. */
export function AppScreen({ children, bottomInset = false }: AppScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
        paddingBottom: bottomInset ? insets.bottom : 0,
      }}>
      {children}
    </View>
  );
}
