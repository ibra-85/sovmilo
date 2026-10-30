import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps {
  children: ReactNode;
  /** Marge en bas pour les écrans sans barre d'onglets (ex. l'écran Ajouter). */
  bottomInset?: boolean;
}

/** Fond crème plein écran qui respecte l'encoche et la barre d'état (Android dessine désormais sous les barres système). */
export function Screen({ children, bottomInset = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 bg-bg"
      style={{ paddingTop: insets.top, paddingBottom: bottomInset ? insets.bottom : 0 }}>
      {children}
    </View>
  );
}
