import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
import { sheetDragOffset, sheetShouldDismiss } from './sheet-dismiss';
import {
  SHEET_FLOATING_MARGIN,
  SHEET_HANDLE_ZONE,
  computeSheetHeights,
  resolveSheetDrag,
  resolveSheetRelease,
  restingHeight,
  type SheetRelease,
} from './sheet-snap';

/** Marge du panneau détaché quand le clavier est ouvert (design : 10 dp, quatre coins arrondis). */
const FLOATING_MARGIN = SHEET_FLOATING_MARGIN;
const HANDLE_ZONE = SHEET_HANDLE_ZONE;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Contenu. Avec `expandable`, c'est la zone défilante (le pied est donné par `footer`). */
  children: ReactNode;
  /** Nom du panneau pour TalkBack (titre). */
  accessibilityLabel: string;
  /**
   * `false` pendant une action en cours (design : « confirmation de suppression non glissable pendant l'action » est
   * À CONFIRMER, on choisit la prudence) : ni voile, ni glissement, ni bouton Retour ne ferment le panneau.
   */
  dismissible?: boolean;
  /**
   * Appelé une fois, quand le panneau a TERMINÉ son entrée (immobile, en bas). C'est le moment de donner le focus à un
   * champ : le clavier apparaît alors sur un panneau qui ne bouge plus, au lieu d'arriver au milieu de l'animation d'entrée
   * (son moment d'arrivée varie d'un appareil et d'une ouverture à l'autre). Facultatif : sans lui, rien ne change.
   */
  onPresented?: () => void;
  /**
   * Panneau à contenu long (formulaire) : deux états, `compact` et `expanded`. La poignée agrandit (vers le haut), réduit puis ferme
   * (vers le bas). Le contenu défile, le `footer` reste toujours visible, le clavier ne le masque jamais. Sans cette option, le
   * panneau garde sa hauteur naturelle (comportement inchangé de tous les autres panneaux).
   */
  expandable?: boolean;
  /** Pied fixe d'un panneau `expandable` (bouton principal). */
  footer?: ReactNode;
}

/** Part de l'entrée (0 à 1) au-delà de laquelle le panneau est considéré comme posé (reste ~3 dp de course). */
const PRESENTED_THRESHOLD = 0.995;

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
 *  - `expandable` (formulaires longs) : états compact / déployé, voir `sheet-snap.ts`. Depuis le compact, tirer vers le haut
 *    déploie ; depuis le déployé, tirer vers le bas réduit (jamais de fermeture directe) ; depuis le compact, tirer vers le bas
 *    assez loin ferme.
 *
 * Règle de sécurité (cause d'un plantage Android au Lot 6, voir docs/design-deviations.md) : un worklet ne doit JAMAIS appeler
 * une fonction JavaScript ordinaire. Les configurations de ressort sont donc calculées HORS des gestes (`sheetSpring`) et seules
 * des fonctions `'worklet'` ou `scheduleOnRN` sont appelées depuis eux.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  accessibilityLabel,
  dismissible = true,
  onPresented,
  expandable = false,
  footer,
}: BottomSheetProps) {
  const { colors, shadows } = useTheme();
  const glass = useGlassLook('sheet');
  const { spring } = useMotion();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const { mounted, progress } = usePresence(visible, { enter: ['enter', 'sheetIn'], exit: ['exit', 'sheetOut'] });

  // Configuration du ressort de redimensionnement, calculée ICI (thread JS) : les gestes ne reçoivent qu'un objet simple.
  const sheetSpring = useMemo(() => spring('sheetResize'), [spring]);

  const bottomPadding = Math.max(insets.bottom, space.screen);
  const [sheetHeight, setSheetHeight] = useState(screen.height);
  const [contentHeight, setContentHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [mode, setMode] = useState<'compact' | 'expanded'>('compact');
  const keyboardOpen = keyboardHeight > 0;

  const heights = useMemo(
    () =>
      computeSheetHeights({
        windowHeight: screen.height,
        insetTop: insets.top,
        bottomPadding,
        keyboardHeight,
        contentHeight,
        footerHeight,
      }),
    [screen.height, insets.top, bottomPadding, keyboardHeight, contentHeight, footerHeight],
  );
  const measured = contentHeight > 0 && footerHeight > 0;

  const height = useSharedValue(screen.height);
  const drag = useSharedValue(0);
  const floating = useSharedValue(0);
  const keyboard = useSharedValue(0);
  // Panneau extensible : hauteur animée, bornes, hauteur au début du geste.
  const sheetH = useSharedValue(Math.round(screen.height * 0.5));
  const compactH = useSharedValue(0);
  const expandedH = useSharedValue(0);
  const startH = useSharedValue(0);

  useEffect(() => {
    height.value = expandable ? heights.expanded : sheetHeight;
  }, [sheetHeight, height, expandable, heights.expanded]);

  useEffect(() => {
    // Rouvert pendant sa fermeture : l'écart du glissement revient en douceur au lieu de sauter.
    if (visible) drag.value = withSpring(0, sheetSpring);
  }, [visible, drag, sheetSpring]);

  // Chaque ouverture repart de l'état compact (réinitialisé à la FERMETURE : l'animation de sortie garde sa hauteur).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setMode('compact');
  }

  // Hauteur au repos d'un panneau extensible : suit le contenu mesuré, le clavier, l'état choisi. Premier calcul sans animation
  // (le panneau s'ouvre à sa hauteur, sans saut), les suivants en ressort (clavier, changement d'état, contenu qui change).
  const hasPlaced = useRef(false);
  useEffect(() => {
    if (!expandable) return;
    compactH.set(heights.compact);
    expandedH.set(heights.expanded);
    if (!visible) {
      hasPlaced.current = false;
      return;
    }
    if (!measured) return;
    const target = restingHeight(heights, mode, keyboardOpen);
    if (!hasPlaced.current) {
      sheetH.set(target);
      hasPlaced.current = true;
    } else {
      sheetH.set(withSpring(target, sheetSpring));
    }
  }, [expandable, heights, measured, mode, keyboardOpen, visible, compactH, expandedH, sheetH, sheetSpring]);

  // Entrée terminée : prévient l'appelant, une seule fois par ouverture (jamais pendant une fermeture).
  const visibleRef = useRef(visible);
  const onPresentedRef = useRef(onPresented);
  useEffect(() => {
    visibleRef.current = visible;
    onPresentedRef.current = onPresented;
  });
  const notifyPresented = useCallback(() => {
    if (visibleRef.current) onPresentedRef.current?.();
  }, []);
  // Sans tableau de dépendances : sur Android, Reanimated les ignore et le signale (le Worklets capture `notifyPresented`, stable).
  useAnimatedReaction(
    () => progress.value >= PRESENTED_THRESHOLD,
    (reached, previous) => {
      if (reached && !previous) scheduleOnRN(notifyPresented);
    },
  );

  useEffect(() => {
    floating.value = withSpring(keyboardOpen ? 1 : 0, sheetSpring);
    if (keyboardOpen) keyboard.value = keyboardHeight;
  }, [keyboardOpen, keyboardHeight, floating, keyboard, sheetSpring]);

  const applyMode = useCallback((next: SheetRelease) => {
    if (next !== 'dismiss') setMode(next);
  }, []);

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .onStart(() => {
      startH.set(sheetH.get());
    })
    .onUpdate((event) => {
      if (expandable) {
        const next = resolveSheetDrag(startH.get(), event.translationY, compactH.get(), expandedH.get());
        sheetH.set(next.height);
        drag.set(next.offset);
      } else {
        drag.set(sheetDragOffset(event.translationY));
      }
    })
    .onEnd((event) => {
      if (expandable) {
        const outcome = resolveSheetRelease({
          startHeight: startH.get(),
          height: sheetH.get(),
          offset: drag.get(),
          velocityY: event.velocityY,
          compact: compactH.get(),
          expanded: expandedH.get(),
          dismissRatio: motionDistances.sheetDismissRatio,
        });
        if (outcome === 'dismiss') {
          scheduleOnRN(onClose);
        } else {
          const target = outcome === 'expanded' ? expandedH.get() : compactH.get();
          sheetH.set(withSpring(target, { ...sheetSpring, velocity: -event.velocityY }));
          drag.set(withSpring(0, { ...sheetSpring, velocity: event.velocityY }));
          scheduleOnRN(applyMode, outcome);
        }
      } else if (sheetShouldDismiss(drag.get(), event.velocityY, height.get(), motionDistances.sheetDismissRatio)) {
        scheduleOnRN(onClose);
      } else {
        // Relâché trop tôt : le panneau revient avec la vitesse du geste (ressort, sans rebond).
        drag.set(withSpring(0, { ...sheetSpring, velocity: event.velocityY }));
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    marginHorizontal: floating.value * FLOATING_MARGIN,
    bottom: floating.value * (keyboard.value + FLOATING_MARGIN),
    borderBottomLeftRadius: floating.value * radius.sheet,
    borderBottomRightRadius: floating.value * radius.sheet,
    transform: [{ translateY: (1 - progress.value) * (expandable ? sheetH.value : height.value) + Math.max(drag.value, -24) }],
  }));
  const heightStyle = useAnimatedStyle(() => (expandable ? { height: sheetH.value } : {}));
  // Le voile s'éclaircit aussi quand on tire le panneau vers le bas.
  const dragFade = useAnimatedStyle(() => ({
    opacity: interpolate(Math.max(drag.value, 0), [0, expandable ? sheetH.value : height.value], [1, 0.4], 'clamp'),
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
          onLayout={expandable ? undefined : (event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              ...glass.style,
              boxShadow: shadows.sheet,
              paddingBottom: bottomPadding,
            },
            sheetStyle,
            heightStyle,
          ]}>
          <GlassOverlay variant="sheet" radius={radius.sheet - 1} squareBottom />
          <GestureDetector gesture={pan}>
            <View accessible={false} style={{ height: HANDLE_ZONE, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: withAlpha(colors.textMuted, 0.45) }} />
            </View>
          </GestureDetector>
          {expandable ? (
            <>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: space.screen, paddingBottom: 4 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={(_width, contentSize) => setContentHeight(Math.ceil(contentSize))}>
                {children}
              </ScrollView>
              <View
                onLayout={(event) => setFooterHeight(Math.ceil(event.nativeEvent.layout.height))}
                style={{ paddingHorizontal: space.screen, paddingTop: 12 }}>
                {footer}
              </View>
            </>
          ) : (
            <View style={{ paddingHorizontal: space.screen }}>{children}</View>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
