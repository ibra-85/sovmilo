import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Durée pendant laquelle le bouton « Annuler » reste disponible. */
export const UNDO_DURATION_MS = 6000;

export interface UndoRequest {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

const UndoContext = createContext<(request: UndoRequest) => void>(() => {});

/** Affiche un message de confirmation avec un bouton d'annulation, par-dessus n'importe quel écran. */
export const useUndo = () => useContext(UndoContext);

// Au-dessus de la barre d'onglets (68 dp + zone système) pour ne jamais la recouvrir.
const TAB_BAR_HEIGHT = 68;

export function UndoProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<UndoRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((next: UndoRequest) => {
    clearTimeout(timer.current);
    setRequest(next);
    timer.current = setTimeout(() => setRequest(null), UNDO_DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  function undo() {
    if (!request) return;
    clearTimeout(timer.current);
    setRequest(null);
    request.onAction();
  }

  return (
    <UndoContext.Provider value={show}>
      {children}
      <View
        pointerEvents="box-none"
        className="absolute inset-x-0 px-4"
        style={{ bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }}>
        {request && (
          <Animated.View
            entering={FadeInDown.duration(200)}
            exiting={FadeOutDown.duration(200)}
            accessibilityLiveRegion="polite"
            className="min-h-[64px] flex-row items-center justify-between gap-2 rounded-2xl bg-ink pl-4">
            <Text className="flex-1 text-base font-medium text-bg">{request.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={undo}
              className="h-14 min-w-[96px] items-center justify-center px-4 active:opacity-60">
              <Text className="text-lg font-bold text-sage-soft">{request.actionLabel}</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </UndoContext.Provider>
  );
}
