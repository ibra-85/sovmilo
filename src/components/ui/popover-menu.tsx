import { Fragment } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { radius, sizes } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { Divider } from './divider';
import { Icon, type IconName } from './icon';
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

export const MENU_PADDING = 6;
const ICON_SIZE = 20;
const ROW_GAP = 12;
const ROW_PADDING = 14;
const ROW_VERTICAL = 14;
/** Décalage vertical d'arrivée d'une ligne (dp) : un très petit glissement dans le sens de l'ouverture. */
const ROW_SLIDE = 4;

interface PopoverMenuProps {
  items: readonly PopoverItem[];
  progress: SharedValue<number>;
  /** Animations réduites : les lignes sont visibles tout de suite (c'est la surface entière qui fond). */
  reduced: boolean;
  side: 'below' | 'above';
  /** Hauteur d'une ligne de texte du libellé, texte agrandi compris (l'icône se centre dessus). */
  lineHeight: number;
  onSelect: (item: PopoverItem) => void;
  /** Hauteur du contenu mesurée (libellés longs sur deux lignes, russe, texte agrandi). */
  onMeasured: (height: number) => void;
}

/**
 * Présentation du menu : lignes avec icône, libellé, coche, filets très discrets. Elle ne connaît ni la géométrie ni le
 * moteur d'animation : elle reçoit seulement `progress` pour faire apparaître chaque ligne (fondu léger + petit glissement,
 * avec un décalage minime d'une ligne à l'autre), et elle se ferme dans l'ordre inverse parce que `progress` redescend.
 */
export function PopoverMenu({ items, progress, reduced, side, lineHeight, onSelect, onMeasured }: PopoverMenuProps) {
  return (
    <ScrollView style={{ flex: 1 }} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
      <View onLayout={(event: LayoutChangeEvent) => onMeasured(Math.ceil(event.nativeEvent.layout.height))}>
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 && <Divider inset={item.icon ? ROW_PADDING + ICON_SIZE + ROW_GAP : ROW_PADDING} />}
            <PopoverRow
              item={item}
              index={index}
              progress={progress}
              reduced={reduced}
              side={side}
              lineHeight={lineHeight}
              onSelect={onSelect}
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
  lineHeight: number;
  onSelect: (item: PopoverItem) => void;
}

function PopoverRow({ item, index, progress, reduced, side, lineHeight, onSelect }: PopoverRowProps) {
  const { colors } = useTheme();
  const [start, end] = rowRange(index);
  const slide = side === 'above' ? ROW_SLIDE : -ROW_SLIDE;

  const animatedStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1 };
    const t = ramp(progress.value, start, end);
    return { opacity: t, transform: [{ translateY: (1 - t) * slide }] };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="menuitem"
        accessibilityLabel={item.accessibilityLabel ?? item.label}
        accessibilityState={{ selected: item.selected }}
        pressTranslate={0}
        onPress={() => onSelect(item)}
        style={({ pressed }) => ({
          minHeight: sizes.contextMenuRow,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: ROW_GAP,
          paddingHorizontal: ROW_PADDING,
          paddingVertical: ROW_VERTICAL,
          borderRadius: radius.menuItem - 2,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}>
        {/* L'icône est centrée sur la PREMIÈRE ligne du libellé : bien alignée même quand le libellé passe sur deux lignes. */}
        {item.icon && (
          <View style={{ height: lineHeight, width: ICON_SIZE, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={item.icon} size={ICON_SIZE} color={item.destructive ? colors.danger : colors.ink} />
          </View>
        )}
        <Text
          variant={item.selected ? 'bodyStrong' : 'body'}
          tone={item.destructive ? 'danger' : 'default'}
          style={{ flex: 1, flexShrink: 1 }}>
          {item.label}
        </Text>
        {item.selected && (
          <View style={{ height: lineHeight, justifyContent: 'center' }}>
            <Icon name="check" size={18} weight="strong" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
