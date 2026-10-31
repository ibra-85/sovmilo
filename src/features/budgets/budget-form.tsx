import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import {
  AmountInput,
  AppScreen,
  Button,
  CategoryIcon,
  FieldGroup,
  FormRow,
  ScreenHeader,
  Text,
  useToast,
} from '@/components/ui';
import type { Category } from '@/db/schema';
import { formatMonthName } from '@/domain/dates';
import { centsToInputString, keypadValueToCents } from '@/domain/money';
import { CategoryCarousel } from '@/features/categories/category-carousel';
import { categoryLabel } from '@/features/categories/category-label';
import { NewCategorySheet } from '@/features/categories/new-category-sheet';
import { useLocale } from '@/i18n/use-locale';
import { space } from '@/theme/layout';

interface BudgetFormProps {
  /** `create` : on choisit la catégorie dans le carrousel. `edit` : la catégorie est fixe et le plafond actuel est affiché. */
  mode: 'create' | 'edit';
  month: string;
  /** Création : les catégories de dépenses qui n'ont pas encore de budget. */
  availableCategories?: readonly Category[];
  /** Modification : la catégorie du budget. */
  category?: Category;
  /** Modification : plafond actuel, en centimes. */
  initialCents?: number;
  onSubmit: (values: { categoryId: string; amountCents: number }) => void;
  onClose: () => void;
}

/**
 * Formulaire commun à la création et à la modification d'un budget (design/screens/09-create-budget et 10-edit-budget) :
 * limite mensuelle en grand, puis soit le carrousel de catégories (création), soit la catégorie en ligne fixe (modification),
 * la ligne « Période » (toujours mensuelle) et le bouton principal en bas.
 */
export function BudgetForm({ mode, month, availableCategories = [], category, initialCents, onSubmit, onClose }: BudgetFormProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const editing = mode === 'edit';

  const [value, setValue] = useState(initialCents === undefined ? '' : centsToInputString(initialCents, '.'));
  const [categoryId, setCategoryId] = useState<string | null>(category?.id ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(false);

  const cents = keypadValueToCents(value);
  const canSave = cents > 0 && categoryId !== null;

  function save() {
    if (!canSave || saving.current) return;
    saving.current = true;
    try {
      onSubmit({ categoryId, amountCents: cents });
    } catch {
      saving.current = false;
      setSaveFailed(true);
    }
  }

  const periodValue = t('budget.periodValue', { month: formatMonthName(month, locale) });

  return (
    <AppScreen bottomInset>
      <ScreenHeader
        title={t(editing ? 'budget.editTitle' : 'budget.newTitle')}
        onBack={onClose}
        backLabel={t('budget.back')}
      />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 36, paddingBottom: 24 }}>
          <View style={{ paddingHorizontal: space.screen, gap: 8 }}>
            <AmountInput
              label={t(editing ? 'budget.amountEdit' : 'budget.amountNew')}
              value={value}
              onChangeValue={(next) => {
                setSaveFailed(false);
                setValue(next);
              }}
              autoFocus={!editing}
            />
            {editing && (
              <Text variant="secondary" tone="muted" style={{ textAlign: 'center' }}>
                {t('budget.savedLimit')}
              </Text>
            )}
          </View>

          {!editing && (
            <View style={{ marginTop: 40, gap: space.sectionTitle }}>
              <Text variant="titleSection" accessibilityRole="header" style={{ paddingHorizontal: space.screen }}>
                {t('budget.categoryTitle')}
              </Text>
              <CategoryCarousel
                categories={availableCategories}
                selectedId={categoryId}
                onSelect={setCategoryId}
                onCreate={() => setSheetOpen(true)}
              />
              {availableCategories.length === 0 && (
                <Text variant="secondary" tone="muted" style={{ paddingHorizontal: space.screen }}>
                  {t('budget.allBudgeted')}
                </Text>
              )}
            </View>
          )}

          <View style={{ marginTop: 32, paddingHorizontal: space.screen }}>
            <FieldGroup>
              {editing && category && (
                <FormRow
                  iconNode={<CategoryIcon value={category.icon} size={18} />}
                  label={t('budget.rowCategory')}
                  value={categoryLabel(category, t)}
                />
              )}
              <FormRow icon="calendar" label={t('budget.rowPeriod')} value={periodValue} />
            </FieldGroup>
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
          {saveFailed ? (
            <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
              {t('budget.saveError')}
            </Text>
          ) : null}
          <Button label={t(editing ? 'budget.saveAction' : 'budget.createAction')} icon="check" disabled={!canSave} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <NewCategorySheet
        visible={sheetOpen}
        kind="expense"
        onClose={() => setSheetOpen(false)}
        onCreated={(id, name) => {
          setSheetOpen(false);
          setCategoryId(id);
          toast.show({ message: t('category.created', { name }) });
        }}
      />
    </AppScreen>
  );
}
