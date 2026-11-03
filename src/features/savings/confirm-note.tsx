import { View } from 'react-native';

import { Text } from '@/components/ui';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

/** Rappel de l'objectif concerné dans une confirmation, avec la conséquence de l'action. */
export function ConfirmNote({ name, text, failed }: { name: string; text: string; failed: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 12, borderRadius: radius.group, backgroundColor: colors.surfaceMuted, gap: 2 }}>
      <Text variant="body" numberOfLines={3}>
        {name}
      </Text>
      <Text variant="caption" tone={failed ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
        {text}
      </Text>
    </View>
  );
}
