import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Button, Text, TextField } from '@/components/ui';
import { validatePayment } from '@/domain/bills';
import { centsToInputString, getCurrencySymbol, parseAmountToCents } from '@/domain/money';
import { getLastKeyboardHeight, useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useLocale } from '@/i18n/use-locale';
import { DateRow } from '@/features/transactions/date-row';

import { markPaid } from './repository';
import type { BillRow } from './use-bills';

interface PaymentSheetProps {
  visible: boolean;
  /** Échéance à payer (ou dont on corrige le paiement). Conservée pendant l'animation de fermeture. */
  row: BillRow | null;
  today: string;
  onClose: () => void;
  /** Le paiement est enregistré. `edited` : un paiement déjà déclaré a été corrigé. */
  onSaved: (row: BillRow, edited: boolean) => void;
}

/** Part de la hauteur d'écran réservée au clavier tant qu'on n'a pas vu sa vraie hauteur (même choix que le panneau d'article). */
const KEYBOARD_ESTIMATE = 0.4;

/**
 * Panneau « Marquer comme payée » : date de paiement (aujourd'hui proposée), montant payé (le montant prévu est proposé, mais on
 * peut en saisir un autre ou le laisser vide : il restera « non noté »). Un seul panneau, un seul bouton : deux touchers suffisent
 * depuis la liste. Même panneau pour corriger un paiement déjà déclaré. N'écrit que dans les factures : aucune opération, aucun
 * solde, aucun budget.
 */
export function PaymentSheet({ visible, row, today, onClose, onSaved }: PaymentSheetProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const amountInput = useRef<ComponentRef<typeof TextInput>>(null);
  const saving = useRef(false);

  // Dernière échéance reçue : le contenu reste affiché pendant la fermeture du panneau.
  const [shown, setShown] = useState<BillRow | null>(row);
  if (row && row !== shown) setShown(row);
  const target = row ?? shown;

  const [paidOn, setPaidOn] = useState(today);
  const [amountText, setAmountText] = useState('');
  const [failed, setFailed] = useState(false);
  // Figé à l'ouverture : une fois le paiement enregistré, la ligne devient « payée » mais le panneau qui se ferme ne doit pas changer de titre.
  const [edited, setEdited] = useState(false);

  // Chaque ouverture repart de l'échéance : date du paiement existant ou aujourd'hui, montant payé ou prévu.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible && row) {
      const alreadyPaid = row.paidOn !== null;
      const suggested = alreadyPaid ? row.paidAmountCents : row.amountCents;
      setEdited(alreadyPaid);
      setPaidOn(alreadyPaid ? (row.paidOn ?? today) : today);
      setAmountText(suggested !== null ? centsToInputString(suggested, ',') : '');
      setFailed(false);
    }
  }

  const trimmed = amountText.trim();
  const cents = trimmed === '' ? null : parseAmountToCents(trimmed);
  const amountInvalid = trimmed !== '' && cents === null;
  const problem = amountInvalid ? 'amount' : validatePayment(paidOn, cents, today);
  const canSubmit = target !== null && problem === null;

  const amountError = problem === 'amount' ? t('bills.errors.amountInvalid') : undefined;
  const dateError = problem === 'future' ? t('bills.errors.dateFuture') : problem === 'date' ? t('bills.errors.dateInvalid') : undefined;
  const generalError = failed ? t('bills.errors.actionFailed') : undefined;

  // Zone défilante bornée (clavier ouvert, texte agrandi, russe) : les boutons restent visibles. Même budget que le panneau d'article.
  const keyboardReserve = Math.max(keyboardHeight, getLastKeyboardHeight() || Math.round(window.height * KEYBOARD_ESTIMATE));
  const fixedBottom = 150 + 70 * Math.min(window.fontScale, 1.8);
  const scrollMax = Math.max(140, window.height - insets.top - insets.bottom - keyboardReserve - 56 - fixedBottom);

  function save() {
    if (!canSubmit || !target || saving.current) return;
    // Deux touchers dans la même fraction de seconde ne doivent enregistrer qu'une fois (le verrou se libère de lui-même).
    saving.current = true;
    setTimeout(() => {
      saving.current = false;
    }, 600);
    try {
      markPaid(target.id, { paidOn, amountCents: cents }, today);
    } catch {
      saving.current = false;
      setFailed(true);
      return;
    }
    onSaved(target, edited);
  }

  const title = t(edited ? 'bills.payEditTitle' : 'bills.payTitle');
  // Montant inconnu à renseigner : le clavier s'ouvre sur le montant (une fois le panneau posé, jamais pendant son entrée).
  const focusAmount = target !== null && !edited && target.amountCents === null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={title}
      onPresented={() => {
        if (focusAmount) amountInput.current?.focus();
      }}>
      <View style={{ gap: 12 }}>
        <ScrollView style={{ maxHeight: scrollMax }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Text variant="titleSheet" accessibilityRole="header">
                {title}
              </Text>
              {target && (
                <Text variant="secondary" tone="muted" numberOfLines={2}>
                  {target.name}
                </Text>
              )}
            </View>

            <View style={{ gap: 8 }}>
              <DateRow value={paidOn} today={today} onChange={setPaidOn} label={t('bills.payDate')} />
              {dateError ? (
                <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite">
                  {dateError}
                </Text>
              ) : null}
            </View>

            <View style={{ gap: 8 }}>
              <TextField
                label={t('bills.payAmount')}
                showLabel
                placeholder={t('bills.payAmountPlaceholder')}
                value={amountText}
                onChangeText={(value) => {
                  setAmountText(value);
                  setFailed(false);
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
              {trimmed === '' && !amountError ? (
                <Text variant="caption" tone="muted">
                  {t('bills.payAmountHelp')}
                </Text>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <Button label={t(edited ? 'bills.payKeep' : 'bills.payConfirm')} icon="check" disabled={!canSubmit} onPress={save} />
      </View>
    </BottomSheet>
  );
}
