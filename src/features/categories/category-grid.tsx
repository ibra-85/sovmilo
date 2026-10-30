import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { Category } from '@/db/schema';

import { categoryLabel } from './category-label';

interface CategoryGridProps {
  categories: readonly Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Grille de grosses icônes (3 par ligne, tuiles de 112 dp de haut : même taille même si le nom tient sur 2 lignes). */
export function CategoryGrid({ categories, selectedId, onSelect }: CategoryGridProps) {
  const { t } = useTranslation();

  return (
    <View className="-m-1 flex-row flex-wrap">
      {categories.map((category) => {
        const selected = category.id === selectedId;
        const label = categoryLabel(category, t);
        return (
          <Pressable
            key={category.id}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onSelect(category.id)}
            className="w-1/3 p-1">
            <View
              className={`h-[112px] items-center justify-center gap-1 rounded-2xl border-2 p-2 ${
                selected ? 'border-sage bg-sage-soft' : 'border-line bg-surface'
              }`}>
              {/* Pastille teintée de la couleur de la catégorie (20 % d'opacité : lisible en clair comme en sombre) */}
              <View
                className="h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${category.color}33` }}>
                <Text className="text-3xl">{category.icon}</Text>
              </View>
              <Text className="text-center text-base font-medium text-ink" numberOfLines={2}>
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
