import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Keypad } from '@/components/keypad';
import { OutlineButton } from '@/components/outline-button';
import { Screen } from '@/components/screen';
import { computeCategorySpending } from '@/domain/budget';
import { formatMonthLabel } from '@/domain/dates';
import {
  applyKeypadKey,
  centsToInputString,
  formatKeypadValue,
  formatMoney,
  getCurrencySymbol,
  keypadValueToCents,
  type KeypadKey,
} from '@/domain/money';
import { categoryLabel } from '@/features/categories/category-label';
import { useCategoryMap } from '@/features/categories/use-categories';
import { useMonthTransactions } from '@/features/transactions/use-transactions';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';

import { getCurrentLimit, removeBudget, setBudget } from './repository';

/** Fixer, modifier ou retirer le plafond mensuel d'une catégorie (valable pour ce mois et les suivants). */
export function BudgetEditScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

  const month = useToday().slice(0, 7);
  const category = useCategoryMap().get(categoryId);
  const monthTransactions = useMonthTransactions(month);
  const spentCents = useMemo(() => computeCategorySpending(monthTransactions, month).get(categoryId) ?? 0, [monthTransactions, month, categoryId]);

  // Plafond actuel, lu une seule fois à l'ouverture (lecture directe : un hook renverrait d'abord une liste vide).
  const [currentLimit] = useState(() => getCurrentLimit(categoryId, month));
  const [value, setValue] = useState(currentLimit === null ? '' : centsToInputString(currentLimit, '.'));
  const [saveFailed, setSaveFailed] = useState(false);

  const cents = keypadValueToCents(value);
  const canSave = cents > 0;

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/budget');
  }

  function pressKey(key: KeypadKey) {
    setSaveFailed(false);
    setValue((current) => applyKeypadKey(current, key));
  }

  function save() {
    if (!canSave) return;
    try {
      setBudget(categoryId, month, cents);
      close();
    } catch {
      setSaveFailed(true);
    }
  }

  function confirmRemove() {
    if (currentLimit === null) return;
    Alert.alert(t('budget.removeTitle'), t('budget.removeMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('budget.removeConfirm'),
        style: 'destructive',
        onPress: () => {
          removeBudget(categoryId, month, currentLimit);
          close();
        },
      },
    ]);
  }

  const name = category ? categoryLabel(category, t) : '';
  const amountText = `${formatKeypadValue(value, locale)} ${getCurrencySymbol(locale)}`;

  return (
    <Screen bottomInset>
      <View className="flex-row items-center justify-between pl-4">
        <Text accessibilityRole="header" className="text-xl font-bold text-ink">
          {t('budget.editTitle')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('add.close')}
          onPress={close}
          className="h-14 w-14 items-center justify-center active:opacity-60">
          <Text className="text-2xl text-muted">✕</Text>
        </Pressable>
      </View>

      <View className="gap-1 px-4 pb-3">
        <View className="flex-row items-center justify-center gap-2">
          <Text className="text-3xl">{category?.icon}</Text>
          <Text className="text-xl font-semibold text-ink" numberOfLines={1}>
            {name}
          </Text>
        </View>
        <View accessible accessibilityLabel={`${t('budget.editTitle')} ${amountText}`}>
          <Text numberOfLines={1} adjustsFontSizeToFit className="text-center text-6xl font-bold text-ink">
            {amountText}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-4 pb-4">
        <Keypad onKey={pressKey} />
        <Text className="text-base text-muted">{t('budget.editApplies', { month: formatMonthLabel(month, locale) })}</Text>
        <Text className="text-base text-muted">{t('budget.editSpent', { amount: formatMoney(spentCents, locale) })}</Text>
        {currentLimit !== null && <OutlineButton tone="coral" label={t('budget.remove')} onPress={confirmRemove} />}
      </ScrollView>

      <View className="gap-2 border-t border-line px-4 pb-2 pt-3">
        {saveFailed ? (
          <Text accessibilityLiveRegion="polite" className="text-center text-base font-medium text-coral">
            {t('budget.editSaveError')}
          </Text>
        ) : !canSave ? (
          <Text className="text-center text-base text-muted">{t('budget.editHint')}</Text>
        ) : null}
        <BigButton label={`✓  ${t('common.save')}`} accessibilityLabel={t('common.save')} disabled={!canSave} onPress={save} />
      </View>
    </Screen>
  );
}
