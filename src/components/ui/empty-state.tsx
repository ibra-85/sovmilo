import { View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  text?: string;
  /** Action proposée (« Créer un budget ») : bouton compact. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Liste vide, recherche sans résultat (design « EmptyState » : À CONCEVOIR, rien n'est dessiné). PROPOSITION : une pastille
 * d'icône neutre, un titre, une phrase et au plus une action, centrés sur le fond. Pas d'illustration ni de couleur vive.
 */
export function EmptyState({ icon, title, text, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 12 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
          backgroundColor: colors.surfaceMuted,
        }}>
        <Icon name={icon} size={24} color={colors.textMuted} />
      </View>
      <Text variant="titleSheet" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {text ? (
        <Text variant="secondary" tone="muted" style={{ textAlign: 'center' }}>
          {text}
        </Text>
      ) : null}
      {actionLabel && onAction && (
        <View style={{ marginTop: 10 }}>
          <Button label={actionLabel} icon="createPlus" variant="secondary" size="compact" onPress={onAction} />
        </View>
      )}
    </View>
  );
}
