import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';

import { Chip } from '@/components/chip';
import { formatLongDate, parseISODate, shiftISODate, toISODate } from '@/domain/dates';
import { useLocale } from '@/i18n/use-locale';

interface DateFieldProps {
  /** `YYYY-MM-DD`. */
  value: string;
  today: string;
  onChange: (value: string) => void;
}

/** Choix de la date : « Aujourd'hui » et « Hier » en un appui, ou le calendrier du système pour une autre date. */
export function DateField({ value, today, onChange }: DateFieldProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const yesterday = shiftISODate(today, -1);
  const current = parseISODate(value) ?? new Date();

  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onValueChange: (_event, date) => onChange(toISODate(date)),
    });
  }

  return (
    <View className="gap-2">
      <View accessibilityRole="radiogroup" className="flex-row gap-2">
        <Chip grow label={t('common.today')} selected={value === today} onPress={() => onChange(today)} />
        {yesterday && (
          <Chip grow label={t('common.yesterday')} selected={value === yesterday} onPress={() => onChange(yesterday)} />
        )}
      </View>

      {Platform.OS === 'android' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('add.pickDate')} : ${formatLongDate(value, locale)}`}
          onPress={openAndroidPicker}
          className="min-h-[56px] flex-row items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 active:opacity-70">
          <Text className="text-2xl">📅</Text>
          <Text className="flex-1 text-lg font-semibold text-ink">{formatLongDate(value, locale)}</Text>
        </Pressable>
      ) : (
        // iOS : le sélecteur du système s'affiche directement dans la page.
        <View className="min-h-[56px] items-start justify-center">
          <DateTimePicker
            value={current}
            mode="date"
            display="compact"
            locale={locale}
            accessibilityLabel={t('add.pickDate')}
            onValueChange={(_event, date) => onChange(toISODate(date))}
          />
        </View>
      )}
    </View>
  );
}
