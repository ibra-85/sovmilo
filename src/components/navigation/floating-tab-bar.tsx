import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon, Pressable, Text, type IconName } from '@/components/ui';
import { useMotion } from '@/hooks/use-motion';
import { radius, sizes } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import {
  TAB_ICON_SIZE,
  TAB_LABEL_GAP,
  activeTabWidth,
  computeTabLayout,
  shouldUseIconsOnly,
  tabIconLeft,
  tabLabelOpacity,
  type TabGeometry,
} from './tab-layout';

export interface TabBarItem {
  key: string;
  icon: IconName;
  label: string;
}

interface FloatingTabBarProps {
  items: readonly TabBarItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Facteur d'agrandissement du texte système : à partir de 1,3 la barre n'affiche plus que les icônes. */
  fontScale: number;
  accessibilityLabel: string;
}

/** Hauteur intérieure de la barre : 60 − 2 × 1 de bordure − 2 × 7 de marge interne = 44 dp (celle de la pastille). */
const INNER_HEIGHT = sizes.navHeight - 2 - sizes.navPadding * 2;

/**
 * Barre de navigation flottante (design « FloatingTabBar »). L'onglet actif est une pastille surélevée avec icône et
 * libellé ; les autres n'affichent que leur icône. Quand on change d'onglet, la pastille GLISSE et change de largeur
 * (220 ms), le libellé apparaît en fondu, et les autres onglets se redistribuent sans à-coup : toute la géométrie
 * découle d'une seule valeur animée (`position`), calculée par `computeTabLayout` (fonction pure, testée).
 *
 * Largeur de libellé : mesurée par un texte invisible (la langue et la taille du texte changent la largeur).
 * Animations réduites : la pastille saute directement à sa place (durée nulle, voir `useMotion`).
 */
export function FloatingTabBar({ items, activeIndex, onSelect, fontScale, accessibilityLabel }: FloatingTabBarProps) {
  const { colors, shadows } = useTheme();
  const { timing } = useMotion();
  const [innerWidth, setInnerWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<number[]>(() => items.map(() => 0));

  const activeWidths = useMemo(() => labelWidths.map(activeTabWidth), [labelWidths]);
  const iconsOnly = shouldUseIconsOnly(innerWidth, activeWidths, fontScale);
  const ready = innerWidth > 0 && labelWidths.every((width) => width > 0);

  const position = useSharedValue(activeIndex);
  useEffect(() => {
    position.value = withTiming(activeIndex, timing('standard', 'tabSlide'));
  }, [activeIndex, position, timing]);

  const geometry = useDerivedValue(() => computeTabLayout(position.value, innerWidth, activeWidths, iconsOnly));

  const pillStyle = useAnimatedStyle(() => ({
    width: geometry.value.pillWidth,
    transform: [{ translateX: geometry.value.pillLeft }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flex: 1,
        height: sizes.navHeight,
        padding: sizes.navPadding,
        borderRadius: radius.nav,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        backgroundColor: colors.chrome,
        boxShadow: shadows.nav,
      }}>
      <View style={{ flex: 1 }} onLayout={(event) => setInnerWidth(event.nativeEvent.layout.width)}>
        {ready && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                height: INNER_HEIGHT,
                borderRadius: radius.navTab,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                backgroundColor: colors.tabActive,
                boxShadow: shadows.navTab,
              },
              pillStyle,
            ]}
          />
        )}

        {ready &&
          items.map((item, index) => (
            <TabCell
              key={item.key}
              item={item}
              index={index}
              selected={index === activeIndex}
              geometry={geometry}
              labelWidth={labelWidths[index]}
              iconsOnly={iconsOnly}
              onPress={() => onSelect(index)}
            />
          ))}

        {/* Mesure des libellés : invisible, ignoré des lecteurs d'écran, assez large pour ne jamais renvoyer à la ligne. */}
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', left: 0, top: 0, width: 2000, opacity: 0, flexDirection: 'row' }}>
          {items.map((item, index) => (
            <Text
              key={item.key}
              variant="navLabel"
              numberOfLines={1}
              style={{ flexShrink: 0 }}
              onLayout={(event) => {
                const measured = Math.ceil(event.nativeEvent.layout.width) + 1;
                setLabelWidths((current) => (current[index] === measured ? current : current.map((w, i) => (i === index ? measured : w))));
              }}>
              {item.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

interface TabCellProps {
  item: TabBarItem;
  index: number;
  selected: boolean;
  geometry: SharedValue<TabGeometry>;
  labelWidth: number;
  iconsOnly: boolean;
  onPress: () => void;
}

/** Un onglet : zone tactile sur toute la hauteur de la barre (60 dp), icône qui change de teinte, libellé qui apparaît. */
function TabCell({ item, index, selected, geometry, labelWidth, iconsOnly, onPress }: TabCellProps) {
  const { colors } = useTheme();
  const iconTop = (INNER_HEIGHT - TAB_ICON_SIZE) / 2;

  const cellStyle = useAnimatedStyle(() => ({
    width: geometry.value.widths[index],
    transform: [{ translateX: geometry.value.lefts[index] }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: geometry.value.lefts[index] + tabIconLeft(geometry.value.widths[index], geometry.value.weights[index], labelWidth, iconsOnly) },
    ],
  }));
  const inkOpacity = useAnimatedStyle(() => ({ opacity: geometry.value.weights[index] }));
  const mutedOpacity = useAnimatedStyle(() => ({ opacity: 1 - geometry.value.weights[index] }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: iconsOnly ? 0 : tabLabelOpacity(geometry.value.weights[index]),
    transform: [
      {
        translateX:
          geometry.value.lefts[index] +
          tabIconLeft(geometry.value.widths[index], geometry.value.weights[index], labelWidth, iconsOnly) +
          TAB_ICON_SIZE +
          TAB_LABEL_GAP,
      },
    ],
  }));

  return (
    <>
      {/* Icône : deux couches (encre / atténuée) dont l'opacité suit la progression de la pastille. */}
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={[{ position: 'absolute', left: 0, top: iconTop, width: TAB_ICON_SIZE, height: TAB_ICON_SIZE }, iconStyle]}>
        <Animated.View style={[{ position: 'absolute' }, mutedOpacity]}>
          <Icon name={item.icon} size={TAB_ICON_SIZE} color={colors.textMuted} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute' }, inkOpacity]}>
          <Icon name={item.icon} size={TAB_ICON_SIZE} color={colors.ink} weight="strong" />
        </Animated.View>
      </Animated.View>

      {!iconsOnly && (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[{ position: 'absolute', left: 0, top: 0, height: INNER_HEIGHT, width: labelWidth, justifyContent: 'center' }, labelStyle]}>
          <Text variant="navLabel" numberOfLines={1}>
            {item.label}
          </Text>
        </Animated.View>
      )}

      {/* Zone tactile : toute la hauteur de la barre (60 dp), largeur de l'onglet (≥ 44 dp visibles + marge). */}
      <Animated.View
        style={[
          { position: 'absolute', left: 0, top: -(sizes.navPadding + 1), height: sizes.navHeight },
          cellStyle,
        ]}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected }}
          pressTranslate={0}
          onPress={onPress}
          style={{ flex: 1, borderRadius: radius.navTab }}
        />
      </Animated.View>
    </>
  );
}
