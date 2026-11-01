import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AmountText,
  AppScreen,
  Button,
  ConfirmDialog,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  MorphingPopover,
  ScreenHeader,
  Surface,
  Text,
  useToast,
  usePopoverTrigger,
} from '@/components/ui';
import type { ShoppingItem } from '@/db/schema';
import { formatMoney } from '@/domain/money';
import { useMotion } from '@/hooks/use-motion';
import { useLocale } from '@/i18n/use-locale';
import { radius, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { ItemSheet } from './item-sheet';
import { ShoppingItemRow } from './item-row';
import { ListNameSheet } from './list-name-sheet';
import { deleteItem, deleteList, restoreItem, setItemChecked } from './repository';
import { useShoppingItems, useShoppingList } from './use-shopping';

/** Une notification qui propose « Annuler » doit rester assez longtemps pour qu'on ait le temps de la lire et de la toucher. */
const UNDO_DURATION_MS = 6000;

/**
 * Détail d'une liste de courses : articles à acheter, puis articles déjà pris (toujours visibles, jamais supprimés
 * automatiquement, on peut les décocher). Un grand bouton « Ajouter un article » reste en bas de l'écran. Le total estimé ne
 * compte que les articles QUI RESTENT à acheter et qui ont un prix ; s'il manque des prix, l'écran le dit. Rien ici ne crée
 * d'opération et ne touche au solde ni aux budgets.
 */
export function ShoppingListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();
  const { colors } = useTheme();
  const { timing } = useMotion();
  const fadeMs = timing('enter', 'menuItemIn', 'fade').duration ?? 0;
  const window = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const listId = id ?? '';

  const list = useShoppingList(listId);
  const { todo, done, total, remaining, estimate } = useShoppingItems(listId);
  const { bindTrigger, coverStyle, anchor: menuAnchor, open: openMenu, close: closeMenu, reopen: reopenMenu, isOpen: menuOpen } = usePopoverTrigger();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/shopping');
  }, [router]);

  const toggle = useCallback(
    (item: ShoppingItem, checked: boolean) => {
      try {
        setItemChecked(item.id, checked);
      } catch (error) {
        toast.show({ message: t('shopping.errors.saveFailed') });
        throw error;
      }
    },
    [toast, t],
  );

  const back = (title: string) => <ScreenHeader title={title} onBack={close} backLabel={t('shopping.backToLists')} />;

  if (leaving) return <AppScreen bottomInset>{back(t('shopping.title'))}</AppScreen>;

  if (!list) {
    return (
      <AppScreen bottomInset>
        {back(t('shopping.title'))}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.screen }}>
          <EmptyState icon="cart" title={t('shopping.listNotFound')} />
          <Button label={t('shopping.backToLists')} variant="secondary" onPress={close} />
        </View>
      </AppScreen>
    );
  }

  function removeItem(item: ShoppingItem) {
    try {
      deleteItem(item.id);
    } catch {
      toast.show({ message: t('shopping.errors.deleteFailed') });
      return;
    }
    setEditing(null);
    toast.show({
      message: t('shopping.itemDeleted', { name: item.name }),
      actionLabel: t('edit.undo'),
      onAction: () => {
        try {
          restoreItem(item.id);
        } catch {
          toast.show({ message: t('shopping.errors.saveFailed') });
        }
      },
      durationMs: UNDO_DURATION_MS,
    });
  }

  function confirmDeleteList() {
    if (!list) return;
    try {
      deleteList(list.id);
    } catch {
      setDeleteFailed(true);
      return;
    }
    const name = list.name;
    setConfirming(false);
    setLeaving(true);
    close();
    toast.show({ message: t('shopping.listDeleted', { name }) });
  }

  const statusText =
    total === 0 ? t('shopping.listEmpty') : remaining === 0 ? t('shopping.listAllDone') : t('shopping.listRemaining', { count: remaining });
  const estimateWidth = window.width - 2 * space.screen - 32;
  // Trois états distincts : liste jamais remplie (total = 0), articles restants, tout est pris.
  const allDone = total > 0 && remaining === 0;

  return (
    <AppScreen bottomInset>
      <ScreenHeader
        title={list.name}
        onBack={close}
        backLabel={t('shopping.backToLists')}
        trailing={
          <View ref={bindTrigger} collapsable={false} style={coverStyle}>
            <IconButton icon="more" label={t('shopping.moreActions')} expanded={menuOpen} onPress={openMenu} />
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 8, paddingBottom: 24, gap: 20 }}>
        {allDone ? (
          // Tout est pris : une seule ligne compacte et positive (pas de grande zone vide), les articles pris juste en dessous.
          <Animated.View
            entering={FadeIn.duration(fadeMs)}
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}>
            <View
              style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successBg }}>
              <Icon name="check" size={16} color={colors.successIcon} weight="strong" />
            </View>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {t('shopping.allDoneTitle')}
            </Text>
          </Animated.View>
        ) : (
          <Text variant="secondaryStrong" tone="muted" accessibilityLiveRegion="polite">
            {statusText}
          </Text>
        )}

        {estimate.pricedCount > 0 && (
          <Surface
            radiusToken="group"
            accessible
            accessibilityLabel={t('shopping.estimateA11y', { amount: formatMoney(estimate.cents, locale) })}
            accessibilityHint={t('shopping.estimateHint')}
            style={{ padding: 16, gap: 4 }}>
            <Text variant="caption" tone="muted">
              {t('shopping.estimateLabel')}
            </Text>
            <AmountText cents={estimate.cents} size="total" maxWidth={estimateWidth} align="left" />
            {estimate.partial && (
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {t('shopping.estimatePartial', { count: estimate.unpricedCount })}
              </Text>
            )}
          </Surface>
        )}

        {total === 0 && <EmptyState icon="cart" title={t('shopping.emptyListTitle')} text={t('shopping.emptyListText')} />}

        {todo.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text variant="titleSection" accessibilityRole="header">
              {t('shopping.toBuyTitle')}
            </Text>
            <ItemGroup items={todo} onToggle={toggle} onEdit={setEditing} />
          </View>
        )}

        {done.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text variant="titleSection" tone="muted" accessibilityRole="header">
              {t('shopping.doneTitle', { count: done.length })}
            </Text>
            <ItemGroup items={done} onToggle={toggle} onEdit={setEditing} />
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 12 }}>
        <Button label={t('shopping.addItem')} icon="createPlus" onPress={() => setAdding(true)} />
      </View>

      <ItemSheet visible={adding} listId={list.id} onClose={() => setAdding(false)} />
      <ItemSheet
        visible={editing !== null}
        listId={list.id}
        item={editing ?? undefined}
        onClose={() => setEditing(null)}
        onDelete={removeItem}
      />
      <ListNameSheet
        visible={renaming}
        list={list}
        onClose={() => setRenaming(false)}
        onRenamed={() => setRenaming(false)}
      />

      <MorphingPopover
        anchor={menuAnchor}
        onClose={closeMenu}
        onReopen={reopenMenu}
        anchorRadius={radius.iconButton}
        triggerContent={<Icon name="more" size={22} color={colors.ink} />}
        accessibilityLabel={t('shopping.menu')}
        items={[
          {
            key: 'rename',
            icon: 'note',
            label: t('shopping.rename'),
            accessibilityLabel: t('shopping.renameA11y'),
            onPress: () => {
              closeMenu();
              setRenaming(true);
            },
          },
          {
            key: 'delete',
            icon: 'trash',
            label: t('shopping.delete'),
            accessibilityLabel: t('shopping.deleteA11y', { name: list.name }),
            destructive: true,
            onPress: () => {
              closeMenu();
              setDeleteFailed(false);
              setConfirming(true);
            },
          },
        ]}
      />

      <ConfirmDialog
        visible={confirming}
        title={t('shopping.deleteTitle')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('shopping.deleteConfirm')}
        onCancel={() => setConfirming(false)}
        onConfirm={confirmDeleteList}>
        <View style={{ padding: 12, borderRadius: radius.group, backgroundColor: colors.surfaceMuted, gap: 2 }}>
          <Text variant="body" numberOfLines={3}>
            {list.name}
          </Text>
          <Text variant="caption" tone={deleteFailed ? 'danger' : 'muted'} accessibilityLiveRegion="polite">
            {deleteFailed ? t('shopping.errors.deleteFailed') : total === 0 ? t('shopping.deleteEmptyText') : t('shopping.deleteText', { count: total })}
          </Text>
        </View>
      </ConfirmDialog>
    </AppScreen>
  );
}

interface ItemGroupProps {
  items: ShoppingItem[];
  onToggle: (item: ShoppingItem, checked: boolean) => void;
  onEdit: (item: ShoppingItem) => void;
}

/** Lignes d'une section sur une même surface, séparées par un filet qui commence après la case à cocher. */
function ItemGroup({ items, onToggle, onEdit }: ItemGroupProps) {
  return (
    <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
      {items.map((item, index) => (
        <View key={item.id}>
          {index > 0 && <Divider inset={56} />}
          <ShoppingItemRow item={item} onToggle={onToggle} onEdit={onEdit} />
        </View>
      ))}
    </Surface>
  );
}
