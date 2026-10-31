import { View } from 'react-native';

import { space, sizes } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { Divider } from './divider';
import { Icon } from './icon';
import { Pressable } from './pressable';
import { Surface } from './surface';
import { Text } from './text';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Précision sous le libellé (« Suit le réglage d'Android »). */
  description?: string;
}

interface ChoiceGroupProps<T extends string> {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nom du groupe pour TalkBack (« Apparence »). */
  accessibilityLabel: string;
}

/**
 * Choix unique présenté en lignes (Apparence, Langue) : la ligne choisie est en gras avec une coche, jamais la couleur seule.
 * Chaque ligne fait au moins 56 dp ; le libellé et sa précision passent à la ligne plutôt que d'être coupés.
 */
export function ChoiceGroup<T extends string>({ options, value, onChange, accessibilityLabel }: ChoiceGroupProps<T>) {
  const { colors } = useTheme();

  return (
    <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
      <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <View key={option.value}>
              {index > 0 && <Divider inset={space.gutter} />}
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={option.description ? `${option.label}, ${option.description}` : option.label}
                accessibilityState={{ checked: selected }}
                pressTranslate={0}
                onPress={() => onChange(option.value)}
                style={({ pressed }) => ({
                  minHeight: sizes.minTouch + 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.gutter,
                  paddingHorizontal: space.gutter,
                  paddingVertical: 10,
                  backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                })}>
                <View style={{ flex: 1 }}>
                  <Text variant={selected ? 'bodyStrong' : 'body'}>{option.label}</Text>
                  {option.description ? (
                    <Text variant="caption" tone="muted">
                      {option.description}
                    </Text>
                  ) : null}
                </View>
                {selected && <Icon name="check" size={20} />}
              </Pressable>
            </View>
          );
        })}
      </View>
    </Surface>
  );
}
