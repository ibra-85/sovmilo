import { useState, type ReactNode } from 'react';
import {
  Pressable as NativePressable,
  type GestureResponderEvent,
  type PressableProps as NativePressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';
import { motionDistances } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(NativePressable);

export interface PressableState {
  pressed: boolean;
  /** Focus clavier / D-pad / TalkBack : doit toujours être visible (anneau de focus). */
  focused: boolean;
}

export interface PressableProps extends Omit<NativePressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle> | ((state: PressableState) => StyleProp<ViewStyle>);
  children?: ReactNode | ((state: PressableState) => ReactNode);
  /** Enfoncement au toucher en dp (design : 1 dp, aucun rebond ni agrandissement). 0 pour le désactiver. */
  pressTranslate?: number;
}

/**
 * Base de toutes les zones tactiles du design system : enfoncement de 1 dp animé sur le thread UI (80 ms à l'appui,
 * 160 ms au relâchement), et état « pressé » / « focus » fourni au style pour changer ombres et teintes.
 * Aucun effet d'ondulation Android : le retour tactile est celui du design.
 */
export function Pressable({
  style,
  children,
  pressTranslate = motionDistances.pressTranslateY,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  disabled,
  ...rest
}: PressableProps) {
  const { timing } = useMotion();
  const press = useSharedValue(0);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const state: PressableState = { pressed, focused };

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * pressTranslate }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(event: GestureResponderEvent) => {
        setPressed(true);
        press.value = withTiming(1, timing('standard', 'press', 'fade'));
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        setPressed(false);
        press.value = withTiming(0, timing('standard', 'release', 'fade'));
        onPressOut?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[typeof style === 'function' ? style(state) : style, animatedStyle]}
      {...rest}>
      {typeof children === 'function' ? children(state) : children}
    </AnimatedPressable>
  );
}
