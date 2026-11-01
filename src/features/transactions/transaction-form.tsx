import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import {
  AmountInput,
  AppScreen,
  BottomSheet,
  Button,
  FieldGroup,
  FormRow,
  ScreenHeader,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { centsToInputString, keypadValueToCents } from '@/domain/money';
import type { CategoryKind, PaymentMethod, TransactionType } from '@/domain/types';
import { CategoryCarousel } from '@/features/categories/category-carousel';
import { useCategoryActions } from '@/features/categories/category-actions';
import { NewCategorySheet } from '@/features/categories/new-category-sheet';
import { useCategories } from '@/features/categories/use-categories';
import { useToday } from '@/hooks/use-today';
import { space } from '@/theme/layout';

import { DateRow } from './date-row';

export interface TransactionFormValues {
  type: TransactionType;
  amountCents: number;
  categoryId: string | null;
  occurredOn: string;
  paymentMethod: PaymentMethod;
  note: string;
}

interface TransactionFormProps {
  /** Valeurs d'une opération existante (modification) : le type ne change plus. */
  initial?: TransactionFormValues;
  /** Type d'une nouvelle opération (décidé par le point d'entrée : menu +, bouton « Mettre de côté »). */
  type?: TransactionType;
  /** Enregistre. Peut lever une erreur : le formulaire reste alors ouvert et affiche un message. */
  onSubmit: (values: TransactionFormValues) => void;
  onClose: () => void;
}

const MAX_NOTE_LENGTH = 200;

/**
 * Formulaire commun à l'ajout et à la modification (design/screens/03-add-expense) : montant en grand, carrousel de
 * catégories (« Créer » en tête), lignes Date et Note, puis le bouton principal en bas. Un seul écran, sans étapes :
 * le clavier numérique s'ouvre en touchant le montant.
 *
 * Le type (dépense, revenu, épargne) n'est pas un choix du formulaire : il vient du point d'entrée, comme dans le design.
 * Le moyen de paiement n'est plus proposé (le design n'a pas ce champ) : « carte » par défaut, la valeur d'une opération
 * existante est conservée à la modification. Voir docs/design-deviations.md.
 */
export function TransactionForm({ initial, type: newType = 'expense', onSubmit, onClose }: TransactionFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const today = useToday();

  const type = initial?.type ?? newType;
  const editing = initial !== undefined;
  const isSavings = type === 'transfer';

  const [value, setValue] = useState(initial ? centsToInputString(initial.amountCents, '.') : '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [noteDraft, setNoteDraft] = useState(note);
  const [noteOpen, setNoteOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(false); // évite le double enregistrement si l'on appuie deux fois très vite

  const categoryKind: CategoryKind = type === 'income' ? 'income' : 'expense';
  const categories = useCategories(categoryKind);
  // Une catégorie supprimée depuis le carrousel ne reste pas sélectionnée.
  const categoryActions = useCategoryActions(categoryKind, (id) => setCategoryId((current) => (current === id ? null : current)));
  const cents = keypadValueToCents(value);
  const canSave = cents > 0 && (isSavings || categoryId !== null);

  const titleKey = type === 'income' ? 'add.titleIncome' : isSavings ? 'add.titleSavings' : 'add.titleExpense';
  const amountKey = type === 'income' ? 'add.amountIncome' : isSavings ? 'add.amountSavings' : 'add.amountExpense';
  const saveKey = editing
    ? 'add.saveChanges'
    : type === 'income'
      ? 'add.saveIncome'
      : isSavings
        ? 'add.saveSavings'
        : 'add.saveExpense';
  const title = editing ? t('edit.title') : t(titleKey);

  function save() {
    if (!canSave || saving.current) return;
    saving.current = true;
    try {
      onSubmit({
        type,
        amountCents: cents,
        categoryId: isSavings ? null : categoryId,
        occurredOn,
        paymentMethod: isSavings ? 'transfer' : (initial?.paymentMethod ?? 'card'),
        note,
      });
    } catch {
      saving.current = false;
      setSaveFailed(true);
    }
  }

  function openNote() {
    setNoteDraft(note);
    setNoteOpen(true);
  }

  function validateNote() {
    setNote(noteDraft.trim());
    setNoteOpen(false);
  }

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={title} onBack={onClose} backLabel={t('add.close')} />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 36, paddingBottom: 24 }}>
          <View style={{ paddingHorizontal: space.screen }}>
            <AmountInput
              label={t(amountKey)}
              value={value}
              onChangeValue={(next) => {
                setSaveFailed(false);
                setValue(next);
              }}
              autoFocus={!editing}
            />
          </View>

          {!isSavings && (
            <View style={{ marginTop: 40, gap: space.sectionTitle }}>
              <Text variant="titleSection" accessibilityRole="header" style={{ paddingHorizontal: space.screen }}>
                {t('add.category')}
              </Text>
              <CategoryCarousel
                categories={categories}
                selectedId={categoryId}
                onSelect={setCategoryId}
                onCreate={() => setCategorySheetOpen(true)}
                onManage={categoryActions.open}
              />
            </View>
          )}

          <View style={{ marginTop: 32, paddingHorizontal: space.screen }}>
            <FieldGroup>
              <DateRow value={occurredOn} today={today} onChange={setOccurredOn} />
              <FormRow
                icon="note"
                label={t('add.note')}
                value={note === '' ? undefined : note}
                placeholder={t('add.noteOptional')}
                onPress={openNote}
              />
            </FieldGroup>
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
          {saveFailed ? (
            <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
              {t('add.saveError')}
            </Text>
          ) : null}
          <Button label={t(saveKey)} icon="check" disabled={!canSave} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={noteOpen} onClose={() => setNoteOpen(false)} accessibilityLabel={t('add.noteSheetTitle')}>
        <View style={{ gap: 16 }}>
          <Text variant="titleSheet" accessibilityRole="header">
            {t('add.noteSheetTitle')}
          </Text>
          <TextField
            label={t('add.note')}
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder={t('add.notePlaceholder')}
            maxLength={MAX_NOTE_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={validateNote}
          />
          <Button label={t('add.noteDone')} icon="check" onPress={validateNote} />
        </View>
      </BottomSheet>

      <NewCategorySheet
        visible={categorySheetOpen}
        kind={categoryKind}
        onClose={() => setCategorySheetOpen(false)}
        onCreated={(id, name) => {
          setCategorySheetOpen(false);
          setCategoryId(id);
          toast.show({ message: t('category.created', { name }) });
        }}
      />
      {categoryActions.element}
    </AppScreen>
  );
}
