import { useEffect, useState, type ReactNode } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useMotion } from '@/hooks/use-motion';
import { usePresence } from '@/hooks/use-presence';
import { withAlpha } from '@/theme/color-utils';
import { radius, space } from '@/theme/layout';
import { motionDistances } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { GlassOverlay, useGlassLook } from './glass-surface';
import { Pressable } from './pressable';

/** Marge du panneau détaché quand le clavier est ouvert (design : 10 dp, quatre coins arrondis). */
const FLOATING_MARGIN = 10;
const HANDLE_ZONE = 28;
/** Au-dessus de ce glissement vers le bas (px/s), le panneau se ferme même s'il n'a pas parcouru 30 % de sa hauteur. */
const DISMISS_VELOCITY = 900;
/** Résistance quand on tire vers le haut : le panneau suit à 12 %. */
const UPWARD_RESISTANCE = 0.12;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Nom du panneau pour TalkBack (titre). */
  accessibilityLabel: string;
  /**
   * `false` pendant une action en cours (design : « confirmation de suppression non glissable pendant l'action » est
   * À CONFIRMER, on choisit la prudence) : ni voile, ni glissement, ni bouton Retour ne ferment le panneau.
   */
  dismissible?: boolean;
}

/**
 * Panneau inférieur modal (design « BottomSheet »). Dans une fenêtre `Modal` : il recouvre tout, y compris la
 * navigation flottante, et le bouton Retour d'Android le ferme.
 *
 *  - Entrée par le bas (280 ms), voile en fondu ; sortie plus rapide (220 ms).
 *  - Fermeture : toucher le voile, Retour, ou glisser la poignée vers le bas (> 30 % de la hauteur ou geste rapide).
 *    Vers le haut, une légère résistance. Le glissement est limité à la poignée : le contenu (champs, grilles)
 *    garde ses propres gestes.
 *  - Clavier ouvert : le panneau se détache du bord, remonte au-dessus du clavier avec 10 dp de marge et garde quatre
 *    coins arrondis ; il se recolle quand le clavier se ferme (250 ms).
 *
 * Non implémenté : l'agrandissement animé « le même panneau s'agrandit » à l'ouverture d'un sélecteur (MOTION.md,
 * 250 ms) ; la hauteur change sans transition. À reprendre après un essai sur appareil (risque de conflit avec la
 * remontée du clavier).
 */
export function BottomSheet({ visible, onClose, children, accessibilityLabel, dismissible = true }: BottomSheetProps) {
  const { colors, shadows } = useTheme();
  const glass = useGlassLook('sheet');
  const { timing } = useMotion();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const { mounted, progress } = usePresence(visible, { enter: ['enter', 'sheetIn'], exit: ['exit', 'sheetOut'] });

  const [sheetHeight, setSheetHeight] = useState(screen.height);
  const height = useSharedValue(screen.height);
  const drag = useSharedValue(0);
  const floating = useSharedValue(0);
  const keyboard = useSharedValue(0);

  useEffect(() => {
    height.value = sheetHeight;
  }, [sheetHeight, height]);

  useEffect(() => {
    if (visible) drag.value = 0;
  }, [visible, drag]);

  const keyboardOpen = keyboardHeight > 0;
  useEffect(() => {
    floating.value = withTiming(keyboardOpen ? 1 : 0, timing('standard', 'sheetResize'));
    if (keyboardOpen) keyboard.value = keyboardHeight;
  }, [keyboardOpen, keyboardHeight, floating, keyboard, timing]);

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      drag.set(event.translationY >= 0 ? event.translationY : event.translationY * UPWARD_RESISTANCE);
    })
    .onEnd((event) => {
      const farEnough = drag.get() > height.get() * motionDistances.sheetDismissRatio;
      if (farEnough || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        drag.set(withTiming(0, timing('standard', 'sheetResize')));
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    marginHorizontal: floating.value * FLOATING_MARGIN,
    bottom: floating.value * (keyboard.value + FLOATING_MARGIN),
    borderBottomLeftRadius: floating.value * radius.sheet,
    borderBottomRightRadius: floating.value * radius.sheet,
    transform: [{ translateY: (1 - progress.value) * height.value + Math.max(drag.value, -24) }],
  }));
  // Le voile s'éclaircit aussi quand on tire le panneau vers le bas.
  const dragFade = useAnimatedStyle(() => ({
    opacity: interpolate(Math.max(drag.value, 0), [0, height.value], [1, 0.4], 'clamp'),
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (dismissible) onClose();
      }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrimSheet }, scrimStyle]}>
          <Animated.View style={[{ flex: 1 }, dragFade]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              disabled={!dismissible}
              pressTranslate={0}
              onPress={onClose}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View
          accessibilityLabel={accessibilityLabel}
          accessibilityViewIsModal
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              ...glass.style,
              boxShadow: shadows.sheet,
              paddingBottom: Math.max(insets.bottom, space.screen),
            },
            sheetStyle,
          ]}>
          <GlassOverlay variant="sheet" radius={radius.sheet - 1} squareBottom />
          <GestureDetector gesture={pan}>
            <View accessible={false} style={{ height: HANDLE_ZONE, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: withAlpha(colors.textMuted, 0.45) }} />
            </View>
          </GestureDetector>
          <View style={{ paddingHorizontal: space.screen }}>{children}</View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
