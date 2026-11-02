import type { TFunction } from 'i18next';

import type { AppLocale } from '@/domain/types';
import { formatMoney, formatMoneyAuto } from '@/domain/money';
import type { GoalProgress } from '@/domain/savings';

/**
 * Phrase d'état d'un objectif, TOUJOURS écrite (la couleur et la coche ne font que l'accompagner) :
 * « Reste 800 € », « Objectif atteint », « Dépassé de 300 € ».
 */
export function goalStatusText(progress: GoalProgress, locale: AppLocale, t: TFunction): string {
  switch (progress.state) {
    case 'exceeded':
      return t('savings.exceeded', { amount: formatMoney(progress.exceededCents, locale) });
    case 'reached':
      return t('savings.reached');
    default:
      return t('savings.remaining', { amount: formatMoney(progress.remainingCents, locale) });
  }
}

/** Textes d'une carte d'objectif : montants ENTIERS (jamais coupés), état écrit, pourcentage. */
export interface GoalCardText {
  saved: string;
  /** « sur 1 000 € » : la cible, précédée de sa préposition. */
  ofTarget: string;
  status: string;
  /** Pourcentage court (« 61 % »), vide quand l'état (atteint, dépassé) le rend redondant. */
  percent: string;
  done: boolean;
}

/**
 * Les montants sont des mots insécables (espaces fines et insécables du formatage monétaire) : si la place manque, la carte passe
 * à la ligne ENTRE les éléments (« 1 000 € » / « sur 1 000 € »), jamais au milieu d'un montant, et rien n'est abrégé en « … ».
 */
export function goalCardText(
  goal: { savedCents: number; targetCents: number; progress: GoalProgress },
  locale: AppLocale,
  t: TFunction,
): GoalCardText {
  const { progress } = goal;
  const done = progress.state === 'reached' || progress.state === 'exceeded';
  return {
    saved: formatMoneyAuto(goal.savedCents, locale),
    ofTarget: t('savings.ofTarget', { target: formatMoneyAuto(goal.targetCents, locale) }),
    status: goalStatusText(progress, locale, t),
    percent: done ? '' : t('savings.percentShort', { percent: progress.percent }),
    done,
  };
}
