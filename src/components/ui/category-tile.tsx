import { View } from 'react-native';

import { radius, sizes } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { CategoryIcon } from './category-icon';
import { Icon } from './icon';
import { Pressable } from './pressable';
import { Text } from './text';

interface CategoryTileProps {
  /** Icône stockée (`icon:<id>` ou emoji). Ignorée pour la tuile « Créer ». */
  icon?: string | null;
  label: string;
  selected?: boolean;
  /** Tuile « Créer » : contour pointillé, sans surface, signe + à la place de l'icône. */
  create?: boolean;
  onPress: () => void;
}

/**
 * Tuile de catégorie (design « CategoryTile ») : carré de 58 dp (rayon 17) et libellé dessous, sur 74 dp de large.
 * Sélectionnée : contour de 1,5 dp, halo de 4 dp, pastille avec coche et libellé en gras — la sélection n'est jamais
 * portée par la couleur seule. Libellé sur deux lignes au maximum (mots russes longs).
 */
export function CategoryTile({ icon, label, selected = false, create = false, onPress }: CategoryTileProps) {
  const { colors, shadows } = useTheme();

  const shadow = create
    ? undefined
    : selected
      ? [...shadows.tile, { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: colors.selectedRing }]
      : shadows.tile;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      pressTranslate={0}
      onPress={onPress}
      style={{ width: sizes.categoryTileWidth, alignItems: 'center', gap: 6, paddingVertical: 4 }}>
      <View
        style={{
          width: sizes.categoryTile,
          height: sizes.categoryTile,
          borderRadius: radius.tile,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: create ? 'transparent' : colors.surface,
          borderWidth: create || selected ? 1.5 : 1,
          borderStyle: create ? 'dashed' : 'solid',
          borderColor: create ? colors.dashed : selected ? colors.selectedBorder : colors.surfaceBorder,
          boxShadow: shadow,
        }}>
        {create ? <Icon name="createPlus" size={24} /> : <CategoryIcon value={icon ?? null} size={26} />}
        {selected && (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 20,
              height: 20,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
            }}>
            <Icon name="check" size={12} color={colors.onPrimary} weight="strong" />
          </View>
        )}
      </View>
      <Text variant={selected ? 'label' : 'micro'} tone={selected ? 'default' : 'muted'} numberOfLines={2} style={{ textAlign: 'center', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
