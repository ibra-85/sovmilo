import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { BudgetStatus } from '@/domain/budget';
import { formatMoney } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { AmountText } from './amount-text';
import { CategoryIcon } from './category-icon';
import { Icon } from './icon';
import { Pressable } from './pressable';
import { ProgressBar } from './progress-bar';
import { rowMetrics } from './row-metrics';
import { Surface } from './surface';
import { Text } from './text';

interface BudgetRowProps {
  name: string;
  categoryIcon?: string | null;
  spentCents: number;
  limitCents: number;
  /** Reste du plafond ; négatif en cas de dépassement. */
  remainingCents: number;
  /** Part consommée, en pourcentage entier (peut dépasser 100). */
  percent: number;
  status: BudgetStatus;
  onPress?: () => void;
}

/**
 * Ligne de budget (design « BudgetRow »). Trois états :
 *  - normal : « Reste 88 € · 78 % » ;
 *  - presque atteint : icône d'attention et « Presque atteint · reste X » en gras ;
 *  - dépassé : fond et liseré d'alerte, icône d'alerte, « Dépassé de 4 € · 108 % » en couleur d'alerte.
 * L'état n'est jamais porté par la seule couleur : le texte et l'icône changent aussi. La barre reste neutre (rouge
 * seulement au dépassement). Le seuil « presque atteint » vient du domaine (80 %) ; le design propose 75 %, à trancher.
 */
export function BudgetRow({
  name,
  categoryIcon,
  spentCents,
  limitCents,
  remainingCents,
  percent,
  status,
  onPress,
}: BudgetRowProps) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();
  const locale = useLocale();
  const { icon, padding, gap, height } = rowMetrics.budget;
  const over = status === 'over';
  const warning = status === 'warning';

  const statusText = over
    ? t('budgetRow.over', { amount: formatMoney(-remainingCents, locale), percent })
    : warning
      ? t('budgetRow.nearLimit', { amount: formatMoney(remainingCents, locale) })
      : t('budgetRow.remaining', { amount: formatMoney(remainingCents, locale), percent });

  const label = t('budgetRow.a11y', {
    name,
    spent: formatMoney(spentCents, locale),
    limit: formatMoney(limitCents, locale),
    status: statusText,
  });

  const content = (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View
        style={{
          width: icon,
          height: icon,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: over ? colors.surface : colors.surfaceMuted,
        }}>
        <CategoryIcon value={categoryIcon ?? null} size={22} />
      </View>

      <View style={{ flex: 1, gap }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexShrink: 0 }}>
            <AmountText cents={spentCents} size="row" fraction="auto" />
            <Text variant="caption" tone="muted">
              {' / '}
            </Text>
            <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
              {formatMoney(limitCents, locale)}
            </Text>
          </View>
        </View>

        <ProgressBar percent={percent} over={over} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {(over || warning) && (
            <Icon name={over ? 'overBudget' : 'nearLimit'} size={16} color={over ? colors.danger : colors.ink} />
          )}
          <Text
            variant={warning ? 'label' : 'caption'}
            tone={over ? 'danger' : 'muted'}
            style={{ flexShrink: 1 }}
            numberOfLines={2}>
            {statusText}
          </Text>
        </View>
      </View>
    </View>
  );

  const surfaceStyle = { minHeight: height, padding, borderRadius: radius.field, justifyContent: 'center' } as const;

  if (!onPress) {
    return (
      <Surface variant={over ? 'danger' : 'card'} radiusToken="field" accessible accessibilityLabel={label} style={surfaceStyle}>
        {content}
      </Surface>
    );
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} pressTranslate={0} onPress={onPress}>
      {({ pressed }) => (
        <Surface
          variant={over ? 'danger' : 'card'}
          radiusToken="field"
          style={[surfaceStyle, pressed && { backgroundColor: colors.surfaceMuted }, pressed && { boxShadow: shadows.tile }]}>
          {content}
        </Surface>
      )}
    </Pressable>
  );
}
