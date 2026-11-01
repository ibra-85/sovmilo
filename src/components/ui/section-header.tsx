import { View } from 'react-native';

import { sizes, space } from '@/theme/layout';

import { Icon } from './icon';
import { Pressable } from './pressable';
import { Text } from './text';

interface SectionHeaderProps {
  title: string;
  /** « Voir tout » : lien discret à droite, zone tactile de 48 dp. */
  actionLabel?: string;
  onAction?: () => void;
  /** Lu par TalkBack à la place du libellé (« Voir toutes les opérations »). */
  actionAccessibilityLabel?: string;
}

/** Titre de section (« Budgets », « Dernières opérations ») avec, si besoin, son lien « Voir tout ». */
export function SectionHeader({ title, actionLabel, onAction, actionAccessibilityLabel }: SectionHeaderProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.gutter }}>
      <Text variant="titleSection" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          pressTranslate={0}
          onPress={onAction}
          style={{ minHeight: sizes.minTouch, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 8 }}>
          <Text variant="secondaryStrong" tone="muted">
            {actionLabel}
          </Text>
          <Icon name="chevronRight" size={16} />
        </Pressable>
      )}
    </View>
  );
}
