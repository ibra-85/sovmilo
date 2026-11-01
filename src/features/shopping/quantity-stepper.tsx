import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, Pressable, TextField } from '@/components/ui';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

interface QuantityStepperProps {
  /** Nom du champ pour TalkBack (et pour le lecteur d'écran des boutons). */
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Appelé avec +1 ou −1 : l'écran sait calculer le pas de l'unité. */
  onStep: (direction: 1 | -1) => void;
  error?: string;
  /** Appui sur « Suivant » du clavier. */
  onSubmitEditing?: () => void;
}

const BUTTON = 56;

/**
 * Quantité : un bouton « − », la valeur (modifiable au clavier), un bouton « + ». Les boutons font 56 dp : ils servent plus
 * souvent que le clavier (3 pièces, 1,5 kg). Le pas dépend de l'unité (voir `unitStepMilli`).
 */
export function QuantityStepper({ label, value, onChangeText, onStep, error, onSubmitEditing }: QuantityStepperProps) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <StepButton icon="minus" label={t('shopping.quantityLess')} onPress={() => onStep(-1)} />
      <View style={{ flex: 1 }}>
        <TextField
          label={label}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectTextOnFocus
          maxLength={9}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          error={error}
        />
      </View>
      <StepButton icon="createPlus" label={t('shopping.quantityMore')} onPress={() => onStep(1)} />
    </View>
  );
}

function StepButton({ icon, label, onPress }: { icon: 'minus' | 'createPlus'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: BUTTON,
        height: BUTTON,
        marginTop: 2,
        borderRadius: radius.field,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.surfaceMuted : colors.field,
      })}>
      <Icon name={icon} size={22} weight="strong" />
    </Pressable>
  );
}
