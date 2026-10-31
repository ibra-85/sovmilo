import { Fragment, useCallback, useRef, useState, type ComponentRef } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { usePresence } from '@/hooks/use-presence';
import { radius, sizes, space } from '@/theme/layout';
import { motionDistances } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { Divider } from './divider';
import { Icon, type IconName } from './icon';
import { Pressable } from './pressable';
import { Text } from './text';

export interface DropdownAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DropdownItem {
  key: string;
  icon: IconName;
  label: string;
  /** Action destructive : texte et icône d'alerte, sans fond. */
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Ouverture d'un menu déroulant : `ref` se place sur le déclencheur, `open()` le mesure dans la fenêtre puis affiche
 * le menu juste dessous. Le menu est dans une fenêtre `Modal` : il se superpose à tout, sans rien déplacer.
 */
export function useDropdown() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<DropdownAnchor | null>(null);
  const open = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  }, []);
  const close = useCallback(() => setAnchor(null), []);
  return { ref, anchor, open, close, isOpen: anchor !== null };
}

interface DropdownMenuProps {
  anchor: DropdownAnchor | null;
  onClose: () => void;
  items: readonly DropdownItem[];
  /** Nom du menu pour TalkBack (« Actions sur l'opération »). */
  accessibilityLabel: string;
  width?: number;
}

/**
 * Menu contextuel « ⋯ » (design : 232 dp, rayon 16, padding 6, lignes de 50 dp, ancré sous le bouton, aligné à droite).
 * Apparition depuis le déclencheur (origine en haut à droite, échelle 0,95 → 1, fondu, 150 ms) ; fermeture par un
 * simple fondu de 100 ms. Se ferme en touchant à côté ou avec le bouton Retour d'Android (`onRequestClose`).
 */
export function DropdownMenu({ anchor, onClose, items, accessibilityLabel, width = sizes.contextMenuWidth }: DropdownMenuProps) {
  const { colors, shadows } = useTheme();
  const screen = useWindowDimensions();

  // On garde le dernier emplacement pendant l'animation de fermeture (l'ancre est déjà remise à zéro).
  const [lastAnchor, setLastAnchor] = useState<DropdownAnchor | null>(anchor);
  if (anchor && anchor !== lastAnchor) setLastAnchor(anchor);

  const { mounted, progress } = usePresence(anchor !== null, {
    enter: ['enter', 'dropdownIn'],
    exit: ['exit', 'dropdownOut'],
  });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: motionDistances.dropdownScaleFrom + (1 - motionDistances.dropdownScaleFrom) * progress.value }],
  }));

  if (!mounted || !lastAnchor) return null;

  const left = Math.min(
    Math.max(lastAnchor.x + lastAnchor.width - width, space.screen / 2),
    screen.width - width - space.screen / 2,
  );
  const top = lastAnchor.y + lastAnchor.height + 6;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        pressTranslate={0}
        onPress={onClose}
        style={{ flex: 1 }}
      />
      <Animated.View
        accessibilityRole="menu"
        accessibilityLabel={accessibilityLabel}
        style={[
          {
            position: 'absolute',
            top,
            left,
            width,
            padding: 6,
            borderRadius: radius.contextMenu,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            backgroundColor: colors.chrome,
            boxShadow: shadows.menu,
            transformOrigin: 'right top',
          },
          animatedStyle,
        ]}>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 && <Divider inset={14 + 20 + 12} />}
            <Pressable
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              pressTranslate={0}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => ({
                minHeight: sizes.contextMenuRow,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: radius.menuItem - 2,
                backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
              })}>
              <Icon name={item.icon} size={20} color={item.destructive ? colors.danger : colors.ink} />
              <Text variant="body" tone={item.destructive ? 'danger' : 'default'} style={{ flex: 1 }}>
                {item.label}
              </Text>
            </Pressable>
          </Fragment>
        ))}
      </Animated.View>
    </Modal>
  );
}
