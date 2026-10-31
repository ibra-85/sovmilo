import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  BottomSheet,
  Button,
  CategoryIcon,
  ConfirmDialog,
  Icon,
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
 * Supprimer : confirmation explicite ; si la catégorie a des opérations ou des budgets, RIEN n'est supprimé et le panneau
 * explique pourquoi (la stratégie — réaffecter, archiver, bloquer — reste à décider, voir `domain/category-usage.ts`).
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
  const [blocked, setBlocked] = useState<CategoryUsage | null>(null);
  const [failed, setFailed] = useState(false);

  const name = target ? categoryLabel(target, t) : '';

  function open(category: Category, at: PopoverAnchor) {
    if (!isCustomCategory(category)) return;
    setTarget(category);
    setFailed(false);
    setAnchor(at);
  }

  function startDelete() {
    if (!target) return;
    const verdict = checkCategoryDeletion(target.id);
    if (verdict.allowed) setConfirming(true);
    else if (verdict.reason === 'in-use') setBlocked(verdict.usage);
  }

  function confirmDelete() {
    if (!target) return;
    try {
      const verdict = deleteCategory(target.id);
      if (verdict.allowed) {
        setConfirming(false);
        toast.show({ message: t('categoryManager.deleted', { name }) });
        onDeleted?.(target.id);
      } else if (verdict.reason === 'in-use') {
        setConfirming(false);
        setBlocked(verdict.usage);
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
        visible={blocked !== null}
        onClose={() => setBlocked(null)}
        accessibilityLabel={t('categoryManager.blockedTitle')}>
        <View style={{ gap: 12 }}>
          <Icon name="nearLimit" size={26} />
          <Text variant="titleSheet" accessibilityRole="header">
            {t('categoryManager.blockedTitle')}
          </Text>
          <Text variant="body">{t('categoryManager.blockedIntro', { name })}</Text>
          {blocked && (
            <View style={{ gap: 4 }}>
              {blocked.transactions > 0 && (
                <Text variant="bodyStrong">{`• ${t('categoryManager.usageTransactions', { count: blocked.transactions })}`}</Text>
              )}
              {blocked.budgets > 0 && (
                <Text variant="bodyStrong">{`• ${t('categoryManager.usageBudgets', { count: blocked.budgets })}`}</Text>
              )}
            </View>
          )}
          <Text variant="secondary" tone="muted">
            {t('categoryManager.blockedNote')}
          </Text>
          <Button label={t('categoryManager.understood')} variant="secondary" onPress={() => setBlocked(null)} />
        </View>
      </BottomSheet>
    </>
  );

  return { open, element };
}
