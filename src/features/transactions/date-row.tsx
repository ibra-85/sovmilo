import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { BottomSheet, Button, FormRow, Text } from '@/components/ui';
import { formatLongDate, formatShortDate, parseISODate, shiftISODate, toISODate } from '@/domain/dates';
import { useLocale } from '@/i18n/use-locale';

interface DateRowProps {
  /** `YYYY-MM-DD`. */
  value: string;
  today: string;
  onChange: (value: string) => void;
}

/** Libellé de la ligne : « Aujourd’hui, 31 oct. », « Hier, 30 oct. », sinon la date en toutes lettres. */
function useDateLabel(today: string) {
  const { t } = useTranslation();
  const locale = useLocale();
  const yesterday = shiftISODate(today, -1);
  return (value: string) => {
    if (value === today) return `${t('common.today')}, ${formatShortDate(value, locale)}`;
    if (value === yesterday) return `${t('common.yesterday')}, ${formatShortDate(value, locale)}`;
    const long = formatLongDate(value, locale);
    return long.charAt(0).toLocaleUpperCase(locale) + long.slice(1);
  };
}

/**
 * Ligne « Date » du formulaire (design « FormField ») : touchée, elle ouvre le calendrier du système sur Android, ou un
 * panneau inférieur avec le sélecteur du système sur iOS. Le design ne dessine pas le sélecteur de date (À CONCEVOIR) :
 * on utilise celui du système plutôt que d'en inventer un.
 */
export function DateRow({ value, today, onChange }: DateRowProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const label = useDateLabel(today);
  const [sheetOpen, setSheetOpen] = useState(false);
  const current = parseISODate(value) ?? new Date();

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onValueChange: (_event, date) => onChange(toISODate(date)),
      });
    } else {
      setSheetOpen(true);
    }
  }

  return (
    <>
      <FormRow icon="calendar" label={t('add.date')} value={label(value)} onPress={open} />
      {Platform.OS !== 'android' && (
        <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} accessibilityLabel={t('add.pickDate')}>
          <Text variant="titleSheet" accessibilityRole="header">
            {t('add.pickDate')}
          </Text>
          <View style={{ marginTop: 8, alignItems: 'center' }}>
            <DateTimePicker
              value={current}
              mode="date"
              display="inline"
              locale={locale}
              onValueChange={(_event, date) => onChange(toISODate(date))}
            />
          </View>
          <Button label={t('add.dateDone')} icon="check" onPress={() => setSheetOpen(false)} />
        </BottomSheet>
      )}
    </>
  );
}
