import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { radius, sizes, touchSlop } from '@/theme/layout';
import { typography } from '@/theme/typography';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { Pressable } from './pressable';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Nom du bouton qui efface la saisie. */
  clearLabel: string;
}

/** Barre de recherche (design : surface de contenu, rayon 14, loupe à gauche). Le contour s'affirme au focus. */
export function SearchField({ value, onChangeText, placeholder, clearLabel }: SearchFieldProps) {
  const { colors, shadows } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 16,
        paddingRight: 6,
        borderRadius: radius.field,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: focused ? colors.fieldFocusBorder : colors.surfaceBorder,
        boxShadow: shadows.tile,
      }}>
      <Icon name="search" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        cursorColor={colors.caret}
        selectionColor={colors.selectedRing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[typography.fieldValue, { flex: 1, height: '100%', color: colors.text, paddingVertical: 0 }]}
      />
      {value !== '' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          hitSlop={touchSlop(40, 40)}
          pressTranslate={0}
          onPress={() => onChangeText('')}
          style={{ width: 40, height: sizes.minTouch - 8, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}
