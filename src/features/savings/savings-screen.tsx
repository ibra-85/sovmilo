import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, View, useWindowDimensions } from 'react-native';

import {
  AmountText,
  AppScreen,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  MorphingPopover,
  Pressable,
  ScreenHeader,
  Surface,
  Text,
  useToast,
  type PopoverAnchor,
} from '@/components/ui';
import { canReorder, isSameOrder, reorderBackAction } from '@/domain/savings';
import { formatMoney } from '@/domain/money';
import { useToday } from '@/hooks/use-today';
import { useLocale } from '@/i18n/use-locale';
import { space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { ConfirmNote } from './confirm-note';
import { GoalRowView } from './goal-row';
import { GoalSheet } from './goal-sheet';
import { ModeTransition } from './mode-transition';
import { MovementSheet, type MovementSaved } from './movement-sheet';
import { ReorderList } from './reorder-list';
import { archiveGoal, cancelMovement, reorderGoals } from './repository';
import { useActiveGoals, useArchivedGoals, type GoalRow } from './use-savings';

/** Une notification qui propose « Annuler » doit rester assez longtemps pour qu'on ait le temps de la lire et de la toucher. */
const UNDO_DURATION_MS = 6000;

/**
 * Services → Épargne : ce que l'utilisatrice déclare avoir mis de côté pour ses objectifs. L'épargne est DÉCLARATIVE : aucun
 * virement, aucune opération, aucun solde, aucun budget n'est touché. Le total n'est jamais présenté comme un solde bancaire.
 *
 * Structure : un résumé compact (total, nombre d'objectifs), une carte par objectif (toucher : détail ; « + » : versement ; appui
 * long : Modifier, Réorganiser, Archiver), le lien vers les archives, puis le bouton « Nouvel objectif ».
 *
 * Réorganiser : mode PROVISOIRE sur place. L'ordre modifié n'est enregistré que par « Terminé » ; « Annuler » (ou « Retour » puis
 * « Abandonner ») rend l'ordre d'origine. Les objectifs archivés ne sont jamais touchés et aucun montant ne change.
 */
export function SavingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const today = useToday();
  const { goals, summary, loaded } = useActiveGoals();
  const archived = useArchivedGoals();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GoalRow | null>(null);
  const [adding, setAdding] = useState<GoalRow | null>(null);
  const [archiving, setArchiving] = useState<GoalRow | null>(null);
  const [archiveFailed, setArchiveFailed] = useState(false);

  // Menu d'actions (appui long) : l'objectif visé reste mémorisé pendant la fermeture du menu.
  const [menuGoal, setMenuGoal] = useState<GoalRow | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<PopoverAnchor | null>(null);

  // Mode Réorganiser : ordre de départ, ordre provisoire, confirmation d'abandon.
  const [reordering, setReordering] = useState(false);
  const [initialOrder, setInitialOrder] = useState<string[]>([]);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [discarding, setDiscarding] = useState(false);
  const reorderMode = reordering && canReorder(goals.length);
  const modeKey = reorderMode ? 'reorder' : 'normal';
  // Verrou de sortie : « Terminé » / « Annuler » touchés deux fois de suite pendant la transition n'enregistrent ni n'abandonnent deux fois.
  const leaving = useRef(false);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }, [router]);

  const open = useCallback((goal: GoalRow) => router.push({ pathname: '/savings/[id]', params: { id: goal.id } }), [router]);
  const quickAdd = useMemo(() => ({ kind: 'add' as const, onPress: (goal: GoalRow) => setAdding(goal) }), []);
  const openMenu = useCallback((goal: GoalRow, anchor: PopoverAnchor) => {
    setMenuGoal(goal);
    setMenuAnchor(anchor);
  }, []);

  function movementSaved(result: MovementSaved) {
    const goal = adding;
    setAdding(null);
    toast.show({
      message: t('savings.movement.deposited', { amount: formatMoney(result.amountCents, locale), name: goal?.name ?? '' }),
      actionLabel: t('edit.undo'),
      onAction: () => {
        try {
          cancelMovement(result.id);
        } catch {
          toast.show({ message: t('savings.detail.actionFailed') });
        }
      },
      durationMs: UNDO_DURATION_MS,
    });
  }

  function confirmArchive() {
    if (!archiving) return;
    const { id, name } = archiving;
    try {
      archiveGoal(id);
    } catch {
      setArchiveFailed(true);
      return;
    }
    setArchiving(null);
    toast.show({ message: t('savings.detail.archived', { name }) });
  }

  function startReorder() {
    const ids = goals.map((goal) => goal.id);
    setInitialOrder(ids);
    setDraftOrder(ids);
    setDiscarding(false);
    leaving.current = false;
    setReordering(true);
  }

  /** « Terminé » : l'ordre provisoire est enregistré en UNE écriture ; sans changement, rien n'est écrit. */
  function finishReorder() {
    if (!reorderMode || leaving.current) return;
    if (!isSameOrder(initialOrder, draftOrder)) {
      try {
        reorderGoals(draftOrder);
      } catch {
        toast.show({ message: t('savings.reorder.failed') });
        return;
      }
    }
    leaving.current = true;
    setReordering(false);
  }

  /** « Annuler » : l'ordre d'origine revient (la liste est reconstruite depuis la base, que rien n'a modifiée). */
  function cancelReorder() {
    if (!reorderMode || leaving.current) return;
    leaving.current = true;
    setDiscarding(false);
    setReordering(false);
  }

  /** « Retour » (flèche de l'en-tête ou Android) pendant la réorganisation : quitte, ou demande si un changement n'est pas validé. */
  const leaveReorder = useCallback(() => {
    if (leaving.current) return;
    if (reorderBackAction(initialOrder, draftOrder) === 'leave') {
      leaving.current = true;
      setReordering(false);
    } else {
      setDiscarding(true);
    }
  }, [initialOrder, draftOrder]);

  useEffect(() => {
    if (!reorderMode) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveReorder();
      return true;
    });
    return () => subscription.remove();
  }, [reorderMode, leaveReorder]);

  const hasGoals = goals.length > 0;
  const contentWidth = window.width - 2 * space.screen - 32;
  const counts = [
    t('savings.goalCount', { count: summary.goalCount }),
    summary.reachedCount > 0 ? t('savings.reachedCount', { count: summary.reachedCount }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const menuItems = [
    {
      key: 'edit',
      icon: 'note' as const,
      label: t('savings.detail.edit'),
      accessibilityLabel: t('savings.detail.editA11y', { name: menuGoal?.name ?? '' }),
      onPress: () => {
        setMenuAnchor(null);
        setEditing(menuGoal);
      },
    },
    ...(canReorder(goals.length)
      ? [
          {
            key: 'reorder',
            icon: 'grip' as const,
            label: t('savings.reorder.start'),
            onPress: () => {
              setMenuAnchor(null);
              startReorder();
            },
          },
        ]
      : []),
    {
      key: 'archive',
      icon: 'archive' as const,
      label: t('savings.detail.archive'),
      accessibilityLabel: t('savings.detail.archiveA11y', { name: menuGoal?.name ?? '' }),
      onPress: () => {
        setMenuAnchor(null);
        setArchiveFailed(false);
        setArchiving(menuGoal);
      },
    },
  ];

  return (
    <AppScreen bottomInset>
      <ScreenHeader
        title={t('savings.title')}
        onBack={reorderMode ? leaveReorder : close}
        backLabel={t('common.back')}
        trailing={
          <ModeTransition mode={modeKey}>
            {(shown, changing) =>
              shown === 'normal' && canReorder(goals.length) ? (
                <IconButton icon="grip" label={t('savings.reorder.start')} onPress={startReorder} disabled={changing} />
              ) : null
            }
          </ModeTransition>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 24, gap: 16, flexGrow: 1 }}>
        {loaded && !hasGoals ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="savings" title={t('savings.emptyTitle')} text={t('savings.emptyText')} />
          </View>
        ) : null}

        {hasGoals ? (
          <Surface radiusToken="group" style={{ padding: 16, gap: 2 }}>
            <Text variant="caption" tone="muted">
              {t('savings.summaryLabel')}
            </Text>
            <AmountText cents={summary.totalSavedCents} size="total" maxWidth={contentWidth} align="left" />
            <Text variant="secondaryStrong" tone="muted" style={{ marginTop: 2 }}>
              {counts}
            </Text>
            <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
              {t('savings.summaryNote')}
            </Text>
          </Surface>
        ) : null}

        {hasGoals ? (
          <ModeTransition mode={modeKey} style={{ gap: 16 }}>
            {(shown) =>
              shown === 'reorder' ? (
                <>
                  <Text variant="secondary" tone="muted">
                    {t('savings.reorder.help')}
                  </Text>
                  <ReorderList goals={goals} onChange={setDraftOrder} />
                </>
              ) : (
                <>
                  <View style={{ gap: 10 }}>
                    {goals.map((goal) => (
                      <Surface key={goal.id} radiusToken="group" style={{ overflow: 'hidden' }}>
                        <GoalRowView goal={goal} onOpen={open} action={quickAdd} onMenu={openMenu} />
                      </Surface>
                    ))}
                  </View>
                  {archived.goals.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('savings.archivesLink', { count: archived.goals.length })}
                      pressTranslate={0}
                      onPress={() => router.push('/savings/archive')}
                      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text variant="bodyStrong" tone="muted" style={{ flex: 1 }}>
                        {t('savings.archivesLink', { count: archived.goals.length })}
                      </Text>
                      <Icon name="chevronRight" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </>
              )
            }
          </ModeTransition>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 12 }}>
        <ModeTransition mode={modeKey}>
          {(shown, changing) =>
            shown === 'reorder' ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button label={t('common.cancel')} variant="secondary" disabled={changing} onPress={cancelReorder} style={{ flex: 1 }} />
                <Button label={t('savings.reorder.done')} icon="check" disabled={changing} onPress={finishReorder} style={{ flex: 1 }} />
              </View>
            ) : (
              <Button label={t('savings.create')} icon="createPlus" disabled={changing} onPress={() => setCreating(true)} />
            )
          }
        </ModeTransition>
      </View>

      <GoalSheet
        visible={creating}
        goal={null}
        today={today}
        onClose={() => setCreating(false)}
        onSaved={(result) => {
          setCreating(false);
          toast.show({ message: t('savings.goal.created', { name: result.name }) });
        }}
      />
      <GoalSheet
        visible={editing !== null}
        goal={editing}
        today={today}
        onClose={() => setEditing(null)}
        onSaved={(result) => {
          setEditing(null);
          toast.show({ message: t('savings.goal.updated', { name: result.name }) });
        }}
      />
      <MovementSheet
        visible={adding !== null}
        goal={adding}
        kind="deposit"
        today={today}
        onClose={() => setAdding(null)}
        onSaved={movementSaved}
        onCancelled={() => setAdding(null)}
      />

      <MorphingPopover
        anchor={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        onReopen={setMenuAnchor}
        mode="beside"
        accessibilityLabel={t('savings.menu')}
        items={menuItems}
      />

      <ConfirmDialog
        visible={archiving !== null}
        tone="neutral"
        title={t('savings.detail.archiveTitle')}
        confirmIcon="archive"
        cancelLabel={t('common.cancel')}
        confirmLabel={t('savings.detail.archiveConfirm')}
        onCancel={() => setArchiving(null)}
        onConfirm={confirmArchive}>
        <ConfirmNote
          name={archiving?.name ?? ''}
          text={archiveFailed ? t('savings.detail.actionFailed') : t('savings.detail.archiveText')}
          failed={archiveFailed}
        />
      </ConfirmDialog>

      <ConfirmDialog
        visible={discarding}
        title={t('savings.reorder.discardTitle')}
        icon="back"
        confirmIcon="check"
        cancelLabel={t('savings.reorder.discardKeep')}
        confirmLabel={t('savings.reorder.discardConfirm')}
        onCancel={() => setDiscarding(false)}
        onConfirm={cancelReorder}>
        <Text variant="body" tone="muted">
          {t('savings.reorder.discardText')}
        </Text>
      </ConfirmDialog>
    </AppScreen>
  );
}
