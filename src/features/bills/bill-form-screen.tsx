import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import { AppScreen, Button, EmptyState, FieldGroup, ScreenHeader, SegmentedControl, Text, TextField, useToast } from '@/components/ui';
import {
  BILL_RECURRENCES,
  MAX_BILL_NAME_LENGTH,
  MAX_BILL_NOTE_LENGTH,
  isValidBillAmount,
  validateBillName,
  validateNewDueDate,
  isValidDate,
  type BillRecurrence,
} from '@/domain/bills';
import { centsToInputString, getCurrencySymbol, parseAmountToCents } from '@/domain/money';
import { DateRow } from '@/features/transactions/date-row';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { space } from '@/theme/layout';

import { recurrenceName } from './format';
import { createBill, updateBill } from './repository';
import { useBillDetail, type BillRow } from './use-bills';

/**
 * Création et modification d'une facture. Un seul écran, sans étapes : nom, montant prévu (facultatif), prochaine échéance,
 * répétition (Aucune par défaut), note (discrète, facultative). En modification, les changements ne valent que pour les
 * échéances à venir : les paiements déjà enregistrés ne sont jamais réécrits (le texte d'aide le dit).
 */
export function BillFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { detail, loaded } = useBillDetail(id ?? '');
  const editing = id !== undefined;

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/bills');
  }

  // En modification, le formulaire attend que la facture soit lue (ses champs partent des valeurs enregistrées).
  if (editing && !loaded) return <AppScreen bottomInset><ScreenHeader title={t('bills.editTitle')} onBack={close} backLabel={t('bills.backToBills')} /></AppScreen>;
  if (editing && !detail) {
    return (
      <AppScreen bottomInset>
        <ScreenHeader title={t('bills.editTitle')} onBack={close} backLabel={t('bills.backToBills')} />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.screen }}>
          <EmptyState icon="bills" title={t('bills.notFound')} />
        </View>
      </AppScreen>
    );
  }
  return <BillForm existing={detail ? { current: detail.current, nextUnpaid: detail.nextUnpaid } : null} onClose={close} />;
}

interface BillFormProps {
  existing: { current: BillRow; nextUnpaid: BillRow | null } | null;
  onClose: () => void;
}

function BillForm({ existing, onClose }: BillFormProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const locale = useLocale();
  const today = useToday();
  const editing = existing !== null;
  const bill = existing?.current ?? null;
  // La date éditée est celle de la prochaine échéance non payée ; sans elle (tout est payé) ou récurrence arrêtée, ni date ni répétition.
  const schedule = existing?.nextUnpaid ?? null;
  const scheduleEditable = !editing || (schedule !== null && bill?.stoppedOn === null);

  const [name, setName] = useState(bill?.name ?? '');
  const [amountText, setAmountText] = useState(bill?.billAmountCents != null ? centsToInputString(bill.billAmountCents, ',') : '');
  const [dueOn, setDueOn] = useState(schedule?.dueOn ?? today);
  const [recurrence, setRecurrence] = useState<BillRecurrence>(bill?.recurrence ?? 'none');
  const [note, setNote] = useState(bill?.note ?? '');
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(false); // évite le double enregistrement si l'on appuie deux fois très vite

  const nameProblem = validateBillName(name);
  const trimmed = amountText.trim();
  const cents = trimmed === '' ? null : parseAmountToCents(trimmed);
  const amountOk = trimmed === '' || (cents !== null && isValidBillAmount(cents));
  const dateProblem = !scheduleEditable ? null : editing ? (isValidDate(dueOn) ? null : 'invalid') : validateNewDueDate(dueOn, today);
  const canSave = nameProblem === null && amountOk && dateProblem === null;

  const nameError = nameProblem === 'too-long' ? t('bills.errors.nameTooLong', { max: MAX_BILL_NAME_LENGTH }) : undefined;
  const amountError = amountOk ? undefined : t('bills.errors.amountInvalid');
  const dateError = dateProblem === 'too-old' ? t('bills.errors.dateTooOld') : dateProblem === 'invalid' ? t('bills.errors.dateInvalid') : undefined;

  function save() {
    if (!canSave || saving.current) return;
    saving.current = true;
    const input = {
      name,
      expectedAmountCents: cents,
      recurrence: scheduleEditable ? recurrence : (bill?.recurrence ?? 'none'),
      nextDueOn: scheduleEditable ? dueOn : (schedule?.dueOn ?? bill?.anchorDate ?? dueOn),
      note: note.trim() === '' ? null : note,
    };
    try {
      if (bill) updateBill(bill.billId, input, today);
      else createBill(input, today);
    } catch {
      saving.current = false;
      setSaveFailed(true);
      return;
    }
    toast.show({ message: t(editing ? 'bills.saved' : 'bills.added', { name: name.replace(/\s+/g, ' ').trim() }) });
    onClose();
  }

  const title = t(editing ? 'bills.editTitle' : 'bills.addTitle');

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={title} onBack={onClose} backLabel={t('bills.backToBills')} />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 24, gap: 20 }}>
          <TextField
            label={t('bills.nameLabel')}
            showLabel
            placeholder={t('bills.namePlaceholder')}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setSaveFailed(false);
            }}
            maxLength={MAX_BILL_NAME_LENGTH + 20}
            autoFocus={!editing}
            autoCapitalize="sentences"
            returnKeyType="next"
            error={nameError}
          />

          <View style={{ gap: 8 }}>
            <TextField
              label={t('bills.amountLabel')}
              showLabel
              placeholder={t('bills.amountPlaceholder')}
              value={amountText}
              onChangeText={(value) => {
                setAmountText(value);
                setSaveFailed(false);
              }}
              keyboardType="decimal-pad"
              maxLength={14}
              returnKeyType="done"
              error={amountError}
              trailing={
                <Text variant="bodyStrong" tone="muted">
                  {getCurrencySymbol(locale)}
                </Text>
              }
            />
            {!amountError && trimmed === '' ? (
              <Text variant="caption" tone="muted">
                {t('bills.amountHelp')}
              </Text>
            ) : null}
          </View>

          {scheduleEditable && (
            <View style={{ gap: 8 }}>
              <FieldGroup>
                <DateRow value={dueOn} today={today} onChange={setDueOn} label={t('bills.dueFormLabel')} />
              </FieldGroup>
              {dateError ? (
                <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite">
                  {dateError}
                </Text>
              ) : null}
            </View>
          )}

          {scheduleEditable && (
            <View style={{ gap: 8 }}>
              <Text variant="label">{t('bills.recurrenceFormLabel')}</Text>
              <SegmentedControl
                accessibilityLabel={t('bills.recurrenceGroup')}
                options={BILL_RECURRENCES.map((value) => ({ value, label: recurrenceName(value, t) }))}
                value={recurrence}
                onChange={setRecurrence}
              />
            </View>
          )}

          <TextField
            label={t('bills.noteFormLabel')}
            showLabel
            placeholder={t('bills.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            maxLength={MAX_BILL_NOTE_LENGTH}
            returnKeyType="done"
          />

          {editing && (
            <Text variant="caption" tone="muted">
              {t('bills.scopeHelp')}
            </Text>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
          {saveFailed ? (
            <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>
              {t('bills.errors.saveFailed')}
            </Text>
          ) : null}
          <Button label={t(editing ? 'bills.saveChanges' : 'bills.save')} icon="check" disabled={!canSave} onPress={save} />
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
