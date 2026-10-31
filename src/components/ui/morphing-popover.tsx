import { Fragment, useCallback, useMemo, useState, type ComponentRef } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePresence } from '@/hooks/use-presence';
import { radius, sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { Divider } from './divider';
import { GlassOverlay, useGlassLook } from './glass-surface';
import { Icon, type IconName } from './icon';
import { Pressable } from './pressable';
import { computePopoverPlacement, estimateMenuHeight, type Rect } from './popover-layout';
import { Text } from './text';

export type PopoverAnchor = Rect;

export interface PopoverItem {
  key: string;
  /** Absente : ligne de texte seul (choix d'un mois). */
  icon?: IconName;
  label: string;
  /** Choix actuel : une coche à droite, annoncé « sélectionné » par TalkBack. */
  selected?: boolean;
  /** Action destructive : texte et icône d'alerte, sans fond. */
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Ouverture d'un popover : `bindTrigger` se place en `ref` sur le déclencheur, `open()` le mesure dans la fenêtre puis
 * affiche le popover. La référence est conservée dans l'état (et non dans `useRef`) : le déclencheur n'est lu qu'à
 * l'ouverture, jamais pendant le rendu.
 */
export function usePopoverTrigger() {
  const [trigger, bindTrigger] = useState<ComponentRef<typeof View> | null>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const open = useCallback(() => {
    trigger?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  }, [trigger]);
  const close = useCallback(() => setAnchor(null), []);
  return { bindTrigger, anchor, open, close, isOpen: anchor !== null };
}

interface MorphingPopoverProps {
  anchor: PopoverAnchor | null;
  onClose: () => void;
  items: readonly PopoverItem[];
  /** Nom du menu pour TalkBack (« Actions sur l'opération »). */
  accessibilityLabel: string;
  width?: number;
  /** Rayon du déclencheur : le popover part de cette forme et prend celle du menu en s'ouvrant. */
  anchorRadius?: number;
}

const PADDING = 6;
const GAP = 6;

/**
 * Popover « qui sort du bouton » (menu « ⋯ », sélecteur de mois). Il remplace l'ancien menu déroulant.
 *
 * Forme : la surface part EXACTEMENT du rectangle du déclencheur (même position, même taille, même rayon) et s'agrandit
 * vers sa place finale, sous le bouton, alignée sur son bord droit. Le bouton n'est jamais recouvert au repos : il reste
 * visible, l'en-tête et le titre aussi. Les lignes apparaissent quand la surface est déjà largement ouverte et disparaissent
 * les premières à la fermeture. Même matière « Precision Glass » que les autres éléments flottants.
 *
 * Placement (voir `popover-layout.ts`, testé) : calculé depuis la position réelle du déclencheur, la fenêtre, les marges
 * système et la hauteur du contenu ; s'il manque de la place dessous, il passe dessus ; si aucun côté ne suffit, il se réduit
 * et ses lignes défilent.
 *
 * Mouvement : ressort sans rebond (voir `theme/motion.ts`), interruptible. Fermeture par un toucher à côté — y compris sur
 * le déclencheur lui-même, ce qui le fait fonctionner comme une bascule — ou par le bouton Retour d'Android.
 * Animations réduites : la surface apparaît directement à sa place, avec un fondu court.
 */
export function MorphingPopover({
  anchor,
  onClose,
  items,
  accessibilityLabel,
  width = sizes.contextMenuWidth,
  anchorRadius = radius.pill,
}: MorphingPopoverProps) {
  const { colors, shadows } = useTheme();
  const glass = useGlassLook('menu');
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // On garde le dernier emplacement pendant l'animation de fermeture (l'ancre est déjà remise à zéro).
  const [lastAnchor, setLastAnchor] = useState<PopoverAnchor | null>(anchor);
  if (anchor && anchor !== lastAnchor) setLastAnchor(anchor);

  const { mounted, progress } = usePresence(anchor !== null, {
    enter: ['standard', 'dropdownIn'],
    exit: ['standard', 'dropdownOut'],
  });

  const contentHeight = estimateMenuHeight(items.length, sizes.contextMenuRow, PADDING);
  const placement = useMemo(
    () =>
      lastAnchor
        ? computePopoverPlacement({
            trigger: lastAnchor,
            contentHeight,
            width,
            window,
            insets,
            margin: space.screen / 2,
            gap: GAP,
          })
        : null,
    [lastAnchor, contentHeight, width, window, insets],
  );

  const surfaceStyle = useAnimatedStyle(() => {
    if (!lastAnchor || !placement) return {};
    const p = progress.value;
    return {
      left: lastAnchor.x + (placement.left - lastAnchor.x) * p,
      top: lastAnchor.y + (placement.top - lastAnchor.y) * p,
      width: lastAnchor.width + (placement.width - lastAnchor.width) * p,
      height: lastAnchor.height + (placement.height - lastAnchor.height) * p,
      borderRadius: anchorRadius + (radius.contextMenu - anchorRadius) * p,
      // La surface apparaît vite : on voit le bouton « se gonfler », pas une carte qui surgit.
      opacity: interpolate(p, [0, 0.25], [0, 1], 'clamp'),
    };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 0.9], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(progress.value, [0.4, 1], [placement?.side === 'above' ? 4 : -4, 0], 'clamp') }],
  }));

  if (!mounted || !lastAnchor || !placement) return null;

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
        accessibilityViewIsModal
        style={[
          {
            position: 'absolute',
            overflow: 'hidden',
            ...glass.style,
            boxShadow: shadows.menu,
          },
          surfaceStyle,
        ]}>
        <GlassOverlay variant="menu" radius={radius.contextMenu - 1} />
        {/* Contenu à sa taille finale : il ne se remet pas en page pendant que la surface grandit. */}
        <Animated.View
          style={[
            { position: 'absolute', left: 0, top: 0, width: placement.width - 2, height: placement.height - 2, padding: PADDING },
            contentStyle,
          ]}>
          <ScrollView style={{ flex: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
            {items.map((item, index) => (
              <Fragment key={item.key}>
                {index > 0 && <Divider inset={item.icon ? 14 + 20 + 12 : 14} />}
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: item.selected }}
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
                  {item.icon && <Icon name={item.icon} size={20} color={item.destructive ? colors.danger : colors.ink} />}
                  <Text
                    variant={item.selected ? 'bodyStrong' : 'body'}
                    tone={item.destructive ? 'danger' : 'default'}
                    style={{ flex: 1 }}>
                    {item.label}
                  </Text>
                  {item.selected && <Icon name="check" size={18} weight="strong" />}
                </Pressable>
              </Fragment>
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
