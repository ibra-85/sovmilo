import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { BottomSheet, Button, FormRow, Text } from '@/components/ui';
import { formatLongDate, formatShortDate, parseISODate, shiftISODate, toISODate } from '@/domain/dates';
import { useLocale } from '@/i18n/use-locale';

interface DateRowProps {
  /** `YYYY-MM-DD`, ou `null` pour une date facultative non renseignée. */
  value: string | null;
  today: string;
  onChange: (value: string) => void;
  /** Légende de la ligne ; « Date » par défaut. */
  label?: string;
  /** Texte de la ligne quand `value` est `null` (« Aucune date »). */
  emptyLabel?: string;
  /** Bornes du sélecteur du système (`YYYY-MM-DD`) : par exemple pas de date future pour un versement déjà fait. */
  minimumDate?: string;
  maximumDate?: string;
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
export function DateRow({ value, today, onChange, label: rowLabel, emptyLabel, minimumDate, maximumDate }: DateRowProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const label = useDateLabel(today);
  const [sheetOpen, setSheetOpen] = useState(false);
  const current = (value === null ? null : parseISODate(value)) ?? parseISODate(today) ?? new Date();
  const minimum = minimumDate === undefined ? undefined : (parseISODate(minimumDate) ?? undefined);
  const maximum = maximumDate === undefined ? undefined : (parseISODate(maximumDate) ?? undefined);

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: minimum,
        maximumDate: maximum,
        onValueChange: (_event, date) => onChange(toISODate(date)),
      });
    } else {
      setSheetOpen(true);
    }
  }

  return (
    <>
      <FormRow
        icon="calendar"
        label={rowLabel ?? t('add.date')}
        value={value === null ? undefined : label(value)}
        placeholder={value === null ? emptyLabel : undefined}
        onPress={open}
      />
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
              minimumDate={minimum}
              maximumDate={maximum}
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
