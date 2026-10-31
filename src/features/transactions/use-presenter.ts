import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { Transaction } from '@/db/schema';
import { formatShortDate, shiftISODate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { categoryLabel } from '@/features/categories/category-label';
import { useCategoryMap } from '@/features/categories/use-categories';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';

/** Ce qu'une ligne d'opération affiche : tout est déjà traduit et mis en forme. */
export interface TransactionPresentation {
  kind: Transaction['type'];
  categoryIcon: string | null;
  categoryName: string;
  title: string;
  subtitle: string;
  /** Montant signé : négatif pour une dépense ou un virement vers l'épargne, positif pour un revenu. */
  cents: number;
  accessibilityLabel: string;
}

/**
 * Prépare l'affichage d'une opération pour les lignes de liste. Le design montre un libellé (« Supermarché ») que
 * l'application ne saisit pas : on affiche la NOTE si elle existe, sinon le nom de la catégorie (voir
 * docs/design-deviations.md). `context` : « home » ajoute le jour au sous-titre (« Courses · Aujourd'hui »), « list » est
 * celui de la liste Opérations où le jour est déjà dans l'en-tête du groupe.
 */
export function useTransactionPresenter() {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const categoryById = useCategoryMap();

  return useCallback(
    (transaction: Transaction, context: 'home' | 'list'): TransactionPresentation => {
      const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : undefined;
      const categoryName = category ? categoryLabel(category, t) : '';
      const typeName =
        transaction.type === 'income'
          ? t('add.typeIncome')
          : transaction.type === 'transfer'
            ? t('add.typeSavings')
            : t('add.typeExpense');
      const note = transaction.note?.trim() ?? '';
      const payment = t(`paymentMethods.${transaction.paymentMethod}`);

      const title = note || categoryName || typeName;

      let subtitle: string;
      if (context === 'home') {
        const yesterday = shiftISODate(today, -1);
        const day =
          transaction.occurredOn === today
            ? t('common.today')
            : transaction.occurredOn === yesterday
              ? t('common.yesterday')
              : formatShortDate(transaction.occurredOn, locale);
        subtitle = `${categoryName || typeName} · ${day}`;
      } else if (note) {
        subtitle = categoryName || typeName;
      } else if (transaction.type === 'income') {
        subtitle = `${typeName} · ${payment.toLocaleLowerCase(locale)}`;
      } else {
        subtitle = payment;
      }

      const cents = transaction.type === 'income' ? transaction.amountCents : -transaction.amountCents;
      return {
        kind: transaction.type,
        categoryIcon: category?.icon ?? null,
        categoryName,
        title,
        subtitle,
        cents,
        accessibilityLabel: `${title}, ${subtitle}, ${formatMoney(cents, locale, { signed: true })}`,
      };
    },
    [categoryById, t, locale, today],
  );
}
