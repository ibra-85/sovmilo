import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { BottomSheet, Button, Icon, Pressable, Text, TextField } from '@/components/ui';
import { centsToInputString, formatMoneyAuto, getCurrencySymbol, parseAmountToCents } from '@/domain/money';
import {
  DEFAULT_GOAL_ICON,
  GOAL_EMOJIS,
  MAX_GOAL_NAME_LENGTH,
  MAX_GOAL_NOTE_LENGTH,
  cleanNote,
  isValidSavingsAmount,
  validateGoalName,
  validateTargetDate,
} from '@/domain/savings';
import { useLocale } from '@/i18n/use-locale';
import { DateRow } from '@/features/transactions/date-row';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { createGoal, updateGoal } from './repository';
import type { GoalRow } from './use-savings';

interface GoalSheetProps {
  visible: boolean;
  /** Objectif à modifier. Absent : le panneau crée un objectif. Conservé pendant l'animation de fermeture. */
  goal?: GoalRow | null;
  today: string;
  onClose: () => void;
  /** L'objectif est enregistré. `created` : création (sinon modification). */
  onSaved: (result: { id: string; name: string; created: boolean }) => void;
}

const EMOJI_TILE = 46;
/** Icônes montrées d'emblée (la dernière place est la tuile « plus d'icônes ») ; le reste du choix est déplié sur demande, sur place. */
const SHORT_ICONS = 5;

/**
 * Panneau « Nouvel objectif » / « Modifier l'objectif » : nom et montant à atteindre (seuls champs obligatoires), icône, date visée
 * indicative et note facultatives. Le montant épargné de départ est toujours zéro : on l'alimente ensuite par un premier versement,
 * qui apparaît dans l'historique. Modifier la cible ne touche jamais aux mouvements.
 */
export function GoalSheet({ visible, goal, today, onClose, onSaved }: GoalSheetProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();
  const nameInput = useRef<ComponentRef<typeof TextInput>>(null);
  const saving = useRef(false);

  // Dernier objectif reçu : le contenu reste affiché pendant la fermeture du panneau.
  const [shown, setShown] = useState<GoalRow | null | undefined>(goal);
  if (goal !== undefined && goal !== shown) setShown(goal);
  const editing = visible ? goal : shown;

  const [name, setName] = useState('');
  const [targetText, setTargetText] = useState('');
  const [icon, setIcon] = useState(DEFAULT_GOAL_ICON);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [allIcons, setAllIcons] = useState(false);
  const [failed, setFailed] = useState(false);
  // Figé à l'ouverture : le titre ne change pas pendant que le panneau se ferme.
  const [isEdit, setIsEdit] = useState(false);

  // Chaque ouverture repart de l'objectif (modifier) ou d'un formulaire vide (créer).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setIsEdit(Boolean(goal));
      setName(goal?.name ?? '');
      setTargetText(goal ? centsToInputString(goal.targetCents, ',') : '');
      setIcon(goal?.icon ?? DEFAULT_GOAL_ICON);
      setTargetDate(goal?.targetDate ?? null);
      setNote(goal?.note ?? '');
      setNoteOpen(Boolean(goal?.note));
      setAllIcons(goal ? GOAL_EMOJIS.indexOf(goal.icon as (typeof GOAL_EMOJIS)[number]) >= SHORT_ICONS : false);
      setFailed(false);
    }
  }

  const trimmedTarget = targetText.trim();
  const targetCents = trimmedTarget === '' ? null : parseAmountToCents(trimmedTarget);
  const nameProblem = validateGoalName(name);
  const dateProblem = validateTargetDate(targetDate, today, editing?.targetDate ?? null);
  const cleanedNote = cleanNote(note);
  const noteTooLong = cleanedNote !== null && cleanedNote.length > MAX_GOAL_NOTE_LENGTH;
  const targetValid = isValidSavingsAmount(targetCents);
  const canSubmit = nameProblem === null && targetValid && dateProblem === null && !noteTooLong;

  const nameError = nameProblem === 'too-long' ? t('savings.errors.nameTooLong', { max: MAX_GOAL_NAME_LENGTH }) : undefined;
  const targetError = trimmedTarget !== '' && !targetValid ? t('savings.errors.targetInvalid') : undefined;
  const dateError = dateProblem === 'past' ? t('savings.errors.datePast') : dateProblem === 'invalid' ? t('savings.errors.dateInvalid') : undefined;
  const noteError = noteTooLong ? t('savings.errors.noteTooLong', { max: MAX_GOAL_NOTE_LENGTH }) : undefined;
  const generalError = failed ? t('savings.errors.saveFailed') : undefined;

  // Une cible plus basse que ce qui est déjà mis de côté est permise (objectif atteint) : on le dit avant d'enregistrer.
  const belowSaved = isEdit && editing && targetValid && editing.savedCents > targetCents;

  function save() {
    if (!canSubmit || saving.current || targetCents === null) return;
    // Deux touchers dans la même fraction de seconde ne doivent enregistrer qu'une fois (le verrou se libère de lui-même).
    saving.current = true;
    setTimeout(() => {
      saving.current = false;
    }, 600);
    const input = { name, targetCents, icon, targetDate, note: cleanedNote };
    try {
      if (isEdit && editing) {
        updateGoal(editing.id, input, today);
        onSaved({ id: editing.id, name: name.replace(/\s+/g, ' ').trim(), created: false });
      } else {
        const id = createGoal(input, today);
        onSaved({ id, name: name.replace(/\s+/g, ' ').trim(), created: true });
      }
    } catch {
      saving.current = false;
      setFailed(true);
    }
  }

  const title = t(isEdit ? 'savings.goal.editTitle' : 'savings.goal.newTitle');

  // Icônes visibles : les premières ; si l'icône choisie est plus loin, elle prend la dernière place de la ligne courte.
  const shortList = GOAL_EMOJIS.slice(0, SHORT_ICONS) as readonly string[];
  const visibleIcons: readonly string[] = allIcons
    ? GOAL_EMOJIS
    : shortList.includes(icon)
      ? shortList
      : [...shortList.slice(0, SHORT_ICONS - 1), icon];

  return (
    // Panneau extensible : compact d'abord, déployé en tirant la poignée ; le bouton reste toujours visible. Le focus du nom est
    // donné une fois le panneau posé (jamais pendant son entrée) quand on crée ; une modification n'ouvre pas le clavier.
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={title}
      expandable
      onPresented={() => {
        if (!goal) nameInput.current?.focus();
      }}
      footer={<Button label={t(isEdit ? 'savings.goal.saveConfirm' : 'savings.goal.createConfirm')} icon="check" disabled={!canSubmit} onPress={save} />}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Text variant="titleSheet" accessibilityRole="header">
          {title}
        </Text>

        <TextField
          label={t('savings.goal.nameLabel')}
          showLabel
          placeholder={t('savings.goal.namePlaceholder')}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setFailed(false);
          }}
          maxLength={MAX_GOAL_NAME_LENGTH + 10}
          autoCapitalize="sentences"
          returnKeyType="next"
          error={nameError}
          inputRef={nameInput}
        />

        <View style={{ gap: 8 }}>
          <TextField
            label={t('savings.goal.targetLabel')}
            showLabel
            placeholder={t('savings.goal.targetPlaceholder')}
            value={targetText}
            onChangeText={(value) => {
              setTargetText(value);
              setFailed(false);
            }}
            keyboardType="decimal-pad"
            maxLength={14}
            returnKeyType="done"
            onSubmitEditing={save}
            error={targetError ?? generalError}
            trailing={
              <Text variant="bodyStrong" tone="muted">
                {getCurrencySymbol(locale)}
              </Text>
            }
          />
          {belowSaved && editing ? (
            <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
              {t('savings.goal.targetBelowSaved', { saved: formatMoneyAuto(editing.savedCents, locale) })}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label">{t('savings.goal.iconLabel')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {visibleIcons.map((emoji) => {
              const selected = emoji === icon;
              return (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={t('savings.goal.iconA11y', { icon: emoji })}
                  accessibilityState={{ selected }}
                  pressTranslate={0}
                  onPress={() => setIcon(emoji)}
                  style={{
                    width: EMOJI_TILE,
                    height: EMOJI_TILE,
                    borderRadius: radius.iconPad,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? colors.surface : colors.surfaceMuted,
                    borderWidth: 2,
                    borderColor: selected ? colors.ink : 'transparent',
                  }}>
                  <Text variant="titleSheet" style={{ includeFontPadding: false }}>
                    {emoji}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(allIcons ? 'savings.goal.lessIcons' : 'savings.goal.moreIcons')}
              accessibilityState={{ expanded: allIcons }}
              pressTranslate={0}
              onPress={() => setAllIcons(!allIcons)}
              style={{
                width: EMOJI_TILE,
                height: EMOJI_TILE,
                borderRadius: radius.iconPad,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}>
              <Icon name={allIcons ? 'chevronUp' : 'more'} size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <DateRow
            value={targetDate}
            today={today}
            onChange={setTargetDate}
            label={t('savings.goal.dateLabel')}
            emptyLabel={t('savings.goal.dateEmpty')}
            minimumDate={today}
          />
          {dateError ? (
            <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite">
              {dateError}
            </Text>
          ) : targetDate !== null ? null : (
            <Text variant="caption" tone="muted">
              {t('savings.goal.dateHelp')}
            </Text>
          )}
          {targetDate !== null ? (
            <View style={{ alignItems: 'flex-start' }}>
              <Button label={t('savings.goal.dateClear')} variant="secondary" size="compact" icon="close" onPress={() => setTargetDate(null)} />
            </View>
          ) : null}
        </View>

        {noteOpen ? (
          <TextField
            label={t('savings.goal.noteLabel')}
            showLabel
            placeholder={t('savings.goal.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            maxLength={MAX_GOAL_NOTE_LENGTH + 20}
            autoCapitalize="sentences"
            returnKeyType="done"
            error={noteError}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('savings.goal.addNote')}
            pressTranslate={0}
            onPress={() => setNoteOpen(true)}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="note" size={18} color={colors.textMuted} />
            <Text variant="bodyStrong" tone="muted">
              {t('savings.goal.addNote')}
            </Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}
