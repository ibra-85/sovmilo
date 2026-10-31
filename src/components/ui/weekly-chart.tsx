import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { formatMoney, formatMoneyAuto, formatMoneyParts } from '@/domain/money';
import type { AppLocale } from '@/domain/types';
import { useContentWidth } from '@/hooks/use-content-width';
import { useMotion } from '@/hooks/use-motion';
import { useLocale } from '@/i18n/use-locale';
import { effectiveFontScale } from '@/theme/amount-fit';
import { layoutAmount } from '@/theme/amount-layout';
import { chartTokens } from '@/theme/chart';
import { radius, sizes } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { AmountText } from './amount-text';
import { barValuesFit, indicatorBox, labelWidth } from './chart-layout';
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
/** L'indicateur peut dépasser de la zone des barres de cette valeur de chaque côté (la carte a 20 dp de marge). */
const INDICATOR_OVERFLOW = 20;
const CARD_PADDING = 20;
/** Taille de la variante « micro » : valeurs sous les barres et indicateur. */
const VALUE_SIZE = 13;
const INDICATOR_PADDING = 8;

/**
 * Graphique « Dépenses par semaine » (design « ChartBar ») : quatre barres arrondies aux deux bouts, dégradé léger.
 * La barre mise en avant (la semaine en cours, ou celle que l'on touche) est de la couleur d'action avec un anneau et un
 * repère rond ; sa valeur est affichée EXACTE dans un indicateur, les autres valeurs sont arrondies à l'euro.
 *
 * Aucun texte n'est coupé : les colonnes se partagent toute la largeur (elles suivent la taille d'écran et le texte
 * agrandi), les libellés sont courts (« 22–31 »).
 *
 * Gros montants (robustesse) :
 *  - les deux totaux du haut (mois, semaine en cours) restent côte à côte tant que chacun tient dans la moitié de la carte,
 *    sinon ils s'empilent (le total du mois en premier, en grand) ;
 *  - l'indicateur de la barre choisie est aussi large que son texte, centré sur la barre puis ramené dans la carte
 *    (`chart-layout.ts`, testé) ;
 *  - si les valeurs arrondies ne tiennent pas côte à côte sous les barres, seule la barre choisie montre sa valeur.
 * Toucher une barre la sélectionne, la retoucher revient à la semaine en cours. Les barres poussent depuis la base en
 * 400 ms avec 40 ms de décalage, une seule fois ; animations réduites : valeurs affichées tout de suite. Résumé textuel
 * pour TalkBack : le dessin seul ne dit rien.
 */
export function WeeklyChart({ bars, currentIndex, totalCents }: WeeklyChartProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  // Largeur de la zone des barres (mesurée) ; avant la mesure : la carte moins ses marges.
  const contentWidth = useContentWidth();
  const [chartWidth, setChartWidth] = useState(contentWidth - CARD_PADDING * 2);

  const max = Math.max(...bars.map((bar) => bar.cents), 1);
  const currentCents = currentIndex === null ? null : bars[currentIndex].cents;
  const emphasized = selected ?? currentIndex;
  const summary = [
    t('home.weekly.totalA11y', { amount: formatMoney(totalCents, locale) }),
    ...bars.map((bar) => `${bar.a11yLabel} : ${formatMoney(bar.cents, locale)}`),
  ].join('. ');

  const half = (chartWidth - 12) / 2;
  const sideBySide =
    currentCents === null ||
    (layoutAmount({ cents: totalCents, locale, size: 'total', fraction: 'auto', maxWidth: half, fontScale }).fit.fits &&
      layoutAmount({ cents: currentCents, locale, size: 'total', fraction: 'auto', maxWidth: half, fontScale }).fit.fits);

  const columnWidth = chartWidth / bars.length;
  const valueFontScale = effectiveFontScale(fontScale, 1.8);
  const showValues = barValuesFit(
    bars.map((bar) => roundedText(bar.cents, locale)),
    columnWidth,
    VALUE_SIZE,
    valueFontScale,
  );

  const currentMarker = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
      <Text variant="caption" tone="muted" style={{ flexShrink: 1 }}>
        {t('home.weekly.current')}
      </Text>
    </View>
  );

  return (
    <Surface accessible accessibilityLabel={summary} style={{ padding: CARD_PADDING, gap: 18 }}>
      {sideBySide ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexShrink: 1, gap: 2 }}>
            <Text variant="caption" tone="muted">
              {t('home.weekly.total')}
            </Text>
            <AmountText cents={totalCents} size="total" fraction="auto" maxWidth={half} />
          </View>
          {currentCents !== null && (
            <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1 }}>
              {currentMarker}
              <AmountText cents={currentCents} size="total" fraction="auto" maxWidth={half} />
            </View>
          )}
        </View>
      ) : (
        // Montants trop grands pour deux colonnes : le total du mois garde la place d'honneur, la semaine en cours dessous.
        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text variant="caption" tone="muted">
              {t('home.weekly.total')}
            </Text>
            <AmountText cents={totalCents} size="total" fraction="auto" maxWidth={chartWidth} />
          </View>
          {currentCents !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {currentMarker}
              <AmountText cents={currentCents} size="row" fraction="auto" maxWidth={chartWidth * 0.6} />
            </View>
          )}
        </View>
      )}

      <View
        style={{ flexDirection: 'row', alignItems: 'flex-end' }}
        importantForAccessibility="no-hide-descendants"
        onLayout={(event: LayoutChangeEvent) => setChartWidth(event.nativeEvent.layout.width)}>
        {bars.map((bar, index) => (
          <BarColumn
            key={bar.label}
            bar={bar}
            index={index}
            count={bars.length}
            chartWidth={chartWidth}
            showValue={showValues}
            fontScale={valueFontScale}
            emphasized={index === emphasized}
            ratio={bar.cents / max}
            onPress={() => setSelected((previous) => (previous === index ? null : index))}
          />
        ))}
      </View>
    </Surface>
  );
}

/** Valeur arrondie à l'euro affichée sous une barre (« 285 € »), avec € insécable. */
function roundedText(cents: number, locale: AppLocale): string {
  const parts = formatMoneyParts(Math.round(cents / 100) * 100, locale, { fraction: 'auto' });
  return `${parts.integer} ${parts.currency}`;
}

interface BarColumnProps {
  bar: WeeklyChartBar;
  index: number;
  emphasized: boolean;
  /** Part de la barre la plus haute (0 à 1). */
  ratio: number;
  count: number;
  chartWidth: number;
  /** Faux (gros montants) : seule la barre choisie affiche sa valeur. */
  showValue: boolean;
  fontScale: number;
  onPress: () => void;
}

function BarColumn({ bar, index, emphasized, ratio, count, chartWidth, showValue, fontScale, onPress }: BarColumnProps) {
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
  const rounded = roundedText(bar.cents, locale);
  const exact = formatMoneyAuto(bar.cents, locale);
  const box = indicatorBox({
    index,
    count,
    chartWidth,
    textWidth: labelWidth(exact, VALUE_SIZE, fontScale),
    overflow: INDICATOR_OVERFLOW,
    padding: INDICATOR_PADDING,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bar.a11yLabel}
      pressTranslate={0}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={{ flex: 1, alignItems: 'center', gap: 8, minHeight: sizes.minTouch }}>
      <View style={{ height: PLOT_HEIGHT + VALUE_ZONE + RING * 2, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
        {/* Valeur ou indicateur : pose absolue, aussi large que le texte, ramenée dans la carte. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: box.left,
            width: box.width,
            height: VALUE_ZONE,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {emphasized ? (
            <View
              style={{
                paddingHorizontal: INDICATOR_PADDING,
                paddingVertical: 3,
                borderRadius: 9,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}>
              <Text variant="micro" numberOfLines={1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.8}>
                {exact}
              </Text>
            </View>
          ) : showValue ? (
            <Text variant="micro" tone="muted" numberOfLines={1} ellipsizeMode="clip" adjustsFontSizeToFit minimumFontScale={0.8}>
              {rounded}
            </Text>
          ) : null}
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
