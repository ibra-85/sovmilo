import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { getDecimalSeparator, type KeypadKey } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['decimal', '0', 'backspace'],
];

interface KeypadProps {
  onKey: (key: KeypadKey) => void;
}

/** Pavé numérique géant : touches de 64 dp (≥ 56 dp exigés), chiffres en 30 sp. */
export function Keypad({ onKey }: KeypadProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  const glyph = (key: KeypadKey) => {
    if (key === 'decimal') return getDecimalSeparator(locale);
    if (key === 'backspace') return '⌫';
    return key;
  };
  const label = (key: KeypadKey) => {
    if (key === 'decimal') return t('keypad.decimal');
    if (key === 'backspace') return t('keypad.backspace');
    return key;
  };

  return (
    <View className="gap-2">
      {ROWS.map((row) => (
        <View key={row[0]} className="flex-row gap-2">
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={label(key)}
              onPress={() => onKey(key)}
              className="h-16 flex-1 items-center justify-center rounded-2xl border border-line bg-surface active:bg-line">
              <Text className="text-3xl font-semibold text-ink">{glyph(key)}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
