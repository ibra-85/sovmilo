import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useState } from 'react';

import { AppScreen, Button, DataRefreshControl, Divider, EmptyState, Icon, Pressable, ScreenHeader, Surface, Text } from '@/components/ui';
import type { ShoppingList } from '@/db/schema';
import { space, sizes, radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';
import { useDataRefresh } from '@/hooks/use-data-refresh';

import { ListNameSheet } from './list-name-sheet';
import { useListCounts, useShoppingLists } from './use-shopping';

/**
 * Services → Courses : toutes les listes, dans l'ordre de création, avec ce qu'il reste à acheter dans chacune. Aucune liste
 * n'est créée d'office (pas de fausses données) : tant qu'il n'y en a pas, un écran vide invite à en créer une. Les listes
 * n'ont aucun lien avec les opérations, le solde ou les budgets.
 */
export function ShoppingListsScreen() {
  // Tirer pour actualiser : relit les listes et leurs compteurs depuis SQLite (aucune liste ni article créé ou modifié).
  const { refreshing, onRefresh } = useDataRefresh();
  const { t } = useTranslation();
  const router = useRouter();
  const lists = useShoppingLists();
  const { remaining, total } = useListCounts();
  const [creating, setCreating] = useState(false);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }

  function open(id: string) {
    router.push({ pathname: '/shopping/[id]', params: { id } });
  }

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={t('shopping.title')} onBack={close} backLabel={t('shopping.back')} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<DataRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 14, paddingBottom: 24, gap: 16, flexGrow: 1 }}>
        {lists.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="cart" title={t('shopping.emptyTitle')} text={t('shopping.emptyText')} />
          </View>
        ) : (
          <>
            <Text variant="secondary" tone="muted">
              {t('shopping.help')}
            </Text>
            <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
              {lists.map((list, index) => (
                <View key={list.id}>
                  {index > 0 && <Divider inset={space.fieldDividerInset} />}
                  <ListRow list={list} remaining={remaining.get(list.id) ?? 0} total={total.get(list.id) ?? 0} onPress={() => open(list.id)} />
                </View>
              ))}
            </Surface>
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: space.screen, paddingTop: 12, paddingBottom: 12 }}>
        <Button label={t('shopping.newList')} icon="createPlus" onPress={() => setCreating(true)} />
      </View>

      <ListNameSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          open(id);
        }}
      />
    </AppScreen>
  );
}

interface ListRowProps {
  list: ShoppingList;
  remaining: number;
  total: number;
  onPress: () => void;
}

/** Ligne de liste : icône, nom (deux lignes au plus), ce qu'il reste à acheter, chevron. */
function ListRow({ list, remaining, total, onPress }: ListRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = total === 0 ? t('shopping.listEmpty') : remaining > 0 ? t('shopping.listRemaining', { count: remaining }) : t('shopping.listAllDone');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('shopping.listA11y', { name: list.name, status })}
      pressTranslate={0}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : 'transparent' })}>
      <View
        style={{
          minHeight: space.fieldMinHeight,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.gutter,
          paddingHorizontal: space.gutter,
          paddingVertical: 10,
        }}>
        <View
          style={{
            width: sizes.fieldIcon,
            height: sizes.fieldIcon,
            borderRadius: radius.iconPad,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
          }}>
          <Icon name="cart" size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {list.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {status}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}
