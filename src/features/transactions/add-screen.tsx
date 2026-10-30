import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Keypad } from '@/components/keypad';
import { Screen } from '@/components/screen';
import { applyKeypadKey, formatKeypadValue, getCurrencySymbol, keypadValueToCents, type KeypadKey } from '@/domain/money';
import type { CategoryKind } from '@/domain/types';
import { CategoryGrid } from '@/features/categories/category-grid';
import { useCategories } from '@/features/categories/use-categories';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';

import { addTransaction } from './repository';

const KINDS: CategoryKind[] = ['expense', 'income'];

/**
 * Saisie d'une opération : montant au pavé numérique → catégorie → ✓.
 * Date du jour et paiement par carte par défaut (modifiables dans une prochaine étape).
 */
export function AddScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const today = useToday();

  const [kind, setKind] = useState<CategoryKind>('expense');
  const [value, setValue] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(false); // évite le double enregistrement si l'on appuie deux fois très vite

  const categories = useCategories(kind);
  const cents = keypadValueToCents(value);
  const canSave = cents > 0 && categoryId !== null;

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function changeKind(next: CategoryKind) {
    if (next === kind) return;
    setKind(next);
    setCategoryId(null); // les catégories de revenus et de dépenses sont différentes
  }

  function pressKey(key: KeypadKey) {
    setSaveFailed(false);
    setValue((current) => applyKeypadKey(current, key));
  }

  function save() {
    if (!canSave || saving.current) return;
    saving.current = true;
    try {
      addTransaction({ type: kind, amountCents: cents, categoryId, occurredOn: today });
      close();
    } catch {
      saving.current = false;
      setSaveFailed(true);
    }
  }

  return (
    <Screen bottomInset>
      <View className="flex-row items-center justify-between pl-4">
        <Text accessibilityRole="header" className="text-xl font-bold text-ink">
          {t('add.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('add.close')}
          onPress={close}
          className="h-14 w-14 items-center justify-center active:opacity-60">
          <Text className="text-2xl text-muted">✕</Text>
        </Pressable>
      </View>

      {/* Zone fixe : type d'opération et montant restent visibles quand on fait défiler les catégories */}
      <View className="gap-3 px-4 pb-3">
        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {KINDS.map((option) => {
            const selected = option === kind;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => changeKind(option)}
                className={`h-14 flex-1 items-center justify-center rounded-2xl border-2 ${
                  selected ? 'border-sage bg-sage-soft' : 'border-line bg-surface'
                }`}>
                <Text className={`text-lg font-semibold ${selected ? 'text-sage' : 'text-muted'}`}>
                  {option === 'expense' ? t('add.typeExpense') : t('add.typeIncome')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View accessible accessibilityLabel={`${t('add.amount')} ${formatKeypadValue(value, locale)} ${getCurrencySymbol(locale)}`}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            className={`text-center text-6xl font-bold ${kind === 'income' ? 'text-sage' : 'text-ink'}`}>
            {formatKeypadValue(value, locale)} {getCurrencySymbol(locale)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-4 pb-4" keyboardShouldPersistTaps="handled">
        <Keypad onKey={pressKey} />

        <View className="gap-2">
          <Text accessibilityRole="header" className="text-xl font-bold text-ink">
            {t('add.category')}
          </Text>
          <CategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
        </View>
      </ScrollView>

      <View className="gap-2 border-t border-line px-4 pb-2 pt-3">
        {saveFailed ? (
          <Text accessibilityLiveRegion="polite" className="text-center text-base font-medium text-coral">
            {t('add.saveError')}
          </Text>
        ) : !canSave ? (
          <Text className="text-center text-base text-muted">{t('add.hint')}</Text>
        ) : null}
        <BigButton
          label={`✓  ${t('add.confirm')}`}
          accessibilityLabel={t('add.confirm')}
          disabled={!canSave}
          onPress={save}
        />
      </View>
    </Screen>
  );
}
