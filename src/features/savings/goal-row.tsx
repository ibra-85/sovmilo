import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, Pressable, ProgressBar, Text, useAnchorMeasure, type PopoverAnchor } from '@/components/ui';
import { formatMoney } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';
import { radius, sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { goalCardText } from './format';
import type { GoalRow } from './use-savings';

interface GoalRowViewProps {
  goal: GoalRow;
  onOpen: (goal: GoalRow) => void;
  /**
   * Action rapide en haut à droite. `add` : ajouter de l'argent en deux touchers depuis la liste (tuile discrète). `restore` :
   * restaurer un objectif archivé (icône seule). Absent : aucune action rapide.
   */
  action?: { kind: 'add' | 'restore'; onPress: (goal: GoalRow) => void; disabled?: boolean };
  /** Appui long : reçoit l'emplacement de la ligne pour y ancrer le menu d'actions. Absent : pas d'appui long. */
  onMenu?: (goal: GoalRow, anchor: PopoverAnchor) => void;
}

/** Zone tactile de l'action rapide (≥ 48 dp) ; la tuile visible est plus petite. */
const ACTION_ZONE = 48;
const ACTION_TILE = 36;
/** Place réservée à droite du nom pour que l'action ne le recouvre jamais. */
const NAME_RESERVE = ACTION_ZONE - 4;

/**
 * Contenu d'une carte d'objectif, en colonne à droite de la pastille d'emoji :
 *  1. le nom (deux lignes au plus), avec l'action rapide dans le coin ;
 *  2. « 1 000 € sur 1 000 € » : UN seul texte, donc il passe à la ligne entre les montants si la place manque (écran étroit, texte
 *     agrandi, russe) et ne coupe jamais un montant, jamais de « … » ;
 *  3. la barre de progression ;
 *  4. l'état ÉCRIT : « Reste X » et le pourcentage (qui peuvent passer l'un sous l'autre), ou un badge « Objectif atteint » /
 *     « Dépassé de X » (la coche et la couleur n'ajoutent qu'un repère, le texte dit tout).
 * Toucher la carte ouvre l'objectif ; l'action rapide a sa propre zone (jamais le détail) ; l'appui long ouvre le menu.
 */
function GoalRowBase({ goal, onOpen, action, onMenu }: GoalRowViewProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();
  const { bind, measure } = useAnchorMeasure();

  const { progress } = goal;
  const text = goalCardText(goal, locale, t);
  const exact = t('savings.rowA11y', {
    name: goal.name,
    saved: formatMoney(goal.savedCents, locale),
    target: formatMoney(goal.targetCents, locale),
    percent: progress.percent,
    status: text.status,
  });

  return (
    <View ref={bind} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={exact}
        accessibilityHint={t(onMenu ? 'savings.rowHintMenu' : 'savings.rowHint')}
        pressTranslate={0}
        onPress={() => onOpen(goal)}
        onLongPress={onMenu ? () => measure((anchor) => onMenu(goal, anchor)) : undefined}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingVertical: space.listRow + 2,
          paddingHorizontal: space.gutter,
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
        })}>
        <View
          style={{
            width: sizes.fieldIcon + 8,
            height: sizes.fieldIcon + 8,
            borderRadius: radius.iconPad,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceMuted,
          }}>
          <GoalIcon icon={goal.icon} size={22} />
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="bodyStrong" numberOfLines={2} style={{ paddingRight: action ? NAME_RESERVE : 0, minHeight: sizes.fieldIcon + 8 - 4 }}>
            {goal.name}
          </Text>
          <Text variant="amountRow">
            {text.saved}
            <Text variant="amountRow" tone="muted">{` ${text.ofTarget}`}</Text>
          </Text>
          <ProgressBar percent={progress.barPercent} complete={text.done} />
          {text.done ? (
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 6,
                paddingVertical: 3,
                paddingHorizontal: 10,
                borderRadius: radius.full,
                backgroundColor: colors.successBg,
              }}>
              <Icon name="check" size={14} color={colors.successIcon} weight="strong" style={{ marginTop: 3 }} />
              <Text variant="captionMedium" style={{ flexShrink: 1 }}>
                {text.status}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12 }}>
              <Text variant="captionMedium" tone="muted">
                {text.status}
              </Text>
              <Text variant="captionMedium" tone="muted">
                {text.percent}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(action.kind === 'add' ? 'savings.quickAdd' : 'savings.archive.restoreA11y', { name: goal.name })}
          accessibilityState={{ disabled: action.disabled === true }}
          disabled={action.disabled}
          pressTranslate={0}
          onPress={() => action.onPress(goal)}
          style={{
            position: 'absolute',
            top: 2,
            right: 4,
            width: ACTION_ZONE,
            height: ACTION_ZONE,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: action.disabled ? 0.4 : 1,
          }}>
          {({ pressed }) => (
            <View
              style={{
                width: ACTION_TILE,
                height: ACTION_TILE,
                borderRadius: radius.iconPad,
                alignItems: 'center',
                justifyContent: 'center',
                // « Ajouter » : tuile à fond discret (se reconnaît comme un bouton) ; « Restaurer » : icône seule, sans contour.
                backgroundColor: pressed ? colors.surfaceBorder : action.kind === 'add' ? colors.surfaceMuted : 'transparent',
              }}>
              <Icon name={action.kind === 'add' ? 'plus' : 'restore'} size={action.kind === 'add' ? 20 : 22} color={colors.ink} />
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Emoji de l'objectif (aucune icône de catalogue : l'emoji est le choix de l'utilisatrice). Masqué à TalkBack, le nom suffit. */
export function GoalIcon({ icon, size }: { icon: string; size: number }) {
  return (
    <Text
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={{ fontSize: size, lineHeight: Math.round(size * 1.25), includeFontPadding: false, textAlign: 'center' }}>
      {icon}
    </Text>
  );
}

/**
 * Les lignes viennent de requêtes en direct : chaque réponse recrée les objets. On compare donc les champs affichés, pas les
 * références, pour qu'un versement ne refasse le rendu que de la ligne concernée.
 */
export const GoalRowView = memo(
  GoalRowBase,
  (previous, next) =>
    previous.onOpen === next.onOpen &&
    previous.onMenu === next.onMenu &&
    previous.action?.kind === next.action?.kind &&
    previous.action?.onPress === next.action?.onPress &&
    previous.action?.disabled === next.action?.disabled &&
    previous.goal.id === next.goal.id &&
    previous.goal.name === next.goal.name &&
    previous.goal.icon === next.goal.icon &&
    previous.goal.targetCents === next.goal.targetCents &&
    previous.goal.savedCents === next.goal.savedCents,
);
