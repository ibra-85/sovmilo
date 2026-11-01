import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Button, Text, TextField } from '@/components/ui';
import { newId } from '@/db/ids';
import { centsToInputString, formatMoney, getCurrencySymbol, parseAmountToCents } from '@/domain/money';
import {
  MAX_MOVEMENT_NOTE_LENGTH,
  cleanNote,
  maxWithdrawalCents,
  validateMovementFields,
  type MovementKind,
  type MovementLike,
} from '@/domain/savings';
import { getLastKeyboardHeight, useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useLocale } from '@/i18n/use-locale';
import { DateRow } from '@/features/transactions/date-row';

import { SavingsError, addMovement, cancelMovement, updateMovement } from './repository';
import type { MovementRow } from './use-savings';

export interface MovementSaved {
  id: string;
  kind: MovementKind;
  amountCents: number;
  /** Création ou correction. `previous` : le mouvement avant correction (pour « Annuler »). */
  action: 'added' | 'edited';
  previous?: MovementRow;
}

interface MovementSheetProps {
  visible: boolean;
  goal: { id: string; name: string } | null;
  /** Versement ou retrait (ignoré en correction : le type du mouvement corrigé est conservé). */
  kind: MovementKind;
  /** Mouvement à corriger. Absent : le panneau en crée un. */
  movement?: MovementRow | null;
  /** Historique actif de l'objectif : sert à calculer le montant disponible pour un retrait. Inutile pour un versement. */
  history?: readonly MovementLike[];
  today: string;
  onClose: () => void;
  onSaved: (result: MovementSaved) => void;
  /** Un mouvement vient d'être annulé depuis ce panneau. */
  onCancelled: (movement: MovementRow) => void;
}

const KEYBOARD_ESTIMATE = 0.4;

/**
 * Panneau de versement, de retrait ou de correction d'un mouvement : montant (obligatoire, positif), date (aujourd'hui par défaut,
 * jamais dans le futur), note facultative. Pour un retrait, le montant disponible à la date choisie est affiché et le bouton reste
 * inactif au-delà. En correction, un bouton « Annuler ce versement » passe par une confirmation DANS le panneau (jamais de
 * suppression par un simple geste). Aucune opération, aucun solde, aucun budget n'est touché.
 */
export function MovementSheet({ visible, goal, kind, movement, history, today, onClose, onSaved, onCancelled }: MovementSheetProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const amountInput = useRef<ComponentRef<typeof TextInput>>(null);
  const saving = useRef(false);

  // Dernier mouvement/objectif reçus : le contenu reste affiché pendant la fermeture du panneau.
  const [shownGoal, setShownGoal] = useState(goal);
  if (goal && goal !== shownGoal) setShownGoal(goal);
  const target = goal ?? shownGoal;

  const [amountText, setAmountText] = useState('');
  const [occurredOn, setOccurredOn] = useState(today);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState<null | 'negative' | 'archived' | 'saveFailed'>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // Figés à l'ouverture : le titre et le type ne changent pas pendant que le panneau se ferme.
  const [openKind, setOpenKind] = useState<MovementKind>(kind);
  const [editing, setEditing] = useState<MovementRow | null>(null);
  // Identifiant choisi à l'ouverture : un double toucher réenregistre le même mouvement, jamais deux.
  const [pendingId, setPendingId] = useState(() => newId());

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setOpenKind(movement ? movement.kind : kind);
      setEditing(movement ?? null);
      setAmountText(movement ? centsToInputString(movement.amountCents, ',') : '');
      setOccurredOn(movement ? movement.occurredOn : today);
      setNote(movement?.note ?? '');
      setFailed(null);
      setConfirmingCancel(false);
      setPendingId(newId());
    }
  }

  const withdrawal = openKind === 'withdrawal';
  const trimmed = amountText.trim();
  const cents = trimmed === '' ? null : parseAmountToCents(trimmed);
  const cleanedNote = cleanNote(note);
  const fieldProblem = validateMovementFields(cents, occurredOn, today);
  const noteTooLong = cleanedNote !== null && cleanedNote.length > MAX_MOVEMENT_NOTE_LENGTH;

  // Disponible à la date choisie, sans le mouvement qu'on corrige.
  const available = withdrawal
    ? maxWithdrawalCents((history ?? []).filter((entry) => entry.id !== editing?.id), occurredOn)
    : null;
  const tooMuch = withdrawal && cents !== null && available !== null && cents > available;

  const canSubmit = target !== null && fieldProblem === null && !noteTooLong && !tooMuch;

  const amountError =
    trimmed !== '' && cents === null
      ? t('savings.movement.errors.amountInvalid')
      : fieldProblem === 'amount' && trimmed !== ''
        ? cents !== null && cents > 0
          ? t('savings.movement.errors.amountTooBig')
          : t('savings.movement.errors.amountInvalid')
        : tooMuch && available !== null
          ? t('savings.movement.errors.withdrawTooMuch', { amount: formatMoney(available, locale) })
          : undefined;
  const dateError = fieldProblem === 'future' ? t('savings.movement.errors.dateFuture') : fieldProblem === 'date' ? t('savings.movement.errors.dateInvalid') : undefined;
  const noteError = noteTooLong ? t('savings.movement.errors.noteTooLong', { max: MAX_MOVEMENT_NOTE_LENGTH }) : undefined;
  const generalError = failed ? t(`savings.movement.errors.${failed}`) : undefined;

  const keyboardReserve = Math.max(keyboardHeight, getLastKeyboardHeight() || Math.round(window.height * KEYBOARD_ESTIMATE));
  const fixedBottom = 150 + 70 * Math.min(window.fontScale, 1.8);
  const scrollMax = Math.max(140, window.height - insets.top - insets.bottom - keyboardReserve - 56 - fixedBottom);

  function fail(error: unknown) {
    saving.current = false;
    if (error instanceof SavingsError && (error.code === 'negative' || error.code === 'archived')) setFailed(error.code);
    else setFailed('saveFailed');
  }

  function save() {
    if (!canSubmit || !target || cents === null || saving.current) return;
    // Deux touchers dans la même fraction de seconde ne doivent enregistrer qu'une fois (le verrou se libère de lui-même).
    saving.current = true;
    setTimeout(() => {
      saving.current = false;
    }, 600);
    try {
      if (editing) {
        updateMovement(editing.id, { amountCents: cents, occurredOn, note: cleanedNote }, today);
        onSaved({ id: editing.id, kind: editing.kind, amountCents: cents, action: 'edited', previous: editing });
      } else {
        const result = addMovement(target.id, { id: pendingId, kind: openKind, amountCents: cents, occurredOn, note: cleanedNote }, today);
        onSaved({ id: result.id, kind: openKind, amountCents: cents, action: 'added' });
      }
    } catch (error) {
      fail(error);
    }
  }

  function confirmCancel() {
    if (!editing || saving.current) return;
    saving.current = true;
    setTimeout(() => {
      saving.current = false;
    }, 600);
    try {
      cancelMovement(editing.id);
      onCancelled(editing);
    } catch (error) {
      setConfirmingCancel(false);
      fail(error);
    }
  }

  const title = t(editing ? (withdrawal ? 'savings.movement.editWithdrawTitle' : 'savings.movement.editDepositTitle') : withdrawal ? 'savings.movement.withdrawTitle' : 'savings.movement.depositTitle');
  const confirmLabel = t(editing ? 'savings.movement.editConfirm' : withdrawal ? 'savings.movement.withdrawConfirm' : 'savings.movement.depositConfirm');

  const confirmContent =
    confirmingCancel && editing ? (
      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text variant="titleSheet" accessibilityRole="header">
            {t('savings.movement.cancelTitle')}
          </Text>
          <Text variant="secondary" tone="muted">
            {t('savings.movement.cancelText')}
          </Text>
          <Text variant="bodyStrong" accessibilityLiveRegion="polite">
            {`${withdrawal ? '−' : '+'}${formatMoney(editing.amountCents, locale)}`}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          <Button label={t('savings.movement.cancelConfirm')} variant="destructive" icon="trash" onPress={confirmCancel} />
          <Button label={t('savings.movement.keep')} variant="secondary" onPress={() => setConfirmingCancel(false)} />
        </View>
      </View>
    ) : null;

  return (
    // Le clavier s'ouvre sur le montant une fois le panneau posé (jamais pendant son entrée), sauf en correction.
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={confirmContent ? t('savings.movement.cancelTitle') : title}
      onPresented={() => {
        if (!movement) amountInput.current?.focus();
      }}>
      {confirmContent ?? (
        <View style={{ gap: 12 }}>
          <ScrollView style={{ maxHeight: scrollMax }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 16 }}>
              <View style={{ gap: 4 }}>
                <Text variant="titleSheet" accessibilityRole="header">
                  {title}
                </Text>
                {target ? (
                  <Text variant="secondary" tone="muted" numberOfLines={2}>
                    {target.name}
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: 8 }}>
                <TextField
                  label={t('savings.movement.amountLabel')}
                  showLabel
                  placeholder={t('savings.movement.amountPlaceholder')}
                  value={amountText}
                  onChangeText={(value) => {
                    setAmountText(value);
                    setFailed(null);
                  }}
                  keyboardType="decimal-pad"
                  maxLength={14}
                  returnKeyType="done"
                  onSubmitEditing={save}
                  error={amountError ?? generalError}
                  inputRef={amountInput}
                  trailing={
                    <Text variant="bodyStrong" tone="muted">
                      {getCurrencySymbol(locale)}
                    </Text>
                  }
                />
                {withdrawal && available !== null && !amountError ? (
                  <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
                    {t(occurredOn === today ? 'savings.movement.available' : 'savings.movement.availableOn', { amount: formatMoney(available, locale) })}
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: 8 }}>
                <DateRow
                  value={occurredOn}
                  today={today}
                  onChange={(value) => {
                    setOccurredOn(value);
                    setFailed(null);
                  }}
                  label={t('savings.movement.dateLabel')}
                  maximumDate={today}
                />
                {dateError ? (
                  <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite">
                    {dateError}
                  </Text>
                ) : null}
              </View>

              <TextField
                label={t('savings.movement.noteLabel')}
                showLabel
                placeholder={t('savings.movement.notePlaceholder')}
                value={note}
                onChangeText={setNote}
                maxLength={MAX_MOVEMENT_NOTE_LENGTH + 20}
                autoCapitalize="sentences"
                returnKeyType="done"
                error={noteError}
              />

              {!editing ? (
                <Text variant="caption" tone="muted">
                  {t('savings.movement.declarative')}
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <Button label={confirmLabel} icon="check" disabled={!canSubmit} onPress={save} />
          {editing ? (
            <Button
              label={t(withdrawal ? 'savings.movement.cancelWithdrawal' : 'savings.movement.cancelDeposit')}
              variant="secondary"
              icon="trash"
              onPress={() => setConfirmingCancel(true)}
            />
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
