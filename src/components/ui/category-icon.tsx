import { Text as NativeText } from 'react-native';

import { parseCategoryIcon } from '@/domain/category-icon';

import { Icon } from './icon';

interface CategoryIconProps {
  /** Valeur stockée en base (`icon:groceries` ou un emoji). Toute valeur illisible donne l'icône de remplacement. */
  value: string | null | undefined;
  size?: number;
  color?: string;
}

/** Icône d'une catégorie : dessin du catalogue ou emoji natif, à la même taille visuelle. */
export function CategoryIcon({ value, size = 24, color }: CategoryIconProps) {
  const icon = parseCategoryIcon(value);

  if (icon.kind === 'icon') return <Icon name={icon.id} size={size} color={color} />;

  return (
    <NativeText
      // Les emojis suivent la police emoji du téléphone (pas Inter) et, comme les icônes, ne grossissent pas avec le texte.
      allowFontScaling={false}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ fontSize: Math.round(size * 0.9), lineHeight: size, width: size, textAlign: 'center' }}>
      {icon.emoji}
    </NativeText>
  );
}
