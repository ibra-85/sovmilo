import { Fragment, useEffect } from 'react';
import { BackHandler, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Divider, Icon, Pressable, Text, type IconName } from '@/components/ui';
import { useMotion } from '@/hooks/use-motion';
import { usePresence } from '@/hooks/use-presence';
import { radius, sizes } from '@/theme/layout';
import { motionDistances } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

export interface ActionMenuItem {
  key: string;
  icon: IconName;
  label: string;
  /** Mise en avant (pastille citron doux) : l'action la plus fréquente, l'ajout d'une dépense. */
  highlighted?: boolean;
  /** Fonction pas encore disponible : la ligne reste visible, grisée, avec cette mention, et ne fait rien. */
  unavailableHint?: string;
  onPress?: () => void;
}

interface ActionMenuProps {
  open: boolean;
  onClose: () => void;
  items: readonly ActionMenuItem[];
  /** Distance entre le bas de l'écran et le bas du panneau. */
  bottom: number;
  /** Marge à droite : celle de l'écran, pour s'aligner sur le bouton +. */
  right: number;
  scrimLabel: string;
  menuLabel: string;
}

/**
 * Voile + menu d'actions rapides (design « ActionMenu »). Superposé : n'entraîne aucun déplacement de la barre.
 *
 * Mouvement : le voile se fond (180 ms) ; le panneau naît du bouton + (origine en bas à droite, échelle 0,92 → 1,
 * translation 8 dp, fondu, 220 ms) ; les lignes apparaissent avec 30 ms de décalage, à l'ouverture seulement.
 * À la fermeture : inverse, 160 ms, sans décalage. Fermeture aussi par le voile et par le bouton Retour d'Android.
 */
export function ActionMenu({ open, onClose, items, bottom, right, scrimLabel, menuLabel }: ActionMenuProps) {
  const { colors, shadows } = useTheme();
  const scrim = usePresence(open, { enter: ['standard', 'scrimIn'], exit: ['standard', 'scrimOut'], kind: 'fade' });
  const panel = usePresence(open, { enter: ['enter', 'menuIn'], exit: ['exit', 'menuOut'] });

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, onClose]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.progress.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panel.progress.value,
    transform: [
      { translateY: (1 - panel.progress.value) * motionDistances.menuTranslateY },
      { scale: motionDistances.menuScaleFrom + (1 - motionDistances.menuScaleFrom) * panel.progress.value },
    ],
  }));

  if (!scrim.mounted && !panel.mounted) return null;

  return (
    <>
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim }, scrimStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scrimLabel}
          pressTranslate={0}
          onPress={onClose}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        accessibilityRole="menu"
        accessibilityLabel={menuLabel}
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            right,
            bottom,
            width: sizes.actionMenuWidth,
            padding: 6,
            borderRadius: radius.menu,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            backgroundColor: colors.chrome,
            boxShadow: shadows.menu,
            transformOrigin: 'right bottom',
          },
          panelStyle,
        ]}>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 && <Divider inset={sizes.fieldIcon + 14 + 8} />}
            <ActionRow item={item} index={index} onClose={onClose} />
          </Fragment>
        ))}
      </Animated.View>
    </>
  );
}

/** Ligne d'action : montée seulement pendant que le panneau est visible, donc son apparition décalée repart de zéro à chaque ouverture. */
function ActionRow({ item, index, onClose }: { item: ActionMenuItem; index: number; onClose: () => void }) {
  const { colors } = useTheme();
  const { timing, delay } = useMotion();
  const unavailable = item.unavailableHint !== undefined;

  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withDelay(delay('menuItemStagger', index), withTiming(1, timing('enter', 'menuItemIn')));
  }, [appear, delay, timing, index]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * motionDistances.menuItemTranslateY }],
  }));

  return (
    <Animated.View style={rowStyle}>
      <Pressable
        accessibilityRole="menuitem"
        accessibilityLabel={unavailable ? `${item.label}, ${item.unavailableHint}` : item.label}
        accessibilityState={{ disabled: unavailable }}
        disabled={unavailable}
        pressTranslate={0}
        onPress={() => {
          onClose();
          item.onPress?.();
        }}
        style={({ pressed }) => ({
          minHeight: sizes.actionMenuRow,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 8,
          paddingVertical: 8,
          borderRadius: radius.menuItem,
          opacity: unavailable ? 0.55 : 1,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}>
        <View
          style={{
            width: sizes.fieldIcon,
            height: sizes.fieldIcon,
            borderRadius: radius.actionPad,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: item.highlighted ? colors.actionHighlightBg : colors.surfaceMuted,
          }}>
          <Icon name={item.icon} size={20} color={item.highlighted ? colors.actionHighlightIcon : colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body">{item.label}</Text>
          {unavailable && (
            <Text variant="caption" tone="muted">
              {item.unavailableHint}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
