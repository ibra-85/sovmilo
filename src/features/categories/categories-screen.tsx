import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  AppScreen,
  Button,
  CategoryIcon,
  Divider,
  EmptyState,
  IconButton,
  ScreenHeader,
  SegmentedControl,
  Surface,
  Text,
  useAnchorMeasure,
  useToast,
  type PopoverAnchor,
} from '@/components/ui';
import type { Category } from '@/db/schema';
import { isCustomCategory } from '@/domain/category-usage';
import type { CategoryKind } from '@/domain/types';
import { radius, sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { useCategoryActions } from './category-actions';
import { categoryLabel } from './category-label';
import { NewCategorySheet } from './new-category-sheet';
import { useCategories } from './use-categories';

/**
 * Services → Catégories : toutes les catégories d'un type, créer une catégorie, modifier ou supprimer les catégories
 * PERSONNALISÉES (bouton ⋯ de la ligne). Les catégories par défaut sont listées avec la mention « Par défaut » et n'ont
 * pas d'actions : elles ne se modifient ni ne se suppriment. Les règles de suppression sont dans `category-actions.tsx`.
 */
export function CategoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();

  const [kind, setKind] = useState<CategoryKind>('expense');
  const [creating, setCreating] = useState(false);
  const categories = useCategories(kind);
  const actions = useCategoryActions(kind);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/more');
  }

  return (
    <AppScreen bottomInset>
      <ScreenHeader title={t('categoryManager.title')} onBack={close} backLabel={t('categoryManager.back')} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.screen, paddingTop: 14, paddingBottom: 32, gap: 16 }}
        showsVerticalScrollIndicator={false}>
        <SegmentedControl<CategoryKind>
          accessibilityLabel={t('categoryManager.kindLabel')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: t('history.filterExpenses') },
            { value: 'income', label: t('history.filterIncome') },
          ]}
        />

        <Text variant="secondary" tone="muted">
          {t('categoryManager.help')}
        </Text>

        <Button label={t('category.create')} icon="createPlus" variant="secondary" onPress={() => setCreating(true)} />

        {categories.length === 0 ? (
          <EmptyState icon="tag" title={t('categoryManager.empty')} />
        ) : (
          <Surface radiusToken="group" style={{ overflow: 'hidden' }}>
            {categories.map((category, index) => (
              <View key={category.id}>
                {index > 0 && <Divider inset={space.fieldDividerInset} />}
                <CategoryManagerRow category={category} onOpenMenu={actions.open} />
              </View>
            ))}
          </Surface>
        )}
      </ScrollView>

      <NewCategorySheet
        visible={creating}
        kind={kind}
        onClose={() => setCreating(false)}
        onCreated={(_id, name) => {
          setCreating(false);
          toast.show({ message: t('category.created', { name }) });
        }}
      />
      {actions.element}
    </AppScreen>
  );
}

interface CategoryManagerRowProps {
  category: Category;
  onOpenMenu: (category: Category, anchor: PopoverAnchor) => void;
}

/** Ligne de catégorie : icône, nom (deux lignes au plus), « Par défaut » ou bouton ⋯ pour une catégorie personnalisée. */
function CategoryManagerRow({ category, onOpenMenu }: CategoryManagerRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { bind, measure } = useAnchorMeasure();
  const custom = isCustomCategory(category);
  const name = categoryLabel(category, t);

  return (
    <View
      accessible={!custom}
      accessibilityLabel={custom ? undefined : `${name}, ${t('categoryManager.default')}`}
      style={{
        minHeight: space.fieldMinHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.gutter,
        paddingLeft: space.gutter,
        paddingRight: custom ? 8 : space.gutter,
        paddingVertical: 8,
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
        <CategoryIcon value={category.icon} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={2}>
          {name}
        </Text>
        <Text variant="caption" tone="muted">
          {custom ? t('categoryManager.custom') : t('categoryManager.default')}
        </Text>
      </View>
      {custom && (
        <View ref={bind} collapsable={false}>
          <IconButton
            icon="more"
            label={t('categoryManager.moreActions', { name })}
            onPress={() => measure((anchor) => onOpenMenu(category, anchor))}
          />
        </View>
      )}
    </View>
  );
}
