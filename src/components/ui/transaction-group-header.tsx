import { View } from 'react-native';

import { formatMoney } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';

import { Text } from './text';

interface TransactionGroupHeaderProps {
  /** « Aujourd'hui », « Mercredi » : jour en gras. */
  day: string;
  /** « ven. 31 oct. » : date en gris, après un point médian. */
  date: string;
  /** Total net du jour en centimes (revenus − dépenses), affiché en gris à droite. */
  totalCents: number;
}

/**
 * En-tête d'un groupe de jours (design « TransactionGroup ») : le regroupement se fait par l'espace au-dessus (26 dp,
 * à poser par la liste), sans séparateur. Annoncé comme un titre pour la navigation par titres de TalkBack.
 */
export function TransactionGroupHeader({ day, date, totalCents }: TransactionGroupHeaderProps) {
  const locale = useLocale();
  const total = formatMoney(totalCents, locale, { signed: true });

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${day}, ${date}, ${total}`}
      style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
        <Text variant="label" style={{ fontSize: 14 }}>
          {day}
        </Text>
        <Text variant="caption" tone="muted">{` · ${date}`}</Text>
      </Text>
      <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'], flexShrink: 0 }}>
        {total}
      </Text>
    </View>
  );
}
