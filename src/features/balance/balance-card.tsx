import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AmountText, Button, Divider, Surface, Text } from '@/components/ui';
import { snapshotDay } from '@/domain/balance';
import { formatLongDate } from '@/domain/dates';
import { useLocale } from '@/i18n/use-locale';

import { useBalance } from './use-balance';

/** Dans Services : le solde réel saisi d'après la banque, le solde estimé depuis, et le bouton pour le mettre à jour. */
export function BalanceCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const { snapshot, estimatedCents } = useBalance();

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleSection" accessibilityRole="header">
          {t('balance.title')}
        </Text>
        <Text variant="secondary" tone="muted">
          {t('balance.help')}
        </Text>
      </View>

      <Surface style={{ padding: 16, gap: 16 }}>
        {snapshot ? (
          <>
            <View style={{ gap: 4 }}>
              <Text variant="caption" tone="muted">
                {t('balance.real')}
              </Text>
              <AmountText
                cents={snapshot.realBalanceCents}
                size="summary"
                tone={snapshot.realBalanceCents < 0 ? 'danger' : 'default'}
              />
              <Text variant="caption" tone="muted">
                {t('balance.recordedOn', { date: formatLongDate(snapshotDay(snapshot.recordedAt), locale) })}
              </Text>
            </View>

            {estimatedCents !== null && (
              <>
                <Divider />
                <View style={{ gap: 4 }}>
                  <Text variant="caption" tone="muted">
                    {t('balance.estimated')}
                  </Text>
                  <AmountText cents={estimatedCents} size="total" tone={estimatedCents < 0 ? 'danger' : 'default'} />
                  <Text variant="caption" tone="muted">
                    {t('balance.estimatedHelp')}
                  </Text>
                </View>
              </>
            )}
          </>
        ) : (
          <Text variant="body">{t('balance.none')}</Text>
        )}

        <Button
          label={snapshot ? t('balance.update') : t('balance.enter')}
          variant="secondary"
          icon="note"
          onPress={() => router.push('/balance')}
        />
      </Surface>
    </View>
  );
}
