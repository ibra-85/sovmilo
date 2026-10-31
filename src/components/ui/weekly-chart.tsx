import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { formatMoney, formatMoneyAuto, formatMoneyParts } from '@/domain/money';
import { useMotion } from '@/hooks/use-motion';
import { useLocale } from '@/i18n/use-locale';
import { chartTokens } from '@/theme/chart';
import { radius, sizes } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { AmountText } from './amount-text';
import { Pressable } from './pressable';
import { Surface } from './surface';
import { Text } from './text';

export interface WeeklyChartBar {
  /** « 8–14 » : tranche de jours sous la barre (le mois est dans l'en-tête de la section). */
  label: string;
  /** Phrase pour TalkBack : « 8–14 octobre ». */
  a11yLabel: string;
  cents: number;
}

interface WeeklyChartProps {
  bars: readonly WeeklyChartBar[];
  /** Indice de la semaine en cours (mise en avant), ou null quand le mois affiché n'est pas le mois en cours. */
  currentIndex: number | null;
  totalCents: number;
}

const PLOT_HEIGHT = 128;
const BAR_WIDTH = 40;
const RING = 4;
const MIN_BAR_HEIGHT = 8;
/** Zone réservée au-dessus des barres pour la valeur ou l'indicateur. */
const VALUE_ZONE = 34;
/** L'indicateur peut dépasser de sa colonne de cette valeur de chaque côté (la carte a 20 dp de marge). */
const INDICATOR_OVERFLOW = 20;

/**
 * Graphique « Dépenses par semaine » (design « ChartBar ») : quatre barres arrondies aux deux bouts, dégradé léger.
 * La barre mise en avant (la semaine en cours, ou celle que l'on touche) est de la couleur d'action avec un anneau et un
 * repère rond ; sa valeur est affichée EXACTE dans un indicateur, les autres valeurs sont arrondies à l'euro.
 *
 * Aucun texte n'est coupé : les colonnes se partagent toute la largeur (elles suivent la taille d'écran et le texte
 * agrandi), les libellés sont courts (« 22–31 ») et l'indicateur peut déborder de sa colonne dans la marge de la carte.
 * Toucher une barre la sélectionne, la retoucher revient à la semaine en cours. Les barres poussent depuis la base en
 * 400 ms avec 40 ms de décalage, une seule fois ; animations réduites : valeurs affichées tout de suite. Résumé textuel
 * pour TalkBack : le dessin seul ne dit rien.
 */
export function WeeklyChart({ bars, currentIndex, totalCents }: WeeklyChartProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);

  const max = Math.max(...bars.map((bar) => bar.cents), 1);
  const currentCents = currentIndex === null ? null : bars[currentIndex].cents;
  const emphasized = selected ?? currentIndex;
  const summary = [
    t('home.weekly.totalA11y', { amount: formatMoney(totalCents, locale) }),
    ...bars.map((bar) => `${bar.a11yLabel} : ${formatMoney(bar.cents, locale)}`),
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
              <Text variant="caption" tone="muted" style={{ flexShrink: 1 }}>
                {t('home.weekly.current')}
              </Text>
            </View>
            <AmountText cents={currentCents} size="total" fraction="auto" />
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} importantForAccessibility="no-hide-descendants">
        {bars.map((bar, index) => (
          <BarColumn
            key={bar.label}
            bar={bar}
            index={index}
            emphasized={index === emphasized}
            ratio={bar.cents / max}
            onPress={() => setSelected((previous) => (previous === index ? null : index))}
          />
        ))}
      </View>
    </Surface>
  );
}

interface BarColumnProps {
  bar: WeeklyChartBar;
  index: number;
  emphasized: boolean;
  /** Part de la barre la plus haute (0 à 1). */
  ratio: number;
  onPress: () => void;
}

function BarColumn({ bar, index, emphasized, ratio, onPress }: BarColumnProps) {
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

  // Valeurs arrondies à l'euro (« 285 € ») ; l'indicateur de la barre mise en avant montre le montant exact.
  const parts = formatMoneyParts(Math.round(bar.cents / 100) * 100, locale, { fraction: 'auto' });
  const rounded = `${parts.integer} ${parts.currency}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bar.a11yLabel}
      pressTranslate={0}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={{ flex: 1, alignItems: 'center', gap: 8, minHeight: sizes.minTouch }}>
      <View style={{ height: PLOT_HEIGHT + VALUE_ZONE + RING * 2, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
        {/* Valeur ou indicateur : pose absolue plus large que la colonne, pour ne jamais être coupé ni passer à la ligne. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: -INDICATOR_OVERFLOW,
            right: -INDICATOR_OVERFLOW,
            height: VALUE_ZONE,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {emphasized ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 9,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}>
              <Text variant="micro" numberOfLines={1} ellipsizeMode="clip">
                {formatMoneyAuto(bar.cents, locale)}
              </Text>
            </View>
          ) : (
            <Text variant="micro" tone="muted" numberOfLines={1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.8}>
              {rounded}
            </Text>
          )}
        </View>

        <View style={{ padding: RING, borderRadius: radius.full, backgroundColor: emphasized ? chart.currentRing : 'transparent' }}>
          <Animated.View
            style={[
              {
                width: BAR_WIDTH,
                borderRadius: BAR_WIDTH / 2,
                backgroundColor: emphasized ? chart.currentBottom : chart.barBottom,
                experimental_backgroundImage: `linear-gradient(${emphasized ? chart.currentTop : chart.barTop}, ${
                  emphasized ? chart.currentBottom : chart.barBottom
                })`,
                alignItems: 'center',
                paddingTop: 8,
                overflow: 'hidden',
              },
              barStyle,
            ]}>
            {emphasized && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: chart.currentDot }} />}
          </Animated.View>
        </View>
      </View>
      <Text variant={emphasized ? 'label' : 'caption'} tone={emphasized ? 'default' : 'muted'} numberOfLines={1} ellipsizeMode="clip">
        {bar.label}
      </Text>
    </Pressable>
  );
}
