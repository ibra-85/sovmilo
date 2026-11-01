import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AmountText, Icon, Pressable, Text } from '@/components/ui';
import { billStatus, displayAmount } from '@/domain/bills';
import { formatShortDate } from '@/domain/dates';
import { useLocale } from '@/i18n/use-locale';
import { radius, sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { amountText, recurrenceName, statusText } from './format';
import type { BillRow } from './use-bills';

interface BillRowViewProps {
  row: BillRow;
  today: string;
  onOpen: (row: BillRow) => void;
  /** Ouvre le panneau de paiement. Absent pour une échéance déjà payée (le détail permet de la corriger). */
  onPay?: (row: BillRow) => void;
}

/** Zone tactile du bouton « payer » : 56 dp de large, la ligne fait au moins cette hauteur. */
const PAY_ZONE = 56;
const PAY_SIZE = 28;

/**
 * Ligne de facture, compacte : pastille d'icône, nom (deux lignes au plus), date et récurrence, statut ÉCRIT (la couleur ne fait
 * que l'accompagner : un retard a aussi une icône d'alerte et le mot « retard »), montant à droite ou « Montant à renseigner »,
 * puis un bouton rond « payer » toujours au même endroit. Toucher le reste de la ligne ouvre le détail.
 */
function BillRowBase({ row, today, onOpen, onPay }: BillRowViewProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();

  const status = billStatus(row, today);
  const overdue = status === 'overdue';
  const paid = status === 'paid';
  const cents = displayAmount(row);
  const statusLabel = statusText(row, today, locale, t);
  const recurring = row.recurrence !== 'none';
  const caption = recurring
    ? `${formatShortDate(row.dueOn, locale)} · ${recurrenceName(row.recurrence, t)}`
    : formatShortDate(row.dueOn, locale);
  const amountLabel = amountText(cents, paid, locale, t);

  return (
    <View style={{ minHeight: sizes.minTouch + 16, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('bills.rowA11y', { name: row.name, status: `${caption}, ${statusLabel}`, amount: amountLabel })}
        accessibilityHint={t('bills.rowHint')}
        pressTranslate={0}
        onPress={() => onOpen(row)}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          alignSelf: 'stretch',
          paddingVertical: space.listRow,
          paddingLeft: space.gutter,
          paddingRight: onPay ? 4 : space.gutter,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}>
        <View
          style={{
            width: sizes.fieldIcon + 4,
            height: sizes.fieldIcon + 4,
            borderRadius: radius.iconPad,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: overdue ? colors.dangerSoft : paid ? colors.successBg : colors.surfaceMuted,
          }}>
          <Icon name={overdue ? 'overBudget' : paid ? 'check' : 'bills'} size={18} color={overdue ? colors.danger : paid ? colors.successIcon : colors.ink} />
        </View>

        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {row.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {caption}
          </Text>
          <Text variant="captionMedium" tone={overdue ? 'danger' : 'muted'} numberOfLines={2}>
            {statusLabel}
          </Text>
        </View>

        <View style={{ maxWidth: '40%', flexShrink: 0, alignItems: 'flex-end' }}>
          {cents !== null ? (
            <AmountText cents={cents} size="row" tone={paid ? 'muted' : 'default'} align="right" />
          ) : (
            <Text variant="captionMedium" tone="muted" numberOfLines={3} style={{ textAlign: 'right' }}>
              {amountLabel}
            </Text>
          )}
        </View>
      </Pressable>

      {onPay && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('bills.payA11y', { name: row.name })}
          pressTranslate={0}
          onPress={() => onPay(row)}
          style={{ width: PAY_ZONE, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: PAY_SIZE,
              height: PAY_SIZE,
              borderRadius: PAY_SIZE / 2,
              borderWidth: 2,
              borderColor: colors.textMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="check" size={14} color={colors.textMuted} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Les lignes viennent de requêtes en direct : chaque réponse recrée les objets. On compare donc les champs affichés, pas les
 * références, pour qu'un paiement ne refasse le rendu que de la ligne concernée.
 */
export const BillRowView = memo(
  BillRowBase,
  (previous, next) =>
    previous.today === next.today &&
    previous.onOpen === next.onOpen &&
    previous.onPay === next.onPay &&
    previous.row.id === next.row.id &&
    previous.row.name === next.row.name &&
    previous.row.dueOn === next.row.dueOn &&
    previous.row.amountCents === next.row.amountCents &&
    previous.row.paidOn === next.row.paidOn &&
    previous.row.paidAmountCents === next.row.paidAmountCents &&
    previous.row.recurrence === next.row.recurrence,
);
