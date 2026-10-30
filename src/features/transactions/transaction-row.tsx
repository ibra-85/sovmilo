import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { Category, Transaction } from '@/db/schema';
import { formatShortDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { categoryLabel } from '@/features/categories/category-label';
import { useLocale } from '@/i18n/use-locale';

interface TransactionRowProps {
  transaction: Transaction;
  category: Category | undefined;
}

/** Une ligne de la liste : icône, catégorie, date, montant (− pour une dépense, + pour un revenu). */
export function TransactionRow({ transaction, category }: TransactionRowProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  const isIncome = transaction.type === 'income';
  // Un virement vers l'épargne n'a pas de catégorie.
  const name = category ? categoryLabel(category, t) : t('home.savings');
  const signedCents = isIncome ? transaction.amountCents : -transaction.amountCents;
  const amount = formatMoney(signedCents, locale, { signed: true });
  const date = formatShortDate(transaction.occurredOn, locale);

  return (
    <View
      accessible
      accessibilityLabel={`${name}, ${date}, ${amount}`}
      className="min-h-[64px] flex-row items-center gap-3 px-4 py-2">
      <View
        className="h-11 w-11 items-center justify-center rounded-full bg-line"
        style={category ? { backgroundColor: `${category.color}33` } : undefined}>
        <Text className="text-2xl">{category?.icon ?? '🐷'}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-base text-muted">{date}</Text>
      </View>
      <Text className={`text-lg font-bold ${isIncome ? 'text-sage' : 'text-ink'}`}>{amount}</Text>
    </View>
  );
}
