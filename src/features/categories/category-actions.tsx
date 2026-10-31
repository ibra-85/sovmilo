import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  BottomSheet,
  Button,
  CategoryIcon,
  ChoiceGroup,
  ConfirmDialog,
  MorphingPopover,
  Text,
  useToast,
  type PopoverAnchor,
} from '@/components/ui';
import type { Category } from '@/db/schema';
import { isCustomCategory, type CategoryUsage } from '@/domain/category-usage';
import type { CategoryKind } from '@/domain/types';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { categoryLabel } from './category-label';
import { NewCategorySheet } from './new-category-sheet';
import { checkCategoryDeletion, deleteCategory } from './repository';
import { useCategories } from './use-categories';

interface CategoryActions {
  /** Ouvre le menu Modifier / Supprimer d'une catégorie personnalisée, ancré sur `anchor`. Sans effet pour une catégorie par défaut. */
  open: (category: Category, anchor: PopoverAnchor) => void;
  /** À poser une fois dans l'écran : menu, panneau de modification et confirmations. */
  element: ReactNode;
}

/**
 * Gestion d'une catégorie personnalisée, partagée par le carrousel des formulaires (appui long) et par Services →
 * Catégories (bouton ⋯) : un seul menu, un seul panneau de modification, une seule confirmation.
 *
 * Modifier : le panneau « Nouvelle catégorie » prérempli ; l'identifiant ne change pas, donc opérations et budgets suivent.
 * Supprimer : confirmation explicite. Si la catégorie a des opérations, un panneau demande vers quelle catégorie du même
 * type les déplacer et annonce ce qui va se passer (nombre d'opérations déplacées, de budgets retirés) ; rien ne bouge avant
 * le bouton « Déplacer et supprimer », et tout se fait en une seule transaction (voir `repository.ts`).
 * `onDeleted` reçoit l'identifiant supprimé (un formulaire y retire sa sélection).
 */
export function useCategoryActions(kind: CategoryKind, onDeleted?: (id: string) => void): CategoryActions {
  const { t } = useTranslation();
  const toast = useToast();
  const { colors } = useTheme();

  const [target, setTarget] = useState<Category | null>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reassign, setReassign] = useState<CategoryUsage | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const siblings = useCategories(kind);
  const [failed, setFailed] = useState(false);

  const name = target ? categoryLabel(target, t) : '';
  const candidates = siblings.filter((other) => other.id !== target?.id);
  const chosen = candidates.find((other) => other.id === targetId);

  function open(category: Category, at: PopoverAnchor) {
    if (!isCustomCategory(category)) return;
    setTarget(category);
    setFailed(false);
    setAnchor(at);
  }

  function startDelete() {
    if (!target) return;
    const verdict = checkCategoryDeletion(target.id);
    if (verdict.allowed) {
      setConfirming(true);
    } else if (verdict.reason === 'in-use') {
      setTargetId(null);
      setFailed(false);
      setReassign(verdict.usage);
    }
  }

  function finishDeletion(message: string) {
    if (!target) return;
    toast.show({ message });
    onDeleted?.(target.id);
  }

  function confirmDelete() {
    if (!target) return;
    try {
      const verdict = deleteCategory(target.id);
      if (verdict.allowed) {
        setConfirming(false);
        finishDeletion(t('categoryManager.deleted', { name }));
      } else if (verdict.reason === 'in-use') {
        // La catégorie a été utilisée entre-temps (écran périmé) : on passe au déplacement.
        setConfirming(false);
        setTargetId(null);
        setReassign(verdict.usage);
      }
    } catch {
      setFailed(true);
    }
  }

  function confirmReassign() {
    if (!target || !reassign) return;
    if (reassign.transactions > 0 && !chosen) return;
    try {
      const verdict = deleteCategory(target.id, chosen?.id);
      if (verdict.allowed) {
        setReassign(null);
        finishDeletion(t('categoryManager.reassigned', { name }));
      }
    } catch {
      setFailed(true);
    }
  }

  const element = (
    <>
      <MorphingPopover
        anchor={anchor}
        onClose={() => setAnchor(null)}
        accessibilityLabel={t('categoryManager.menu')}
        anchorRadius={radius.tile}
        items={[
          { key: 'edit', icon: 'note', label: t('categoryManager.edit'), onPress: () => setEditing(true) },
          { key: 'delete', icon: 'trash', label: t('categoryManager.delete'), destructive: true, onPress: startDelete },
        ]}
      />

      <NewCategorySheet
        visible={editing}
        kind={kind}
        category={target ?? undefined}
        onClose={() => setEditing(false)}
        onSaved={(_id, savedName) => {
          setEditing(false);
          toast.show({ message: t('category.updated', { name: savedName }) });
        }}
      />

      <ConfirmDialog
        visible={confirming}
        title={t('categoryManager.deleteTitle')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('categoryManager.deleteConfirm')}
        onCancel={() => {
          setConfirming(false);
          setFailed(false);
        }}
        onConfirm={confirmDelete}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: radius.group,
            backgroundColor: colors.surfaceMuted,
          }}>
          {target && <CategoryIcon value={target.icon} size={24} />}
          <View style={{ flex: 1 }}>
            <Text variant="body" numberOfLines={2}>
              {name}
            </Text>
            <Text variant="caption" tone={failed ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
              {failed ? t('categoryManager.deleteFailed') : t('categoryManager.deleteText')}
            </Text>
          </View>
        </View>
      </ConfirmDialog>

      <BottomSheet
        visible={reassign !== null}
        onClose={() => setReassign(null)}
        accessibilityLabel={t('categoryManager.reassignTitle')}>
        <View style={{ gap: 12 }}>
          <Text variant="titleSheet" accessibilityRole="header">
            {t('categoryManager.reassignTitle')}
          </Text>
          <Text variant="body">{t('categoryManager.reassignIntro', { name })}</Text>
          {reassign && (
            <View style={{ gap: 4 }}>
              {reassign.transactions > 0 && (
                <Text variant="bodyStrong">{`• ${t('categoryManager.usageTransactions', { count: reassign.transactions })}`}</Text>
              )}
              {reassign.budgets > 0 && (
                <Text variant="bodyStrong">{`• ${t('categoryManager.usageBudgets', { count: reassign.budgets })}`}</Text>
              )}
            </View>
          )}

          {reassign && reassign.transactions > 0 && (
            <>
              <Text variant="label">{t('categoryManager.reassignPick')}</Text>
              {candidates.length === 0 ? (
                <Text variant="secondary" tone="muted">
                  {t('categoryManager.reassignNoTarget')}
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 232 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  <ChoiceGroup<string>
                    accessibilityLabel={t('categoryManager.reassignPick')}
                    value={targetId ?? ''}
                    onChange={setTargetId}
                    options={candidates.map((other) => ({ value: other.id, label: categoryLabel(other, t) }))}
                  />
                </ScrollView>
              )}
            </>
          )}

          {reassign && (chosen || reassign.transactions === 0) && (
            <View style={{ gap: 2 }} accessibilityLiveRegion="polite">
              {reassign.transactions > 0 && chosen && (
                <Text variant="secondary" tone="muted">
                  {t('categoryManager.reassignMove', { count: reassign.transactions, target: categoryLabel(chosen, t) })}
                </Text>
              )}
              {reassign.budgets > 0 && (
                <Text variant="secondary" tone="muted">
                  {t('categoryManager.reassignDrop', { count: reassign.budgets })}
                </Text>
              )}
            </View>
          )}

          {failed && (
            <Text variant="secondary" tone="danger" accessibilityLiveRegion="polite">
              {t('categoryManager.reassignFailed')}
            </Text>
          )}

          <Button
            label={t('categoryManager.reassignAction')}
            icon="trash"
            variant="destructive"
            disabled={!reassign || (reassign.transactions > 0 && !chosen)}
            onPress={confirmReassign}
          />
          <Button label={t('common.cancel')} variant="secondary" onPress={() => setReassign(null)} />
        </View>
      </BottomSheet>
    </>
  );

  return { open, element };
}
