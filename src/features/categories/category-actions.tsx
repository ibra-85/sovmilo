import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Button,
  CategoryIcon,
  ChoiceGroup,
  ConfirmDialog,
  MorphingPopover,
  Text,
  useToast,
  type PopoverAlign,
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
  open: (category: Category, anchor: PopoverAnchor, align?: PopoverAlign) => void;
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
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [target, setTarget] = useState<Category | null>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [align, setAlign] = useState<PopoverAlign>('end');
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reassign, setReassign] = useState<CategoryUsage | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const siblings = useCategories(kind);
  const [failed, setFailed] = useState(false);

  const name = target ? categoryLabel(target, t) : '';
  // Hauteur de la zone défilante du panneau de déplacement : l'écran, moins les zones système, la poignée et le haut du
  // panneau (≈ 96 dp), et la partie fixe du bas (deux boutons ≈ 144 dp + le texte des conséquences, qui grandit avec le texte).
  const fixedBottom = 144 + 96 * Math.min(window.fontScale, 1.8);
  const scrollMax = Math.max(160, window.height - insets.top - insets.bottom - 96 - fixedBottom);
  const candidates = siblings.filter((other) => other.id !== target?.id);
  const chosen = candidates.find((other) => other.id === targetId);

  function open(category: Category, at: PopoverAnchor, alignment: PopoverAlign = 'end') {
    if (!isCustomCategory(category)) return;
    setTarget(category);
    setAlign(alignment);
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
        align={align}
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
          {/* Zone défilante : titre, contenu de la catégorie et choix. Elle est bornée à la hauteur de l'écran (moins les
              zones système et la partie fixe du bas), donc les boutons restent TOUJOURS visibles, même avec 30 catégories de
              remplacement, des noms très longs, le texte agrandi ou le russe. */}
          <ScrollView style={{ maxHeight: scrollMax }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                    <ChoiceGroup<string>
                      accessibilityLabel={t('categoryManager.reassignPick')}
                      value={targetId ?? ''}
                      onChange={setTargetId}
                      options={candidates.map((other) => ({ value: other.id, label: categoryLabel(other, t) }))}
                    />
                  )}
                </>
              )}
            </View>
          </ScrollView>

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
