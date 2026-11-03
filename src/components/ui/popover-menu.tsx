import { Fragment, useRef, type ComponentRef } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { radius, sizes } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { Divider } from './divider';
import { Icon, type IconName } from './icon';
import { MENU_METRICS, scrollOffsetToReveal } from './popover-layout';
import { ramp, rowRange } from './popover-motion';
import { Pressable } from './pressable';
import { Text } from './text';

export interface PopoverItem {
  key: string;
  /** Absente : ligne de texte seul (choix d'un mois). */
  icon?: IconName;
  /** Libellé affiché : peut être court (« Supprimer »), le contexte dit déjà de quoi on parle. */
  label: string;
  /** Nom lu par TalkBack, explicite (« Supprimer la catégorie Test »). Par défaut, `label`. */
  accessibilityLabel?: string;
  /** Choix actuel : une coche à droite, annoncé « sélectionné » par TalkBack. */
  selected?: boolean;
  /** Action destructive : texte et icône d'alerte, sans fond. */
  destructive?: boolean;
  /** Exécutée UNE fois, quand le menu a fini de se refermer. */
  onPress: () => void;
}

export const MENU_PADDING = MENU_METRICS.padding;
const MENU_ICON_SIZE = MENU_METRICS.icon;
const MENU_CHECK_SIZE = MENU_METRICS.check;
const MENU_ROW_GAP = MENU_METRICS.gap;
const MENU_ROW_PADDING = MENU_METRICS.rowPadding;
/** Marge verticale d'une ligne : identique en haut et en bas, donc le filet entre deux lignes est au milieu de l'espace qui sépare deux textes. */
const ROW_VERTICAL = 14;
/** Décalage vertical d'arrivée d'une ligne (dp) : un très petit glissement dans le sens de l'ouverture. */
const ROW_SLIDE = 4;

interface PopoverMenuProps {
  items: readonly PopoverItem[];
  progress: SharedValue<number>;
  /** Animations réduites : les lignes sont visibles tout de suite (c'est la surface entière qui fond). */
  reduced: boolean;
  side: 'below' | 'above';
  onSelect: (item: PopoverItem) => void;
  /** Hauteur du contenu mesurée (libellés longs sur deux lignes, russe, texte agrandi). */
  onMeasured: (height: number) => void;
}

/**
 * Présentation du menu : lignes avec icône, libellé, coche, filets très discrets. Elle ne connaît ni la géométrie ni le
 * moteur d'animation : elle reçoit seulement `progress` pour faire apparaître chaque ligne (fondu léger + petit glissement,
 * avec un décalage minime d'une ligne à l'autre), et elle se ferme dans l'ordre inverse parce que `progress` redescend.
 *
 * Quand la liste est plus haute que la surface (liste de mois), elle défile à l'intérieur, et s'ouvre sur le choix actuel
 * (sauf si on a déjà fait défiler).
 */
export function PopoverMenu({ items, progress, reduced, side, onSelect, onMeasured }: PopoverMenuProps) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const metrics = useRef<{ viewport: number; content: number; row: { y: number; height: number } | null }>({
    viewport: 0,
    content: 0,
    row: null,
  });
  const touched = useRef(false);

  // Replace le choix actuel au milieu de la zone visible. Recalculé à chaque mesure tant qu'on n'a pas fait défiler soi-même
  // (la surface peut être ajustée juste après l'ouverture, quand la vraie hauteur du contenu est connue).
  function reveal() {
    const { viewport, content, row } = metrics.current;
    if (touched.current || !row) return;
    const y = scrollOffsetToReveal(row, viewport, content);
    scrollRef.current?.scrollTo({ y, animated: false });
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={() => {
        touched.current = true;
      }}
      onLayout={(event: LayoutChangeEvent) => {
        metrics.current.viewport = event.nativeEvent.layout.height;
        reveal();
      }}>
      <View
        onLayout={(event: LayoutChangeEvent) => {
          const height = Math.ceil(event.nativeEvent.layout.height);
          metrics.current.content = height;
          onMeasured(height);
          reveal();
        }}>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 && <Divider inset={item.icon ? MENU_ROW_PADDING + MENU_ICON_SIZE + MENU_ROW_GAP : MENU_ROW_PADDING} />}
            <PopoverRow
              item={item}
              index={index}
              progress={progress}
              reduced={reduced}
              side={side}
              onSelect={onSelect}
              onLayout={
                item.selected
                  ? (event) => {
                      metrics.current.row = { y: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height };
                      reveal();
                    }
                  : undefined
              }
            />
          </Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

interface PopoverRowProps {
  item: PopoverItem;
  index: number;
  progress: SharedValue<number>;
  reduced: boolean;
  side: 'below' | 'above';
  onSelect: (item: PopoverItem) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

function PopoverRow({ item, index, progress, reduced, side, onSelect, onLayout }: PopoverRowProps) {
  const { colors } = useTheme();
  const [start, end] = rowRange(index);
  const slide = side === 'above' ? ROW_SLIDE : -ROW_SLIDE;

  const animatedStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1 };
    const t = ramp(progress.value, start, end);
    return { opacity: t, transform: [{ translateY: (1 - t) * slide }] };
  });

  return (
    <Animated.View style={animatedStyle} onLayout={onLayout}>
      <Pressable
        accessibilityRole="menuitem"
        accessibilityLabel={item.accessibilityLabel ?? item.label}
        accessibilityState={{ selected: item.selected }}
        pressTranslate={0}
        onPress={() => onSelect(item)}
        style={({ pressed }) => ({
          minHeight: sizes.contextMenuRow,
          flexDirection: 'row',
          // Icône, libellé et coche sont centrés sur la HAUTEUR DE LA LIGNE : une ligne d'un texte comme une ligne de deux
          // textes restent équilibrées, sans vide sous l'icône, et les marges haute et basse sont égales.
          alignItems: 'center',
          gap: MENU_ROW_GAP,
          paddingHorizontal: MENU_ROW_PADDING,
          paddingVertical: ROW_VERTICAL,
          borderRadius: radius.menuItem - 2,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}>
        {item.icon && <Icon name={item.icon} size={MENU_ICON_SIZE} color={item.destructive ? colors.danger : colors.ink} />}
        <Text
          variant={item.selected ? 'bodyStrong' : 'body'}
          tone={item.destructive ? 'danger' : 'default'}
          style={{ flex: 1, flexShrink: 1 }}>
          {item.label}
        </Text>
        {item.selected && <Icon name="check" size={MENU_CHECK_SIZE} weight="strong" />}
      </Pressable>
    </Animated.View>
  );
}
