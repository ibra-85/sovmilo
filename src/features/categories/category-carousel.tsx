import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CategoryTile } from '@/components/ui';
import type { Category } from '@/db/schema';
import { space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { categoryLabel } from './category-label';

interface CategoryCarouselProps {
  categories: readonly Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Tuile « Créer » : toujours en tête. */
  onCreate: () => void;
}

const FADE_WIDTH = 44;

/**
 * Carrousel de catégories (design « CategoryCarousel ») : défilement horizontal, « Créer » en premier, marges de 14 dp pour
 * que les tuiles touchent visuellement le bord de l'écran, et fondu à droite comme indice de défilement. Une catégorie
 * qu'on vient de créer arrive juste après « Créer » (sa position vient de la base, voir `createCategory`).
 * À poser en pleine largeur, hors des marges de 20 dp de l'écran.
 */
export function CategoryCarousel({ categories, selectedId, onSelect, onCreate }: CategoryCarouselProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('add.category')}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.carouselEdge, gap: space.carouselGap, paddingRight: FADE_WIDTH }}>
        <CategoryTile create label={t('category.create')} onPress={onCreate} />
        {categories.map((category) => (
          <CategoryTile
            key={category.id}
            icon={category.icon}
            label={categoryLabel(category, t)}
            selected={category.id === selectedId}
            onPress={() => onSelect(category.id)}
          />
        ))}
      </ScrollView>

      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: FADE_WIDTH }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="carousel-fade" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.bg} stopOpacity={0.96} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#carousel-fade)" />
        </Svg>
      </View>
    </View>
  );
}
