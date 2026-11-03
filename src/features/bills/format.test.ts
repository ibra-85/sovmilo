import { createI18n } from '@/i18n/config';

import { amountText, recurrenceDetail, recurrenceName, statusText } from './format';

const fr = createI18n('fr');
const ru = createI18n('ru');
const TODAY = '2026-11-10';

describe('statusText', () => {
  const status = (dueOn: string, paidOn: string | null = null) => statusText({ dueOn, paidOn }, TODAY, 'fr', fr.t);

  it('écrit chaque statut en toutes lettres', () => {
    expect(status('2026-11-10')).toBe('À payer aujourd’hui');
    expect(status('2026-11-11')).toBe('À payer dans 1 jour');
    expect(status('2026-11-13')).toBe('À payer dans 3 jours');
    expect(status('2026-11-25')).toBe('À venir');
    expect(status('2026-11-09')).toBe('En retard de 1 jour');
    expect(status('2026-10-29')).toBe('En retard de 12 jours');
    expect(status('2026-11-05', '2026-11-04')).toMatch(/^Payée le 4 nov/);
  });

  it('pluriels russes : 1, 2, 5, 11, 21, 22 jours', () => {
    const late = (days: number) => {
      const due = `2026-11-${String(10 - days).padStart(2, '0')}`;
      return statusText({ dueOn: due, paidOn: null }, TODAY, 'ru', ru.t);
    };
    expect(late(1)).toBe('Просрочено на 1 день');
    expect(late(2)).toBe('Просрочено на 2 дня');
    expect(late(5)).toBe('Просрочено на 5 дней');
    const soon = (days: number) => statusText({ dueOn: `2026-11-${10 + days}`, paidOn: null }, TODAY, 'ru', ru.t);
    expect(soon(1)).toBe('Оплатить через 1 день');
    expect(soon(3)).toBe('Оплатить через 3 дня');
    expect(soon(7)).toBe('Оплатить через 7 дней');
    const longAgo = (dueOn: string) => statusText({ dueOn, paidOn: null }, '2026-12-30', 'ru', ru.t);
    expect(longAgo('2026-12-19')).toBe('Просрочено на 11 дней');
    expect(longAgo('2026-12-09')).toBe('Просрочено на 21 день');
    expect(longAgo('2026-12-08')).toBe('Просрочено на 22 дня');
  });
});

describe('recurrenceDetail', () => {
  it('mensuelle, annuelle, ponctuelle, arrêtée', () => {
    expect(recurrenceDetail({ recurrence: 'monthly', anchorDate: '2026-01-31', stoppedOn: null }, 'fr', fr.t)).toBe('Chaque mois, le 31');
    expect(recurrenceDetail({ recurrence: 'yearly', anchorDate: '2026-03-05', stoppedOn: null }, 'fr', fr.t)).toBe('Chaque année, le 5 mars');
    expect(recurrenceDetail({ recurrence: 'none', anchorDate: '2026-03-05', stoppedOn: null }, 'fr', fr.t)).toBe('Facture ponctuelle');
    expect(recurrenceDetail({ recurrence: 'monthly', anchorDate: '2026-11-12', stoppedOn: '2026-12-01' }, 'fr', fr.t)).toMatch(/^Chaque mois, le 12 · Arrêtée le 1/);
  });

  it('en russe', () => {
    expect(recurrenceDetail({ recurrence: 'monthly', anchorDate: '2026-11-12', stoppedOn: null }, 'ru', ru.t)).toBe('Каждый месяц, 12-го числа');
    expect(recurrenceDetail({ recurrence: 'yearly', anchorDate: '2026-03-05', stoppedOn: null }, 'ru', ru.t)).toBe('Каждый год, 5 марта');
    expect(recurrenceName('monthly', ru.t)).toBe('Ежемесячно');
  });
});

describe('amountText', () => {
  it('montant connu : formaté ; inconnu : jamais « 0 € »', () => {
    expect(amountText(2999, false, 'fr', fr.t)).toMatch(/^29,99[\s ]€$/);
    expect(amountText(null, false, 'fr', fr.t)).toBe('Montant à renseigner');
    expect(amountText(null, true, 'fr', fr.t)).toBe('Montant non noté');
    expect(amountText(null, false, 'ru', ru.t)).toBe('Сумму нужно указать');
    expect(amountText(null, false, 'fr', fr.t)).not.toMatch(/0/);
  });
});

describe('traductions des factures', () => {
  it.each(['fr', 'ru'] as const)('pluriels de la suppression (%s)', (lang) => {
    const i18n = lang === 'fr' ? fr : ru;
    for (const count of [1, 2, 5, 11, 21]) {
      const text = i18n.t('bills.deleteTextHistory', { count });
      expect(text).not.toMatch(/^bills\./);
      if (count > 1) expect(text).toContain(String(count));
    }
  });
});
