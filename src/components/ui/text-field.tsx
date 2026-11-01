import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { radius } from '@/theme/layout';
import { typography } from '@/theme/typography';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

interface TextFieldProps
  extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'placeholder' | 'maxLength' | 'autoFocus' | 'returnKeyType' | 'onSubmitEditing' | 'autoCapitalize'
  > {
  /** Nom du champ : lu par TalkBack, et affiché au-dessus si `showLabel`. */
  label: string;
  showLabel?: boolean;
  /** Contenu à gauche (carré d'icône du nom de catégorie). */
  leading?: ReactNode;
  /** Message d'erreur : contour d'alerte et texte sous le champ (« Ce nom existe déjà »). */
  error?: string;
  disabled?: boolean;
  /** Pour redonner le focus au champ depuis l'extérieur (retour du sélecteur d'icônes au nom). */
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
}

/**
 * Champ de texte du design : 60 dp, rayon 14, fond `field`. États : repos, focus (contour 1,5 dp et curseur citron
 * / graphite), erreur (contour d'alerte + message), désactivé. Erreur et désactivé ne sont pas dessinés : PROPOSITIONS.
 */
export function TextField({ label, showLabel = false, leading, error, disabled = false, inputRef, ...input }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.fieldFocusBorder : 'transparent';

  return (
    <View style={{ gap: 8 }}>
      {showLabel && <Text variant="label">{label}</Text>}

      <View
        style={{
          minHeight: 60,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 12,
          borderRadius: radius.field,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: colors.field,
          opacity: disabled ? 0.5 : 1,
        }}>
        {leading}
        <TextInput
          {...input}
          ref={inputRef}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          placeholderTextColor={colors.textMuted}
          cursorColor={colors.caret}
          selectionColor={colors.selectedRing}
          style={[typography.fieldValue, { flex: 1, color: colors.text, paddingVertical: 12 }]}
        />
      </View>

      {error ? (
        <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
