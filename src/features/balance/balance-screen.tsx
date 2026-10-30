import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Chip } from '@/components/chip';
import { Keypad } from '@/components/keypad';
import { Screen } from '@/components/screen';
import {
  applyKeypadKey,
  formatKeypadValue,
  formatMoney,
  getCurrencySymbol,
  keypadValueToCents,
  type KeypadKey,
} from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';

import { addAccountSnapshot } from './repository';
import { useBalance } from './use-balance';

/** Saisie du solde réel affiché par la banque (négatif possible). */
export function BalanceScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const { estimatedCents } = useBalance();

  const [value, setValue] = useState('');
  const [negative, setNegative] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const cents = keypadValueToCents(value);
  // 0 reste 0 : on ne l'affiche pas avec un « − ».
  const signedCents = negative && cents > 0 ? -cents : cents;
  const canSave = value !== '';

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }

  function pressKey(key: KeypadKey) {
    setSaveFailed(false);
    setValue((current) => applyKeypadKey(current, key));
  }

  function save() {
    if (!canSave) return;
    try {
      addAccountSnapshot(signedCents);
      close();
    } catch {
      setSaveFailed(true);
    }
  }

  const amountText = `${negative && cents > 0 ? '−' : ''}${formatKeypadValue(value, locale)} ${getCurrencySymbol(locale)}`;

  return (
    <Screen bottomInset>
      <View className="flex-row items-center justify-between pl-4">
        <Text accessibilityRole="header" className="text-xl font-bold text-ink">
          {t('balance.screenTitle')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('add.close')}
          onPress={close}
          className="h-14 w-14 items-center justify-center active:opacity-60">
          <Text className="text-2xl text-muted">✕</Text>
        </Pressable>
      </View>

      <View className="gap-3 px-4 pb-3">
        <Chip role="button" label={t('balance.negative')} selected={negative} onPress={() => setNegative((current) => !current)} />
        <View accessible accessibilityLabel={`${t('balance.screenTitle')} ${amountText}`}>
          <Text numberOfLines={1} adjustsFontSizeToFit className={`text-center text-6xl font-bold ${negative && cents > 0 ? 'text-coral' : 'text-ink'}`}>
            {amountText}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-4">
        <Keypad onKey={pressKey} />
        {estimatedCents !== null && (
          <Text className="text-base text-muted">
            {t('balance.currentEstimate', { amount: formatMoney(estimatedCents, locale) })}
          </Text>
        )}
      </ScrollView>

      <View className="gap-2 border-t border-line px-4 pb-2 pt-3">
        {saveFailed ? (
          <Text accessibilityLiveRegion="polite" className="text-center text-base font-medium text-coral">
            {t('balance.saveError')}
          </Text>
        ) : !canSave ? (
          <Text className="text-center text-base text-muted">{t('balance.hint')}</Text>
        ) : null}
        <BigButton label={`✓  ${t('common.save')}`} accessibilityLabel={t('common.save')} disabled={!canSave} onPress={save} />
      </View>
    </Screen>
  );
}
