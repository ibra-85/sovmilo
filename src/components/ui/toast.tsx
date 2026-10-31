import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePresence } from '@/hooks/use-presence';
import { radius, sizes, space, touchSlop } from '@/theme/layout';
import { durations, motionDistances } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { GlassOverlay, useGlassLook } from './glass-surface';
import { Icon } from './icon';
import { Pressable } from './pressable';
import { Text } from './text';

export interface ToastRequest {
  message: string;
  /** Action proposée dans la notification (« Annuler »). */
  actionLabel?: string;
  onAction?: () => void;
  /** Durée d'affichage. Défaut : 3 s (design). Une notification qui porte une action doit durer plus longtemps. */
  durationMs?: number;
}

interface ToastApi {
  show: (request: ToastRequest) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

/** Affiche une notification compacte par-dessus n'importe quel écran. Une nouvelle notification remplace la précédente. */
export const useToast = () => useContext(ToastContext);

/**
 * Fournisseur de notifications (design « Toast ») : pastille centrée au-dessus du bouton principal, coche sur fond
 * de succès, texte sur une ou deux lignes, annonce polie pour TalkBack. Elle apparaît en fondu avec 8 dp de montée
 * (200 ms) et disparaît en 160 ms. Elle ne bloque rien : seule la pastille est touchable.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, shadows } = useTheme();
  const glass = useGlassLook('toast');
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<ToastRequest | null>(null);
  // Dernier contenu affiché, conservé pendant la sortie (la requête est déjà remise à zéro).
  const [shown, setShown] = useState<ToastRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setRequest(null);
  }, []);

  const show = useCallback((next: ToastRequest) => {
    clearTimeout(timer.current);
    setRequest(next);
    setShown(next);
    timer.current = setTimeout(() => setRequest(null), next.durationMs ?? durations.toastVisible);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const { mounted, progress } = usePresence(request !== null, {
    enter: ['enter', 'toastIn'],
    exit: ['exit', 'toastOut'],
    kind: 'fade',
  });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * motionDistances.toastTranslateY }],
  }));

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted && shown && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: space.screen,
            right: space.screen,
            bottom: Math.max(sizes.toastBottom, insets.bottom + 98),
            alignItems: 'center',
          }}>
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[
              {
                maxWidth: '100%',
                minHeight: sizes.minTouch,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingLeft: 10,
                paddingRight: shown.actionLabel ? 4 : 16,
                paddingVertical: 8,
                borderRadius: radius.field,
                ...glass.style,
                boxShadow: shadows.toast,
              },
              animatedStyle,
            ]}>
            <GlassOverlay variant="toast" radius={radius.field - 1} />
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.successBg,
              }}>
              <Icon name="check" size={16} color={colors.successIcon} weight="strong" />
            </View>
            <Text variant="secondary" numberOfLines={2} style={{ flexShrink: 1 }}>
              {shown.message}
            </Text>
            {shown.actionLabel && (
              <Pressable
                accessibilityRole="button"
                hitSlop={touchSlop(sizes.minTouch, sizes.minTouch)}
                pressTranslate={0}
                onPress={() => {
                  dismiss();
                  shown.onAction?.();
                }}
                style={({ pressed }) => ({
                  minHeight: sizes.minTouch,
                  minWidth: sizes.minTouch,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                })}>
                <Text variant="label">{shown.actionLabel}</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}
