import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { formatKeypadValue, getCurrencySymbol, keypadValueToCents, sanitizeAmountInput, formatMoney } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';
import { typography } from '@/theme/typography';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

interface AmountInputProps {
  /** Légende au-dessus du montant (« Montant de la dépense », « Limite mensuelle »). Lue aussi par TalkBack. */
  label: string;
  /** Saisie canonique : « 12.5 » (point décimal, 2 décimales max), vide = rien saisi. Voir `sanitizeAmountInput`. */
  value: string;
  onChangeValue: (value: string) => void;
  /** Message d'erreur sous le montant (montant nul, trop grand…). */
  error?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * Saisie d'un montant en 60 sp (ajout d'une dépense, limite de budget). Le texte est affiché par nos soins
 * (chiffres tabulaires, séparateurs de la langue, « € » gris) ; un vrai champ de texte invisible posé par-dessus
 * reçoit le clavier numérique du système, donc toucher le montant ouvre le clavier et TalkBack voit un champ éditable.
 *
 * Le curseur est fixe (il ne clignote pas) : le design écarte tout mouvement en boucle.
 */
export function AmountInput({ label, value, onChangeValue, error, autoFocus, disabled = false }: AmountInputProps) {
  const locale = useLocale();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const shown = formatKeypadValue(value, locale);
  const spoken = formatMoney(keypadValueToCents(value), locale);

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Text variant="caption" tone="muted" accessible={false}>
        {label}
      </Text>

      <View style={{ alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 72 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%', paddingHorizontal: 20 }}>
          <Text
            variant="amountInput"
            tone={value === '' ? 'muted' : 'default'}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={{ flexShrink: 1 }}>
            {shown}
          </Text>
          {focused && (
            <View
              style={{
                width: 3,
                height: typography.amountInput.fontSize! * 0.8,
                marginLeft: 2,
                borderRadius: 2,
                backgroundColor: colors.caret,
              }}
            />
          )}
          <Text variant="amountUnit" tone="muted" style={{ fontSize: 34, marginLeft: 8 }}>
            {getCurrencySymbol(locale)}
          </Text>
        </View>

        {/* Champ réel, invisible : il capte le toucher, le clavier et le lecteur d'écran. */}
        <TextInput
          value={value}
          onChangeText={(raw) => onChangeValue(sanitizeAmountInput(raw))}
          keyboardType="decimal-pad"
          editable={!disabled}
          autoFocus={autoFocus}
          caretHidden
          showSoftInputOnFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityValue={{ text: spoken }}
          accessibilityState={{ disabled }}
          style={[StyleSheet.absoluteFill, { opacity: 0, color: 'transparent' }]}
        />
      </View>

      {error ? (
        <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
