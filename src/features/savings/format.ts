import type { TFunction } from 'i18next';

import type { AppLocale } from '@/domain/types';
import { formatMoney } from '@/domain/money';
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
