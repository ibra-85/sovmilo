import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AmountText, Icon, Pressable, Text } from '@/components/ui';
import type { ShoppingItem } from '@/db/schema';
import { formatMoney } from '@/domain/money';
import { lineTotalCents } from '@/domain/shopping';
import { useMotion } from '@/hooks/use-motion';
import { useLocale } from '@/i18n/use-locale';
import { useTheme } from '@/theme/use-theme';

import { formatItemDetails } from './format';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem, checked: boolean) => void;
  onEdit: (item: ShoppingItem) => void;
}

const CHECK_SIZE = 28;
/** Zone tactile de la case : 56 dp de large et de haut (la ligne fait au moins cette hauteur). */
const CHECK_ZONE = 56;

/**
 * Ligne d'article, compacte : case à cocher (zone tactile de 56 dp), nom (trois lignes au plus), quantité et prix unitaire en
 * légende, total de la ligne à droite s'il y a un prix. Toucher la case coche / décoche ; toucher le reste de la ligne ouvre la
 * modification (la suppression est dans ce panneau : aucune action cachée derrière un geste).
 *
 * Réactivité : la case change d'état à l'instant du toucher (état local « optimiste », animé sur le thread UI en ~100 ms) ; la
 * base est écrite dans le même geste, et la ligne change de section dès que la requête en direct répond. Si l'écriture échoue,
 * l'état local est annulé par l'écran (`onToggle` lève une erreur).
 */
function ShoppingItemRowBase({ item, onToggle, onEdit }: ShoppingItemRowProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();
  const { timing } = useMotion();

  // État affiché = intention locale tant que la base n'a pas encore rattrapé l'écran (même valeur de départ), sinon la base.
  const [pending, setPending] = useState<{ value: boolean; base: boolean } | null>(null);
  const checked = pending !== null && pending.base === item.checked ? pending.value : item.checked;

  const progress = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, timing('standard', 'press', 'fade'));
  }, [checked, progress, timing]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.55 + 0.45 * progress.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: 1 - 0.45 * progress.value }));

  function toggle() {
    const next = !checked;
    setPending({ value: next, base: item.checked });
    try {
      onToggle(item, next);
    } catch {
      setPending(null);
    }
  }

  const details = formatItemDetails(item, locale, t);
  const total = lineTotalCents(item);
  const label = total === null ? `${item.name}, ${details}` : `${item.name}, ${details}, ${formatMoney(total, locale)}`;

  return (
    <View style={{ minHeight: CHECK_ZONE, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={item.name}
        accessibilityState={{ checked }}
        pressTranslate={0}
        onPress={toggle}
        style={{ width: CHECK_ZONE, minHeight: CHECK_ZONE, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: CHECK_SIZE,
            height: CHECK_SIZE,
            borderRadius: CHECK_SIZE / 2,
            borderWidth: 2,
            borderColor: checked ? colors.primary : colors.textMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -2,
                left: -2,
                width: CHECK_SIZE,
                height: CHECK_SIZE,
                borderRadius: CHECK_SIZE / 2,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              },
              fillStyle,
            ]}>
            <Icon name="check" size={16} color={colors.onPrimary} weight="strong" />
          </Animated.View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('shopping.editHint')}
        pressTranslate={0}
        onPress={() => onEdit(item)}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          alignSelf: 'stretch',
          paddingVertical: 8,
          paddingRight: 16,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}>
        <Animated.View style={[{ flex: 1 }, textStyle]}>
          <Text variant="body" numberOfLines={3} style={checked ? { textDecorationLine: 'line-through' } : undefined}>
            {item.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {details}
          </Text>
        </Animated.View>
        {total !== null && (
          <View style={{ maxWidth: '42%', flexShrink: 0 }}>
            <AmountText cents={total} size="row" tone={checked ? 'muted' : 'default'} align="right" />
          </View>
        )}
      </Pressable>
    </View>
  );
}

/**
 * Les lignes viennent d'une requête en direct : chaque réponse recrée les objets. On compare donc les champs affichés, pas les
 * références, pour que cocher un article ne refasse le rendu que de cet article.
 */
export const ShoppingItemRow = memo(
  ShoppingItemRowBase,
  (previous, next) =>
    previous.item.id === next.item.id &&
    previous.item.updatedAt === next.item.updatedAt &&
    previous.item.checked === next.item.checked &&
    previous.onToggle === next.onToggle &&
    previous.onEdit === next.onEdit,
);
