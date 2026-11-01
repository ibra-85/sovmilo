import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, Pressable, ProgressBar, Text } from '@/components/ui';
import { formatMoney, formatMoneyAuto } from '@/domain/money';
import { useLocale } from '@/i18n/use-locale';
import { radius, sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { goalStatusText } from './format';
import type { GoalRow } from './use-savings';

interface GoalRowViewProps {
  goal: GoalRow;
  onOpen: (goal: GoalRow) => void;
  /**
   * Bouton rond à droite. `add` : ajouter de l'argent en deux touchers depuis la liste. `restore` : restaurer un objectif archivé.
   * Absent : aucune action rapide.
   */
  action?: { kind: 'add' | 'restore'; onPress: (goal: GoalRow) => void };
}

const ACTION_ZONE = 56;
const ACTION_SIZE = 28;

/**
 * Ligne d'objectif, compacte : pastille d'emoji, nom (deux lignes au plus), « montant mis de côté sur cible », barre de
 * progression et état ÉCRIT (reste à épargner, atteint, dépassé : la couleur ne fait qu'accompagner le texte et la coche).
 * Toucher la ligne ouvre l'objectif ; le bouton rond de droite ajoute de l'argent (ou restaure un objectif archivé).
 */
function GoalRowBase({ goal, onOpen, action }: GoalRowViewProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { colors } = useTheme();

  const { progress } = goal;
  const done = progress.state === 'reached' || progress.state === 'exceeded';
  const status = goalStatusText(progress, locale, t);
  const saved = formatMoneyAuto(goal.savedCents, locale);
  const target = formatMoneyAuto(goal.targetCents, locale);
  const exact = t('savings.rowA11y', {
    name: goal.name,
    saved: formatMoney(goal.savedCents, locale),
    target: formatMoney(goal.targetCents, locale),
    percent: progress.percent,
    status,
  });

  return (
    <View style={{ minHeight: sizes.minTouch + 24, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={exact}
        accessibilityHint={t('savings.rowHint')}
        pressTranslate={0}
        onPress={() => onOpen(goal)}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          alignSelf: 'stretch',
          paddingVertical: space.listRow + 2,
          paddingLeft: space.gutter,
          paddingRight: action ? 4 : space.gutter,
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

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {goal.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {t('savings.savedOf', { saved, target })}
          </Text>
          <View style={{ marginVertical: 4 }}>
            <ProgressBar percent={progress.barPercent} complete={done} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {done ? <Icon name="check" size={14} color={colors.successIcon} weight="strong" /> : null}
            <Text variant="captionMedium" tone={done ? 'default' : 'muted'} numberOfLines={2} style={{ flexShrink: 1 }}>
              {status}
            </Text>
          </View>
        </View>
      </Pressable>

      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(action.kind === 'add' ? 'savings.quickAdd' : 'savings.archive.restoreA11y', { name: goal.name })}
          pressTranslate={0}
          onPress={() => action.onPress(goal)}
          style={{ width: ACTION_ZONE, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: ACTION_SIZE,
              height: ACTION_SIZE,
              borderRadius: ACTION_SIZE / 2,
              borderWidth: 2,
              borderColor: colors.textMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name={action.kind === 'add' ? 'plus' : 'back'} size={14} color={colors.textMuted} />
          </View>
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
    previous.action?.kind === next.action?.kind &&
    previous.action?.onPress === next.action?.onPress &&
    previous.goal.id === next.goal.id &&
    previous.goal.name === next.goal.name &&
    previous.goal.icon === next.goal.icon &&
    previous.goal.targetCents === next.goal.targetCents &&
    previous.goal.savedCents === next.goal.savedCents,
);
