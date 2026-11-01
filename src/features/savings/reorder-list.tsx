import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, Pressable, Text } from '@/components/ui';
import { dragTargetIndex, shiftSlots, slotsToOrder } from '@/domain/savings';
import { useMotion } from '@/hooks/use-motion';
import { radius, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { GoalIcon } from './goal-row';
import type { GoalRow } from './use-savings';

interface ReorderListProps {
  /** Objectifs dans l'ordre actuel. Photographiés à l'entrée dans le mode : la liste ne se resynchronise pas pendant le glissement. */
  goals: readonly GoalRow[];
  /** Appelée UNE fois par déplacement terminé (au relâchement ou après un toucher de flèche), jamais pendant le glissement. */
  onCommit: (orderedIds: string[]) => void;
}

/** Appui long sur la poignée avant que le glissement ne démarre : un défilement qui l'effleure ne déplace rien. */
const LONG_PRESS_MS = 220;
const ROW_BASE_HEIGHT = 72;
const HANDLE_ZONE = 52;
const ARROW_ZONE = 48;

/**
 * Liste réorganisable (mode « Réorganiser » d'Épargne). Les lignes ont toutes la même hauteur et sont posées par leur place
 * (`positions`, une valeur partagée) : pendant le glissement, seules des valeurs animées changent, sans rendu React ni accès à la
 * base ; les voisines se décalent d'une place avec le mouvement standard. L'ordre n'est enregistré qu'au relâchement.
 *
 * Alternative sans glissement (accessibilité, grandes listes) : une flèche « monter » et une flèche « descendre » par ligne,
 * annoncées avec le nom et la nouvelle position. Le glissement ne démarre que depuis la poignée et après un appui long.
 */
export function ReorderList({ goals, onCommit }: ReorderListProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const { colors } = useTheme();
  const rowHeight = Math.round(ROW_BASE_HEIGHT * Math.min(Math.max(window.fontScale, 1), 1.6));

  const [items] = useState(() => goals.map((goal) => ({ id: goal.id, name: goal.name, icon: goal.icon })));
  const positions = useSharedValue<number[]>(items.map((_, index) => index));

  const commit = useCallback(
    (slots: number[]) => {
      onCommit(slotsToOrder(items.map((item) => item.id), slots));
    },
    [items, onCommit],
  );

  const moveBy = useCallback(
    (index: number, delta: -1 | 1) => {
      const slots = positions.get();
      const target = slots[index] + delta;
      if (target < 0 || target >= slots.length) return;
      const next = shiftSlots(slots, index, target);
      positions.set(next);
      commit(next);
      AccessibilityInfo.announceForAccessibility(t('savings.reorder.position', { name: items[index].name, position: target + 1, total: items.length }));
    },
    [positions, commit, items, t],
  );

  return (
    <GestureHandlerRootView>
      <View
        style={{
          height: rowHeight * items.length,
          borderRadius: radius.group,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
        }}>
        {items.map((item, index) => (
          <ReorderRow
            key={item.id}
            name={item.name}
            icon={item.icon}
            index={index}
            count={items.length}
            rowHeight={rowHeight}
            positions={positions}
            onMove={moveBy}
            onDrop={commit}
          />
        ))}
      </View>
    </GestureHandlerRootView>
  );
}

interface ReorderRowProps {
  name: string;
  icon: string;
  index: number;
  count: number;
  rowHeight: number;
  positions: SharedValue<number[]>;
  onMove: (index: number, delta: -1 | 1) => void;
  onDrop: (slots: number[]) => void;
}

function ReorderRow({ name, icon, index, count, rowHeight, positions, onMove, onDrop }: ReorderRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { timing } = useMotion();
  const shiftTiming = timing('standard', 'menuItemIn');
  const dragging = useSharedValue(false);
  const dragY = useSharedValue(0);
  const startSlot = useSharedValue(0);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      startSlot.set(positions.get()[index]);
      dragY.set(0);
      dragging.set(true);
    })
    .onUpdate((event) => {
      dragY.set(event.translationY);
      const target = dragTargetIndex(startSlot.get(), event.translationY, rowHeight, count);
      const slots = positions.get();
      if (slots[index] !== target) positions.set(shiftSlots(slots, index, target));
    })
    .onEnd(() => {
      const slots = positions.get();
      if (slots[index] !== startSlot.get()) scheduleOnRN(onDrop, slots);
    })
    .onFinalize((_event, success) => {
      // Geste interrompu (le système reprend la main) : la liste revient à sa place de départ, rien n'est enregistré.
      if (!success) positions.set(shiftSlots(positions.get(), index, startSlot.get()));
      dragging.set(false);
      dragY.set(0);
    });

  const style = useAnimatedStyle(() => {
    if (dragging.get()) {
      return {
        zIndex: 20,
        elevation: 6,
        opacity: 0.96,
        transform: [{ translateY: startSlot.get() * rowHeight + dragY.get() }, { scale: 1.02 }],
      };
    }
    return {
      zIndex: 0,
      elevation: 0,
      opacity: 1,
      transform: [{ translateY: withTiming(positions.get()[index] * rowHeight, shiftTiming) }, { scale: 1 }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: rowHeight,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 4,
          paddingRight: 4,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
        },
        style,
      ]}>
      <GestureDetector gesture={pan}>
        {/* Poignée : le seul endroit qui démarre un glissement. Masquée à TalkBack, qui a les flèches. */}
        <View
          importantForAccessibility="no-hide-descendants"
          style={{ width: HANDLE_ZONE, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="grip" size={22} color={colors.textMuted} />
        </View>
      </GestureDetector>

      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.iconPad,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceMuted,
          marginRight: space.gutter - 4,
        }}>
        <GoalIcon icon={icon} size={20} />
      </View>

      <Text variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
        {name}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('savings.reorder.moveUp', { name })}
        pressTranslate={0}
        onPress={() => onMove(index, -1)}
        style={{ width: ARROW_ZONE, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chevronUp" size={20} color={colors.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('savings.reorder.moveDown', { name })}
        pressTranslate={0}
        onPress={() => onMove(index, 1)}
        style={{ width: ARROW_ZONE, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chevronDown" size={20} color={colors.ink} />
      </Pressable>
    </Animated.View>
  );
}
