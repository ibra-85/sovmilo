import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import { AmountInput, AppScreen, Button, ScreenHeader, SegmentedControl, Text, useToast } from '@/components/ui';
import { formatMoney, keypadValueToCents } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';
import { space } from '@/theme/layout';

import { addAccountSnapshot } from './repository';
import { useBalance } from './use-balance';

type Sign = 'positive' | 'negative';

/** Saisie du solde réel affiché par la banque (négatif possible : découvert). */
export function BalanceScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { estimatedCents } = useBalance();

  const [value, setValue] = useState('');
  const [sign, setSign] = useState<Sign>('positive');
  const [saveFailed, setSaveFailed] = useState(false);

  const cents = keypadValueToCents(value);
  // 0 reste 0 : on ne l'enregistre pas avec un signe moins.
  const signedCents = sign === 'negative' && cents > 0 ? -cents : cents;
  const canSave = value !== '';

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }

  function save() {
    if (!canSave) return;
    try {
      addAccountSnapshot(signedCents);
      close();
      toast.show({ message: t('balance.saved') });
    } catch {
      setSaveFailed(true);
    }
  }

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={t('balance.screenTitle')} onBack={close} backLabel={t('balance.back')} />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 36, paddingBottom: 24, paddingHorizontal: space.screen, gap: 24 }}>
          <AmountInput
            label={t('balance.amountLabel')}
            value={value}
            onChangeValue={(next) => {
              setSaveFailed(false);
              setValue(next);
            }}
            autoFocus
          />

          <SegmentedControl<Sign>
            accessibilityLabel={t('balance.sign')}
            value={sign}
            onChange={setSign}
            options={[
              { value: 'positive', label: t('balance.positive') },
              { value: 'negative', label: t('balance.negative') },
            ]}
          />

          {estimatedCents !== null && (
            <Text variant="secondary" tone="muted" style={{ textAlign: 'center' }}>
              {t('balance.currentEstimate', { amount: formatMoney(estimatedCents, locale) })}
            </Text>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
          {saveFailed ? (
            <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
              {t('balance.saveError')}
            </Text>
          ) : null}
          <Button label={t('common.save')} icon="check" disabled={!canSave} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
