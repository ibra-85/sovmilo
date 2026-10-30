import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { Chip } from '@/components/chip';
import { Keypad } from '@/components/keypad';
import { OutlineButton } from '@/components/outline-button';
import { Screen } from '@/components/screen';
import {
  applyKeypadKey,
  centsToInputString,
  formatKeypadValue,
  getCurrencySymbol,
  keypadValueToCents,
  type KeypadKey,
} from '@/domain/money';
import { PAYMENT_METHODS, type CategoryKind, type PaymentMethod, type TransactionType } from '@/domain/types';
import { CategoryGrid } from '@/features/categories/category-grid';
import { useCategories } from '@/features/categories/use-categories';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { useThemeColors } from '@/theme/colors';

import { DateField } from './date-field';

export interface TransactionFormValues {
  type: TransactionType;
  amountCents: number;
  categoryId: string | null;
  occurredOn: string;
  paymentMethod: PaymentMethod;
  note: string;
}

interface TransactionFormProps {
  title: string;
  /** Valeurs d'une opération existante (modification). Sans elles : nouvelle opération, détails repliés. */
  initial?: TransactionFormValues;
  /** Type présélectionné pour une nouvelle opération. */
  initialType?: TransactionType;
  /** Enregistre. Peut lever une erreur : le formulaire reste alors ouvert et affiche un message. */
  onSubmit: (values: TransactionFormValues) => void;
  onClose: () => void;
  /** Si fourni, un bouton « Supprimer » apparaît en bas du formulaire. */
  onDelete?: () => void;
}

const TYPES: TransactionType[] = ['expense', 'income', 'transfer'];

/**
 * Formulaire commun à l'ajout et à la modification d'une opération.
 * Parcours rapide : montant au pavé → catégorie → ✓. La date (aujourd'hui), le paiement (carte) et la note
 * ont des valeurs par défaut et se règlent dans « Date, paiement, note », replié à l'ajout et ouvert à la modification.
 */
export function TransactionForm({ title, initial, initialType = 'expense', onSubmit, onClose, onDelete }: TransactionFormProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const colors = useThemeColors();
  const today = useToday();

  const [type, setType] = useState<TransactionType>(initial?.type ?? initialType);
  const [value, setValue] = useState(initial ? centsToInputString(initial.amountCents, '.') : '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? today);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initial?.paymentMethod ?? 'card');
  const [note, setNote] = useState(initial?.note ?? '');
  const [detailsOpen, setDetailsOpen] = useState(initial !== undefined);
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(false); // évite le double enregistrement si l'on appuie deux fois très vite

  const categoryKind: CategoryKind = type === 'income' ? 'income' : 'expense';
  const categories = useCategories(categoryKind);
  const cents = keypadValueToCents(value);
  const isSavings = type === 'transfer';
  const canSave = cents > 0 && (isSavings || categoryId !== null);

  function changeType(next: TransactionType) {
    if (next === type) return;
    setType(next);
    setCategoryId(null); // les catégories de revenus et de dépenses sont différentes, et l'épargne n'en a pas
  }

  function pressKey(key: KeypadKey) {
    setSaveFailed(false);
    setValue((current) => applyKeypadKey(current, key));
  }

  function save() {
    if (!canSave || saving.current) return;
    saving.current = true;
    try {
      onSubmit({
        type,
        amountCents: cents,
        categoryId: isSavings ? null : categoryId,
        occurredOn,
        paymentMethod: isSavings ? 'transfer' : paymentMethod,
        note,
      });
    } catch {
      saving.current = false;
      setSaveFailed(true);
    }
  }

  const typeLabel = (option: TransactionType) =>
    option === 'expense' ? t('add.typeExpense') : option === 'income' ? t('add.typeIncome') : t('add.typeSavings');

  return (
    <Screen bottomInset>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-row items-center justify-between pl-4">
          <Text accessibilityRole="header" className="text-xl font-bold text-ink">
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('add.close')}
            onPress={onClose}
            className="h-14 w-14 items-center justify-center active:opacity-60">
            <Text className="text-2xl text-muted">✕</Text>
          </Pressable>
        </View>

        {/* Zone fixe : type d'opération et montant restent visibles quand on fait défiler la suite */}
        <View className="gap-3 px-4 pb-3">
          <View accessibilityRole="radiogroup" className="flex-row gap-2">
            {TYPES.map((option) => (
              <Chip grow key={option} label={typeLabel(option)} selected={option === type} onPress={() => changeType(option)} />
            ))}
          </View>

          <View accessible accessibilityLabel={`${t('add.amount')} ${formatKeypadValue(value, locale)} ${getCurrencySymbol(locale)}`}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className={`text-center text-6xl font-bold ${type === 'income' ? 'text-sage' : 'text-ink'}`}>
              {formatKeypadValue(value, locale)} {getCurrencySymbol(locale)}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerClassName="gap-5 px-4 pb-4" keyboardShouldPersistTaps="handled">
          <Keypad onKey={pressKey} />

          {!isSavings && (
            <View className="gap-2">
              <Text accessibilityRole="header" className="text-xl font-bold text-ink">
                {t('add.category')}
              </Text>
              <CategoryGrid categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
            </View>
          )}

          <View className="gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: detailsOpen }}
              onPress={() => setDetailsOpen((open) => !open)}
              className="min-h-[56px] flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 active:opacity-70">
              <Text className="text-lg font-semibold text-ink">{t('add.details')}</Text>
              <Text className="text-xl text-muted">{detailsOpen ? '▲' : '▼'}</Text>
            </Pressable>

            {detailsOpen && (
              <View className="gap-5">
                <View className="gap-2">
                  <Text className="text-lg font-bold text-ink">{t('add.date')}</Text>
                  <DateField value={occurredOn} today={today} onChange={setOccurredOn} />
                </View>

                {!isSavings && (
                  <View className="gap-2">
                    <Text className="text-lg font-bold text-ink">{t('add.payment')}</Text>
                    <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
                      {PAYMENT_METHODS.map((method) => (
                        <Chip
                          key={method}
                          label={t(`paymentMethods.${method}`)}
                          selected={method === paymentMethod}
                          onPress={() => setPaymentMethod(method)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                <View className="gap-2">
                  <Text className="text-lg font-bold text-ink">{t('add.note')}</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder={t('add.notePlaceholder')}
                    placeholderTextColor={colors.muted}
                    maxLength={200}
                    accessibilityLabel={t('add.note')}
                    className="min-h-[56px] rounded-2xl border-2 border-line bg-surface px-4 text-lg text-ink"
                  />
                </View>
              </View>
            )}
          </View>

          {onDelete && <OutlineButton tone="coral" label={t('edit.delete')} onPress={onDelete} />}
        </ScrollView>

        <View className="gap-2 border-t border-line px-4 pb-2 pt-3">
          {saveFailed ? (
            <Text accessibilityLiveRegion="polite" className="text-center text-base font-medium text-coral">
              {t('add.saveError')}
            </Text>
          ) : !canSave ? (
            <Text className="text-center text-base text-muted">{isSavings ? t('add.hintSavings') : t('add.hint')}</Text>
          ) : null}
          <BigButton
            label={`✓  ${t('add.confirm')}`}
            accessibilityLabel={t('add.confirm')}
            disabled={!canSave}
            onPress={save}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
