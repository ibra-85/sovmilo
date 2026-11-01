import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View, useWindowDimensions } from 'react-native';

import {
  AmountText,
  AppScreen,
  Button,
  ConfirmDialog,
  Divider,
  EmptyState,
  FieldGroup,
  Icon,
  IconButton,
  InfoRow,
  MorphingPopover,
  Pressable,
  ProgressBar,
  ScreenHeader,
  Surface,
  Text,
  usePopoverTrigger,
  useToast,
} from '@/components/ui';
import { formatDateWithYear, formatLongDate, formatShortDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { radius, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { goalStatusText } from './format';
import { GoalIcon } from './goal-row';
import { GoalSheet } from './goal-sheet';
import { MovementSheet, type MovementSaved } from './movement-sheet';
import { archiveGoal, cancelMovement, deleteGoal, restoreGoal, restoreMovement, updateMovement } from './repository';
import { useGoalDetail, type MovementRow } from './use-savings';

const UNDO_DURATION_MS = 6000;

/**
 * Détail d'un objectif : montant mis de côté, cible, reste, progression, historique complet. Les deux actions principales, « Ajouter »
 * et « Retirer », sont toujours visibles en bas. Le menu « ⋯ » porte les actions rares : modifier, archiver, supprimer (seulement
 * un objectif sans aucun mouvement). Un objectif archivé reste consultable mais en lecture seule, avec « Restaurer ». Toucher un
 * mouvement l'ouvre pour le corriger ou l'annuler (jamais par un simple geste). Aucune opération, aucun solde, aucun budget n'est touché.
 */
export function GoalDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const today = useToday();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, loaded } = useGoalDetail(id ?? '');
  const { bindTrigger, coverStyle, anchor: menuAnchor, open: openMenu, close: closeMenu, reopen: reopenMenu, isOpen: menuOpen } = usePopoverTrigger();

  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState<{ kind: 'deposit' | 'withdrawal'; movement: MovementRow | null } | null>(null);
  const [confirming, setConfirming] = useState<'archive' | 'delete' | null>(null);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/savings');
  }, [router]);

  const openMovement = useCallback((movement: MovementRow) => setMoving({ kind: movement.kind, movement }), []);

  const back = (title: string) => <ScreenHeader title={title} onBack={close} backLabel={t('savings.backToSavings')} />;

  if (leaving || !loaded) return <AppScreen bottomInset>{back(t('savings.title'))}</AppScreen>;

  if (!detail) {
    return (
      <AppScreen bottomInset>
        {back(t('savings.title'))}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.screen }}>
          <EmptyState icon="savings" title={t('savings.detail.notFound')} />
          <Button label={t('savings.backToSavings')} variant="secondary" onPress={close} />
        </View>
      </AppScreen>
    );
  }

  const { goal, movements, movementLikes } = detail;
  const isArchived = goal.archivedAt !== null;
  const { progress } = goal;
  const done = progress.state === 'reached' || progress.state === 'exceeded';
  const heroWidth = window.width - 2 * space.screen - 32;

  function movementSaved(result: MovementSaved) {
    setMoving(null);
    const amount = formatMoney(result.amountCents, locale);
    toast.show({
      message:
        result.action === 'edited'
          ? t('savings.movement.updated')
          : t(result.kind === 'deposit' ? 'savings.movement.deposited' : 'savings.movement.withdrawn', { amount, name: goal.name }),
      actionLabel: t('edit.undo'),
      onAction: () => {
        try {
          if (result.action === 'edited' && result.previous) {
            updateMovement(result.id, { amountCents: result.previous.amountCents, occurredOn: result.previous.occurredOn, note: result.previous.note }, today);
          } else {
            cancelMovement(result.id);
          }
        } catch {
          toast.show({ message: t('savings.detail.actionFailed') });
        }
      },
      durationMs: UNDO_DURATION_MS,
    });
  }

  function movementCancelled(movement: MovementRow) {
    setMoving(null);
    toast.show({
      message: t('savings.movement.cancelled'),
      actionLabel: t('edit.undo'),
      onAction: () => {
        try {
          restoreMovement(movement.id);
          toast.show({ message: t('savings.movement.restored') });
        } catch {
          toast.show({ message: t('savings.detail.actionFailed') });
        }
      },
      durationMs: UNDO_DURATION_MS,
    });
  }

  function confirmArchive() {
    try {
      archiveGoal(goal.id);
    } catch {
      setFailed(true);
      return;
    }
    const name = goal.name;
    setConfirming(null);
    setLeaving(true);
    close();
    toast.show({ message: t('savings.detail.archived', { name }) });
  }

  function confirmDelete() {
    try {
      deleteGoal(goal.id);
    } catch {
      setFailed(true);
      return;
    }
    const name = goal.name;
    setConfirming(null);
    setLeaving(true);
    close();
    toast.show({ message: t('savings.detail.deleted', { name }) });
  }

  function restore() {
    try {
      restoreGoal(goal.id);
    } catch {
      toast.show({ message: t('savings.detail.actionFailed') });
      return;
    }
    const name = goal.name;
    setLeaving(true);
    close();
    toast.show({ message: t('savings.detail.restored', { name }) });
  }

  const items = [
    {
      key: 'edit',
      icon: 'note' as const,
      label: t('savings.detail.edit'),
      accessibilityLabel: t('savings.detail.editA11y', { name: goal.name }),
      onPress: () => {
        closeMenu();
        setEditing(true);
      },
    },
    {
      key: 'archive',
      icon: 'savings' as const,
      label: t('savings.detail.archive'),
      accessibilityLabel: t('savings.detail.archiveA11y', { name: goal.name }),
      onPress: () => {
        closeMenu();
        setFailed(false);
        setConfirming('archive');
      },
    },
    // Un objectif qui a un historique ne se supprime jamais : on l'archive.
    ...(goal.movementCount === 0
      ? [
          {
            key: 'delete',
            icon: 'trash' as const,
            label: t('savings.detail.delete'),
            accessibilityLabel: t('savings.detail.deleteA11y', { name: goal.name }),
            destructive: true,
            onPress: () => {
              closeMenu();
              setFailed(false);
              setConfirming('delete');
            },
          },
        ]
      : []),
  ];

  const header = (
    <View style={{ gap: 20, paddingBottom: 12 }}>
      {isArchived ? (
        <View style={{ padding: 12, borderRadius: radius.group, backgroundColor: colors.surfaceMuted }} accessible accessibilityRole="summary">
          <Text variant="secondary" tone="muted">
            {t('savings.detail.archivedBanner')}
          </Text>
        </View>
      ) : null}

      <Surface radiusToken="group" style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{ width: 48, height: 48, borderRadius: radius.iconPad, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}>
            <GoalIcon icon={goal.icon} size={26} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">
              {t('savings.detail.savedLabel')}
            </Text>
            <AmountText cents={goal.savedCents} size="total" maxWidth={heroWidth - 60} align="left" />
          </View>
        </View>
        <ProgressBar percent={progress.barPercent} thickness="thick" complete={done} />
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          accessible
          accessibilityLabel={`${t('savings.progressA11y', { percent: progress.percent })}. ${goalStatusText(progress, locale, t)}`}
          accessibilityLiveRegion="polite">
          {done ? <Icon name="check" size={16} color={colors.successIcon} weight="strong" /> : null}
          <Text variant="secondaryStrong" style={{ flex: 1 }}>
            {`${progress.percent} % · ${goalStatusText(progress, locale, t)}`}
          </Text>
        </View>
      </Surface>

      <FieldGroup>
        <InfoRow label={t('savings.detail.targetLabel')} value={formatMoney(goal.targetCents, locale)} />
        {progress.state === 'exceeded' ? (
          <InfoRow label={t('savings.detail.exceededLabel')} value={formatMoney(progress.exceededCents, locale)} />
        ) : progress.state !== 'reached' ? (
          <InfoRow label={t('savings.detail.remainingLabel')} value={formatMoney(progress.remainingCents, locale)} />
        ) : null}
        {goal.targetDate !== null ? <InfoRow label={t('savings.detail.targetDateLabel')} value={formatLongDate(goal.targetDate, locale)} /> : null}
        {goal.note !== null ? <InfoRow label={t('savings.detail.noteLabel')} value={goal.note} /> : null}
      </FieldGroup>

      <Text variant="titleSection" accessibilityRole="header">
        {t('savings.detail.historyTitle')}
      </Text>
      {movements.length === 0 ? (
        <Text variant="secondary" tone="muted">
          {t('savings.detail.historyEmpty')}
        </Text>
      ) : null}
    </View>
  );

  return (
    <AppScreen bottomInset>
      <ScreenHeader
        title={goal.name}
        onBack={close}
        backLabel={t('savings.backToSavings')}
        trailing={
          isArchived ? undefined : (
            <View ref={bindTrigger} collapsable={false} style={coverStyle}>
              <IconButton icon="more" label={t('savings.detail.moreActions')} expanded={menuOpen} onPress={openMenu} />
            </View>
          )
        }
      />

      <FlatList
        data={movements}
        keyExtractor={(movement) => movement.id}
        renderItem={({ item, index }) => (
          <View>
            {index > 0 && <Divider inset={space.fieldDividerInset} />}
            <MovementRowView movement={item} today={today} onOpen={isArchived ? undefined : openMovement} />
          </View>
        )}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 24 }}
      />

      <View style={{ paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', gap: 8 }}>
        {isArchived ? (
          <View style={{ flex: 1 }}>
            <Button label={t('savings.detail.restore')} icon="check" onPress={restore} />
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Button
                label={t('savings.detail.withdraw')}
                icon="minus"
                variant="secondary"
                disabled={goal.savedCents === 0}
                onPress={() => setMoving({ kind: 'withdrawal', movement: null })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('savings.detail.add')} icon="plus" onPress={() => setMoving({ kind: 'deposit', movement: null })} />
            </View>
          </>
        )}
      </View>

      <GoalSheet
        visible={editing}
        goal={goal}
        today={today}
        onClose={() => setEditing(false)}
        onSaved={(result) => {
          setEditing(false);
          toast.show({ message: t('savings.goal.updated', { name: result.name }) });
        }}
      />
      <MovementSheet
        visible={moving !== null}
        goal={{ id: goal.id, name: goal.name }}
        kind={moving?.kind ?? 'deposit'}
        movement={moving?.movement ?? null}
        history={movementLikes}
        today={today}
        onClose={() => setMoving(null)}
        onSaved={movementSaved}
        onCancelled={movementCancelled}
      />

      <MorphingPopover
        anchor={menuAnchor}
        onClose={closeMenu}
        onReopen={reopenMenu}
        anchorRadius={radius.iconButton}
        triggerContent={<Icon name="more" size={22} color={colors.ink} />}
        accessibilityLabel={t('savings.detail.menu')}
        items={items}
      />

      <ConfirmDialog
        visible={confirming === 'archive'}
        title={t('savings.detail.archiveTitle')}
        icon="savings"
        confirmIcon="check"
        cancelLabel={t('common.cancel')}
        confirmLabel={t('savings.detail.archiveConfirm')}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmArchive}>
        <ConfirmNote name={goal.name} text={failed ? t('savings.detail.actionFailed') : t('savings.detail.archiveText')} failed={failed} />
      </ConfirmDialog>

      <ConfirmDialog
        visible={confirming === 'delete'}
        title={t('savings.detail.deleteTitle')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('savings.detail.deleteConfirm')}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmDelete}>
        <ConfirmNote name={goal.name} text={failed ? t('savings.detail.actionFailed') : t('savings.detail.deleteText')} failed={failed} />
      </ConfirmDialog>
    </AppScreen>
  );
}

/** Rappel de l'objectif concerné dans une confirmation, avec la conséquence de l'action. */
function ConfirmNote({ name, text, failed }: { name: string; text: string; failed: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 12, borderRadius: radius.group, backgroundColor: colors.surfaceMuted, gap: 2 }}>
      <Text variant="body" numberOfLines={3}>
        {name}
      </Text>
      <Text variant="caption" tone={failed ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
        {text}
      </Text>
    </View>
  );
}

interface MovementRowViewProps {
  movement: MovementRow;
  today: string;
  /** Absent (objectif archivé) : la ligne n'est pas touchable. */
  onOpen?: (movement: MovementRow) => void;
}

/** Ligne de l'historique : type (versement / retrait), date, note, montant signé. Toucher la ligne ouvre le panneau de correction. */
const MovementRowView = memo(
  function MovementRowBase({ movement, today, onOpen }: MovementRowViewProps) {
    const { t } = useTranslation();
    const locale = useLocale();
    const { colors } = useTheme();
    const deposit = movement.kind === 'deposit';
    const kind = t(deposit ? 'savings.detail.deposit' : 'savings.detail.withdrawal');
    const date = movement.occurredOn.slice(0, 4) === today.slice(0, 4) ? formatShortDate(movement.occurredOn, locale) : formatDateWithYear(movement.occurredOn, locale);
    const amount = formatMoney(movement.amountCents, locale);
    const label = t('savings.detail.movementA11y', { kind, amount, date, note: movement.note ? ` ${movement.note}.` : '' });
    const signed = deposit ? movement.amountCents : -movement.amountCents;

    return (
      <Pressable
        accessibilityRole={onOpen ? 'button' : 'text'}
        accessibilityLabel={label}
        accessibilityHint={onOpen ? t('savings.detail.movementHint') : undefined}
        disabled={!onOpen}
        pressTranslate={0}
        onPress={() => onOpen?.(movement)}
        style={({ pressed }) => ({
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: space.listRow,
          paddingHorizontal: 4,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}>
        <View
          style={{ width: 40, height: 40, borderRadius: radius.iconPad, alignItems: 'center', justifyContent: 'center', backgroundColor: deposit ? colors.successBg : colors.surfaceMuted }}>
          <Icon name={deposit ? 'plus' : 'minus'} size={18} color={deposit ? colors.successIcon : colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {kind}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {movement.note ? `${date} · ${movement.note}` : date}
          </Text>
        </View>
        <View style={{ maxWidth: '45%' }}>
          <AmountText cents={signed} signed size="row" align="right" tone={deposit ? 'default' : 'muted'} />
        </View>
      </Pressable>
    );
  },
  (previous, next) =>
    previous.today === next.today &&
    previous.onOpen === next.onOpen &&
    previous.movement.id === next.movement.id &&
    previous.movement.kind === next.movement.kind &&
    previous.movement.amountCents === next.movement.amountCents &&
    previous.movement.occurredOn === next.movement.occurredOn &&
    previous.movement.note === next.movement.note,
);
