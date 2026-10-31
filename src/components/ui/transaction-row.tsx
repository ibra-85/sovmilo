import { View } from 'react-native';

import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { AmountText } from './amount-text';
import { CategoryIcon } from './category-icon';
import { Icon } from './icon';
import { Pressable } from './pressable';
import { rowMetrics } from './row-metrics';
import { Text } from './text';

interface TransactionRowProps {
  /** `income` : pastille teintée et flèche entrante à la place de l'icône de catégorie (design). */
  kind: 'expense' | 'income' | 'transfer';
  /** Icône de la catégorie telle que stockée (`icon:<id>` ou emoji). Absente pour un virement vers l'épargne. */
  categoryIcon?: string | null;
  title: string;
  /** « Courses », « Revenu · virement » : catégorie, éventuellement suivie du moyen de paiement. */
  subtitle: string;
  /** Montant signé en centimes : négatif pour une dépense, positif pour un revenu. */
  cents: number;
  onPress?: () => void;
  /** Phrase complète pour TalkBack (libellé, catégorie, date, montant). */
  accessibilityLabel: string;
  accessibilityHint?: string;
}

/**
 * Ligne d'opération (design « TransactionRow ») : icône ronde de 44 dp, titre sur une ligne (ellipse), sous-titre,
 * montant à droite en chiffres tabulaires. Hauteur de 64 dp, partagée avec `TransactionRowSkeleton`.
 * Pas de glissement latéral : le design n'en dessine pas (la suppression passe par le détail).
 */
export function TransactionRow({
  kind,
  categoryIcon,
  title,
  subtitle,
  cents,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: TransactionRowProps) {
  const { colors, shadows } = useTheme();
  const income = kind === 'income';
  const { icon, paddingVertical, height } = rowMetrics.transaction;

  const content = (
    <>
      <View
        style={{
          width: icon,
          height: icon,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: income ? colors.incomeBg : colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          boxShadow: income ? undefined : shadows.tile,
        }}>
        {income ? (
          <Icon name="arrowIncome" size={20} color={colors.incomeIcon} />
        ) : kind === 'transfer' ? (
          <Icon name="savings" size={22} />
        ) : (
          <CategoryIcon value={categoryIcon ?? null} size={22} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <AmountText cents={cents} size="row" signed />
    </>
  );

  const rowStyle = { minHeight: height, paddingVertical, flexDirection: 'row', alignItems: 'center', gap: 14 } as const;

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={rowStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      pressTranslate={0}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, { backgroundColor: pressed ? colors.surfaceMuted : 'transparent', borderRadius: radius.field }]}>
      {content}
    </Pressable>
  );
}
