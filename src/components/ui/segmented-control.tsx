import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';
import { radius, sizes, touchSlop } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { Pressable } from './pressable';
import { Text } from './text';

const PADDING = 4;

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Nom du groupe pour TalkBack (« Type d'opération »). */
  accessibilityLabel: string;
}

/**
 * Filtre exclusif (Tout / Dépenses / Revenus, Icônes / Emojis). Piste `surfaceMuted`, option sélectionnée surélevée.
 * Le relief qui désigne l'option choisie GLISSE d'une option à l'autre (220 ms, courbe standard, interruptible) au lieu
 * de sauter ; en animations réduites, il se déplace sans transition. Aucune couleur vive.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors, shadows } = useTheme();
  const { spring } = useMotion();
  const [width, setWidth] = useState(0);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const optionWidth = options.length > 0 ? Math.max(0, width - PADDING * 2) / options.length : 0;

  const position = useSharedValue(selectedIndex);
  useEffect(() => {
    position.value = withSpring(selectedIndex, spring('tabSlide'));
  }, [selectedIndex, position, spring]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: optionWidth,
    transform: [{ translateX: position.value * optionWidth }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        padding: PADDING,
        borderRadius: radius.field,
        backgroundColor: colors.surfaceMuted,
      }}>
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: PADDING,
              left: PADDING,
              height: sizes.segmentedOption,
              borderRadius: radius.option,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              boxShadow: shadows.tile,
            },
            indicatorStyle,
          ]}
        />
      )}

      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={touchSlop(optionWidth || sizes.minTouch, sizes.segmentedOption)}
            pressTranslate={0}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              height: sizes.segmentedOption,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}>
            <Text
              variant={selected ? 'secondaryStrong' : 'secondary'}
              tone={selected ? 'default' : 'muted'}
              numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
