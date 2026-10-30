import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { OutlineButton } from '@/components/outline-button';
import { snapshotDay } from '@/domain/balance';
import { formatLongDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';

import { useBalance } from './use-balance';

/** Dans « Plus » : le solde réel saisi d'après la banque, le solde estimé depuis, et le bouton pour le mettre à jour. */
export function BalanceCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const { snapshot, estimatedCents } = useBalance();

  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-xl font-bold text-ink">
        {t('balance.title')}
      </Text>
      <Text className="text-base text-muted">{t('balance.help')}</Text>

      <View className="gap-4 rounded-3xl border border-line bg-surface p-4">
        {snapshot ? (
          <>
            <View className="gap-1">
              <Text className="text-base text-muted">{t('balance.real')}</Text>
              <Text className={`text-3xl font-bold ${snapshot.realBalanceCents < 0 ? 'text-coral' : 'text-ink'}`}>
                {formatMoney(snapshot.realBalanceCents, locale)}
              </Text>
              <Text className="text-base text-muted">
                {t('balance.recordedOn', { date: formatLongDate(snapshotDay(snapshot.recordedAt), locale) })}
              </Text>
            </View>

            {estimatedCents !== null && (
              <View className="gap-1 border-t border-line pt-4">
                <Text className="text-base text-muted">{t('balance.estimated')}</Text>
                <Text className={`text-2xl font-bold ${estimatedCents < 0 ? 'text-coral' : 'text-ink'}`}>
                  {formatMoney(estimatedCents, locale)}
                </Text>
                <Text className="text-base text-muted">{t('balance.estimatedHelp')}</Text>
              </View>
            )}
          </>
        ) : (
          <Text className="text-lg text-ink">{t('balance.none')}</Text>
        )}

        <OutlineButton label={snapshot ? t('balance.update') : t('balance.enter')} onPress={() => router.push('/balance')} />
      </View>
    </View>
  );
}
