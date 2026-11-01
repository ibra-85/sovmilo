import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatMonthLabel, recentMonths } from '@/domain/dates';
import { useSelectedMonth } from '@/hooks/use-selected-month';
import { useLocale } from '@/i18n/use-locale';
import { radius, sizes, touchSlop } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { MorphingPopover, usePopoverTrigger } from './morphing-popover';
import { Icon } from './icon';
import { Pressable } from './pressable';
import { Text } from './text';

/** Nombre de mois proposés : le mois en cours et les onze précédents (la plage n'est pas définie par le design). */
const MONTH_CHOICES = 12;

/**
 * Sélecteur de période (design « PeriodSelector ») : pastille de 40 dp avec calendrier, « Octobre 2026 » et chevron.
 * Le design ne dessine que le déclencheur ; le panneau de choix est un menu déroulant vitré (PROPOSITION) qui liste les
 * douze derniers mois. Le mois choisi est partagé par Accueil, Opérations et Budgets (`useSelectedMonth`).
 */
export function PeriodSelector() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors, shadows } = useTheme();
  const { month, currentMonth, setMonth } = useSelectedMonth();
  const { bindTrigger, coverStyle, anchor: menuAnchor, open: openMenu, close: closeMenu, reopen: reopenMenu, isOpen: menuOpen } = usePopoverTrigger();

  const choices = useMemo(() => {
    const months = recentMonths(currentMonth, MONTH_CHOICES);
    return months.includes(month) ? months : [...months, month];
  }, [currentMonth, month]);

  const label = formatMonthLabel(month, locale);

  // Contenu de la pastille, partagé avec le popover : il s'y efface à l'identique pendant que le menu apparaît.
  const pillContent = (
    <>
      <Icon name="calendar" size={18} />
      <Text variant="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Icon name="chevronDown" size={16} color={colors.textMuted} />
    </>
  );

  return (
    <>
      <View ref={bindTrigger} collapsable={false} style={coverStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('period.a11y', { month: label })}
          accessibilityState={{ expanded: menuOpen }}
          hitSlop={touchSlop(sizes.minTouch, 40)}
          pressTranslate={0}
          onPress={openMenu}
          style={({ pressed }) => ({
            height: 40,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            borderRadius: radius.pill,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            boxShadow: shadows.tile,
          })}>
          {pillContent}
        </Pressable>
      </View>

      <MorphingPopover
        anchor={menuAnchor}
        onClose={closeMenu}
        onReopen={reopenMenu}
        accessibilityLabel={t('period.menu')}
        triggerContent={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{pillContent}</View>}
        items={choices.map((choice) => ({
          key: choice,
          label: formatMonthLabel(choice, locale),
          selected: choice === month,
          onPress: () => setMonth(choice),
        }))}
      />
    </>
  );
}
