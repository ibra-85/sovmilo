import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { formatMoney, formatMoneyParts } from '@/domain/money';
import { useMotion } from '@/hooks/use-motion';
import { useLocale } from '@/i18n/use-locale';
import { chartTokens } from '@/theme/chart';
import { radius } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { AmountText } from './amount-text';
import { Surface } from './surface';
import { Text } from './text';

export interface WeeklyChartBar {
  /** « 1–7 oct. » : tranche de dates affichée sous la barre. */
  label: string;
  cents: number;
}

interface WeeklyChartProps {
  bars: readonly WeeklyChartBar[];
  /** Indice de la semaine en cours (mise en avant), ou null quand le mois affiché n'est pas le mois en cours. */
  currentIndex: number | null;
  totalCents: number;
}

const PLOT_HEIGHT = 128;
const BAR_WIDTH = 38;
const CURRENT_BAR_WIDTH = 44;
const MIN_BAR_HEIGHT = 8;

/**
 * Graphique « Dépenses par semaine » (design « ChartBar ») : quatre barres arrondies aux deux bouts, dégradé léger ;
 * celle de la semaine en cours est plus large, de la couleur d'action (citron en sombre, graphite en clair) avec un
 * anneau, un repère rond et une étiquette. Les barres poussent depuis la base en 400 ms avec 40 ms de décalage, une
 * seule fois ; animations réduites : valeurs affichées tout de suite. Les montants sont arrondis à l'euro
 * (PROPOSITION du design). Résumé textuel pour TalkBack : le dessin seul ne dit rien.
 */
export function WeeklyChart({ bars, currentIndex, totalCents }: WeeklyChartProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();

  const max = Math.max(...bars.map((bar) => bar.cents), 1);
  const currentCents = currentIndex === null ? null : bars[currentIndex].cents;
  const summary = [
    t('home.weekly.totalA11y', { amount: formatMoney(totalCents, locale) }),
    ...bars.map((bar) => `${bar.label} : ${formatMoney(bar.cents, locale)}`),
  ].join('. ');

  return (
    <Surface accessible accessibilityLabel={summary} style={{ padding: 20, gap: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text variant="caption" tone="muted">
            {t('home.weekly.total')}
          </Text>
          <AmountText cents={totalCents} size="total" fraction="auto" />
        </View>
        {currentCents !== null && (
          <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {t('home.weekly.current')}
              </Text>
            </View>
            <AmountText cents={currentCents} size="total" fraction="auto" />
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }} importantForAccessibility="no-hide-descendants">
        {bars.map((bar, index) => (
          <BarColumn
            key={bar.label}
            bar={bar}
            index={index}
            current={index === currentIndex}
            ratio={bar.cents / max}
            width={index === currentIndex ? CURRENT_BAR_WIDTH : BAR_WIDTH}
          />
        ))}
      </View>
    </Surface>
  );
}

interface BarColumnProps {
  bar: WeeklyChartBar;
  index: number;
  current: boolean;
  /** Part de la barre la plus haute (0 à 1). */
  ratio: number;
  width: number;
}

function BarColumn({ bar, index, current, ratio, width }: BarColumnProps) {
  const locale = useLocale();
  const { name, colors } = useTheme();
  const { timing, delay } = useMotion();
  const chart = chartTokens[name];

  const target = Math.max(MIN_BAR_HEIGHT, Math.round(ratio * PLOT_HEIGHT));
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(delay('chartBarStagger', index), withTiming(1, timing('standard', 'chartBar')));
  }, [grow, delay, timing, index]);
  const barStyle = useAnimatedStyle(() => ({ height: grow.value * target }));

  // Arrondi à l'euro : « 285 € » (le total, lui, garde ses centimes).
  const parts = formatMoneyParts(Math.round(bar.cents / 100) * 100, locale, { fraction: 'auto' });
  const rounded = `${parts.integer} ${parts.currency}`;

  return (
    <View style={{ alignItems: 'center', gap: 8, width: CURRENT_BAR_WIDTH + 8 }}>
      <View style={{ height: PLOT_HEIGHT + 30, justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
        {current ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 9,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
            }}>
            <Text variant="micro" numberOfLines={1}>
              {rounded}
            </Text>
          </View>
        ) : (
          <Text variant="micro" tone="muted" numberOfLines={1}>
            {rounded}
          </Text>
        )}
        <View
          style={
            current
              ? { padding: 4, borderRadius: radius.full, backgroundColor: chart.currentRing }
              : undefined
          }>
          <Animated.View
            style={[
              {
                width,
                borderRadius: width / 2,
                backgroundColor: current ? chart.currentBottom : chart.barBottom,
                experimental_backgroundImage: `linear-gradient(${current ? chart.currentTop : chart.barTop}, ${
                  current ? chart.currentBottom : chart.barBottom
                })`,
                alignItems: 'center',
                paddingTop: 8,
                overflow: 'hidden',
              },
              barStyle,
            ]}>
            {current && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: chart.currentDot }} />}
          </Animated.View>
        </View>
      </View>
      <Text variant={current ? 'label' : 'micro'} tone={current ? 'default' : 'muted'} numberOfLines={1}>
        {bar.label}
      </Text>
    </View>
  );
}
