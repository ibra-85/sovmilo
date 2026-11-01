import { shiftMonth } from './dates';
import {
  CONSULTABLE_MONTHS_AHEAD,
  GENERATION_HORIZON_MONTHS,
  MAX_BILL_AMOUNT_CENTS,
  MAX_BILL_NAME_LENGTH,
  MAX_PLANNED_DATES,
  SOON_WINDOW_DAYS,
  billStatus,
  cleanBillName,
  cleanBillNote,
  daysBetween,
  daysInMonthOf,
  daysOverdue,
  displayAmount,
  dueDateAt,
  dueDateInMonth,
  dueDatesThrough,
  isBillRecurrence,
  isValidBillAmount,
  isValidDate,
  partitionBills,
  plannedDueDates,
  splitDate,
  summarizePeriod,
  validateBillName,
  validateNewDueDate,
  type OccurrenceLike,
  type PlanInput,
} from './bills';

const occ = (dueOn: string, overrides: Partial<OccurrenceLike> = {}): OccurrenceLike => ({
  dueOn,
  amountCents: 1000,
  paidOn: null,
  paidAmountCents: null,
  ...overrides,
});

describe('dates civiles', () => {
  it('reconnaît les dates qui existent et refuse les autres', () => {
    expect(isValidDate('2026-11-15')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2027-02-29')).toBe(false);
    expect(isValidDate('2026-04-31')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-00-10')).toBe(false);
    expect(isValidDate('26-11-15')).toBe(false);
    expect(isValidDate('2026-11-15T10:00:00Z')).toBe(false);
    expect(splitDate('1800-01-01')).toBeNull();
  });

  it('compte les jours du mois, février bissextile compris (règle des siècles incluse)', () => {
    expect(daysInMonthOf(2024, 2)).toBe(29);
    expect(daysInMonthOf(2026, 2)).toBe(28);
    expect(daysInMonthOf(1900, 2)).toBe(28);
    expect(daysInMonthOf(2000, 2)).toBe(29);
    expect(daysInMonthOf(2026, 4)).toBe(30);
    expect(daysInMonthOf(2026, 12)).toBe(31);
  });

  it('calcule les écarts en jours civils, y compris au passage à l\'heure d\'été / d\'hiver', () => {
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(0);
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7);
    expect(daysBetween('2026-11-08', '2026-11-01')).toBe(-7);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    // Passage à l'heure d'été en Europe (29 mars 2026) et d'hiver (25 octobre 2026) : des jours de 23 h et de 25 h.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2027-01-01', '2028-01-01')).toBe(365);
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366);
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow(RangeError);
  });

  it('donne les mêmes résultats quel que soit le fuseau de l\'appareil', () => {
    const original = process.env.TZ;
    try {
      const results = ['UTC', 'Europe/Paris', 'America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata'].map((zone) => {
        process.env.TZ = zone;
        return [
          daysBetween('2026-03-28', '2026-03-30'),
          daysBetween('2026-10-24', '2026-10-26'),
          dueDateAt('2026-01-31', 'monthly', 1),
          billStatus({ dueOn: '2026-11-12', paidOn: null }, '2026-11-12'),
          plannedDueDates({ anchor: '2026-11-12', recurrence: 'monthly', stoppedOn: null, today: '2026-11-01' }).join(','),
        ];
      });
      for (const result of results) expect(result).toEqual(results[0]);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe('récurrence mensuelle', () => {
  it('garde le jour d\'origine : le 31 janvier donne le 28 février puis revient au 31 mars', () => {
    const dates = [0, 1, 2, 3, 4].map((k) => dueDateAt('2026-01-31', 'monthly', k));
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('février bissextile : le 29 puis le 30 et le 31 se replient sur le 29', () => {
    expect(dueDateAt('2028-01-29', 'monthly', 1)).toBe('2028-02-29');
    expect(dueDateAt('2028-01-30', 'monthly', 1)).toBe('2028-02-29');
    expect(dueDateAt('2028-01-31', 'monthly', 1)).toBe('2028-02-29');
    expect(dueDateAt('2027-01-29', 'monthly', 1)).toBe('2027-02-28');
    expect(dueDateAt('2027-01-30', 'monthly', 1)).toBe('2027-02-28');
  });

  it('le 30 : février se replie, les autres mois gardent le 30', () => {
    expect([0, 1, 2, 3].map((k) => dueDateAt('2026-01-30', 'monthly', k))).toEqual(['2026-01-30', '2026-02-28', '2026-03-30', '2026-04-30']);
  });

  it('passe de décembre à janvier en changeant d\'année', () => {
    expect([0, 1, 2].map((k) => dueDateAt('2026-12-12', 'monthly', k))).toEqual(['2026-12-12', '2027-01-12', '2027-02-12']);
    expect(dueDateAt('2026-12-31', 'monthly', 2)).toBe('2027-02-28');
    expect(dueDateAt('2026-11-15', 'monthly', 14)).toBe('2028-01-15');
  });

  it('ne dérive pas sur plusieurs années : le rang k donne toujours le même jour', () => {
    for (let k = 0; k < 120; k += 1) {
      const date = dueDateAt('2026-01-31', 'monthly', k);
      const parts = splitDate(date)!;
      expect(parts.day).toBe(daysInMonthOf(parts.year, parts.month));
    }
    expect(dueDateAt('2026-01-31', 'monthly', 24)).toBe('2028-01-31');
  });
});

describe('récurrence annuelle', () => {
  it('garde le même mois et le même jour chaque année', () => {
    expect([0, 1, 2].map((k) => dueDateAt('2026-03-05', 'yearly', k))).toEqual(['2026-03-05', '2027-03-05', '2028-03-05']);
  });

  it('29 février : le 28 les années non bissextiles, le 29 les années bissextiles', () => {
    const dates = [0, 1, 2, 3, 4].map((k) => dueDateAt('2028-02-29', 'yearly', k));
    expect(dates).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
  });
});

describe('facture ponctuelle et rangs invalides', () => {
  it('n\'a qu\'une seule date', () => {
    expect(dueDateAt('2026-11-15', 'none', 0)).toBe('2026-11-15');
    expect(() => dueDateAt('2026-11-15', 'none', 1)).toThrow(RangeError);
    expect(dueDatesThrough('2026-11-15', 'none', '2030-01-01')).toEqual(['2026-11-15']);
    expect(dueDatesThrough('2026-11-15', 'none', '2026-11-14')).toEqual([]);
  });

  it('refuse une ancre invalide ou un rang négatif / fractionnaire', () => {
    expect(() => dueDateAt('2026-02-30', 'monthly', 0)).toThrow(RangeError);
    expect(() => dueDateAt('2026-02-10', 'monthly', -1)).toThrow(RangeError);
    expect(() => dueDateAt('2026-02-10', 'monthly', 1.5)).toThrow(RangeError);
  });

  it('reconnaît les récurrences valides', () => {
    expect(isBillRecurrence('monthly')).toBe(true);
    expect(isBillRecurrence('weekly')).toBe(false);
    expect(isBillRecurrence(undefined)).toBe(false);
  });
});

describe('échéances à créer (plannedDueDates)', () => {
  const plan = (anchor: string, recurrence: 'none' | 'monthly' | 'yearly', today: string, stoppedOn: string | null = null) =>
    plannedDueDates({ anchor, recurrence, stoppedOn, today });

  it('ponctuelle : une seule échéance, passée ou à venir', () => {
    expect(plan('2026-11-15', 'none', '2026-11-01')).toEqual(['2026-11-15']);
    expect(plan('2026-09-15', 'none', '2026-11-01')).toEqual(['2026-09-15']);
  });

  it('mensuelle : de l\'ancre jusqu\'à la fin du dernier mois consultable', () => {
    expect(GENERATION_HORIZON_MONTHS).toBe(CONSULTABLE_MONTHS_AHEAD);
    expect(CONSULTABLE_MONTHS_AHEAD).toBe(6);
    expect(plan('2026-11-12', 'monthly', '2026-11-01')).toEqual([
      '2026-11-12',
      '2026-12-12',
      '2027-01-12',
      '2027-02-12',
      '2027-03-12',
      '2027-04-12',
      '2027-05-12',
    ]);
  });

  it('couvre chaque mois que le sélecteur propose, du mois en cours au dernier mois consultable', () => {
    for (const today of ['2026-11-01', '2026-11-30', '2026-12-31', '2027-02-28', '2028-02-29']) {
      const dates = plan('2026-01-31', 'monthly', today);
      for (let k = 0; k <= CONSULTABLE_MONTHS_AHEAD; k += 1) {
        const month = shiftMonth(today.slice(0, 7), k);
        expect(dates.some((date) => date.startsWith(month))).toBe(true);
      }
    }
  });

  it('annuelle : l\'échéance proche est générée, la suivante est toujours là', () => {
    expect(plan('2026-05-20', 'yearly', '2026-11-01')).toEqual(['2026-05-20', '2027-05-20']);
    expect(plan('2027-03-05', 'yearly', '2026-11-01')).toEqual(['2027-03-05']);
  });

  it('mois consulté (viewedMonth) : son échéance s\'ajoute, sans combler les mois d\'entre-deux, et ne réduit jamais le plan', () => {
    const base = { anchor: '2026-11-12', recurrence: 'monthly' as const, stoppedOn: null, today: '2026-11-01' };
    const far = plannedDueDates({ ...base, viewedMonth: '2027-09' });
    expect(far[far.length - 1]).toBe('2027-09-12');
    expect(far).toHaveLength(plannedDueDates(base).length + 1);
    expect(far).not.toContain('2027-06-12'); // pas de mois d'entre-deux inutile
    expect(plannedDueDates({ ...base, viewedMonth: '2026-12' })).toEqual(plannedDueDates(base)); // déjà couvert
    expect(plannedDueDates({ ...base, viewedMonth: '2025-01' })).toEqual(plannedDueDates(base)); // mois passé
    expect(plannedDueDates({ ...base, viewedMonth: 'pas-un-mois' })).toEqual(plannedDueDates(base));
  });

  it('mois consulté : sans effet sur une récurrence arrêtée ou ponctuelle', () => {
    const base = { anchor: '2026-11-12', recurrence: 'monthly' as const, stoppedOn: null, today: '2026-11-01' };
    expect(plannedDueDates({ ...base, stoppedOn: '2027-01-31', viewedMonth: '2027-09' })).toEqual(['2026-11-12', '2026-12-12', '2027-01-12']);
    expect(plannedDueDates({ ...base, recurrence: 'none', viewedMonth: '2027-09' })).toEqual(['2026-11-12']);
  });

  it('mensuelle oubliée depuis des mois : toutes les échéances passées restent présentes', () => {
    const dates = plan('2026-06-12', 'monthly', '2026-11-01');
    expect(dates.slice(0, 5)).toEqual(['2026-06-12', '2026-07-12', '2026-08-12', '2026-09-12', '2026-10-12']);
    expect(dates).toContain('2026-11-12');
    expect(dates[dates.length - 1]).toBe('2027-05-12');
  });

  it('annuelle : ajoute la prochaine échéance même si elle dépasse l\'horizon', () => {
    expect(plan('2026-03-05', 'yearly', '2026-11-01')).toEqual(['2026-03-05', '2027-03-05']);
    // Échéance du 5 mars proche : elle est dans l\'horizon, pas de ligne en plus.
    expect(plan('2027-03-05', 'yearly', '2026-11-01')).toEqual(['2027-03-05']);
    expect(plan('2026-12-05', 'yearly', '2026-11-01')).toEqual(['2026-12-05']);
    // Le jour même de l'échéance : la suivante existe déjà (payer aujourd'hui ne laisse jamais la série sans échéance à venir).
    expect(plan('2027-03-05', 'yearly', '2027-03-05')).toEqual(['2027-03-05', '2028-03-05']);
  });

  it('une ancre lointaine donne une seule échéance, sans rien inventer avant', () => {
    expect(plan('2028-05-10', 'monthly', '2026-11-01')).toEqual(['2028-05-10']);
  });

  it('est idempotente : même entrée, même résultat, et une date par jour au plus', () => {
    const a = plan('2026-01-31', 'monthly', '2026-11-01');
    const b = plan('2026-01-31', 'monthly', '2026-11-01');
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it('a un horizon glissant fini : jamais d\'échéances à l\'infini', () => {
    expect(plan('2026-01-31', 'monthly', '2026-11-01').length).toBeLessThan(20);
    expect(plan('1990-01-01', 'monthly', '2026-11-01').length).toBeLessThanOrEqual(MAX_PLANNED_DATES + 1);
  });

  it('récurrence arrêtée : plus rien après la date d\'arrêt', () => {
    expect(plan('2026-11-12', 'monthly', '2026-11-20', '2026-11-20')).toEqual(['2026-11-12']);
    // Arrêtée avant même la prochaine échéance : on n\'ajoute pas « la prochaine ».
    expect(plan('2026-03-05', 'yearly', '2026-11-01', '2026-11-01')).toEqual(['2026-03-05']);
  });

  it('change d\'année en passant de décembre à janvier', () => {
    expect(plan('2026-12-31', 'monthly', '2026-12-15')).toEqual([
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
      '2027-06-30',
    ]);
  });
});

describe('récurrence sans date de fin : règle, horizon et fenêtre consultable', () => {
  const monthly = { anchor: '2026-11-12', recurrence: 'monthly' as const, stoppedOn: null };
  const yearly = { anchor: '2026-11-12', recurrence: 'yearly' as const, stoppedOn: null };
  const plan = (input: Omit<PlanInput, 'today'>, today: string, viewedMonth?: string) => plannedDueDates({ ...input, today, viewedMonth });

  it('dueDateInMonth : la date de la série dans un mois donné, calculée directement', () => {
    expect(dueDateInMonth('2026-11-12', 'monthly', '2026-11')).toBe('2026-11-12');
    expect(dueDateInMonth('2026-11-12', 'monthly', '2040-01')).toBe('2040-01-12');
    expect(dueDateInMonth('2026-11-12', 'monthly', '2026-10')).toBeNull(); // avant l'ancre
    expect(dueDateInMonth('2026-11-12', 'monthly', 'pas-un-mois')).toBeNull();
    expect(dueDateInMonth('2026-11-12', 'monthly', '2027-13')).toBeNull();
    expect(dueDateInMonth('2026-11-12', 'yearly', '2040-11')).toBe('2040-11-12');
    expect(dueDateInMonth('2026-11-12', 'yearly', '2040-01')).toBeNull(); // pas le bon mois
    expect(dueDateInMonth('2026-11-12', 'yearly', '2025-11')).toBeNull();
    expect(dueDateInMonth('2026-11-12', 'none', '2026-11')).toBe('2026-11-12');
    expect(dueDateInMonth('2026-11-12', 'none', '2027-11')).toBeNull();
    expect(() => dueDateInMonth('2026-02-30', 'monthly', '2027-01')).toThrow(RangeError);
  });

  it('dueDateInMonth rend la même date que l\'énumération de la série (31, 29 février, passage d\'année)', () => {
    for (const anchor of ['2026-01-31', '2026-12-31', '2028-02-29', '2026-11-12']) {
      for (let k = 0; k < 400; k += 7) {
        const date = dueDateAt(anchor, 'monthly', k);
        expect(dueDateInMonth(anchor, 'monthly', date.slice(0, 7))).toBe(date);
      }
      for (let k = 0; k < 120; k += 1) {
        const date = dueDateAt(anchor, 'yearly', k);
        expect(dueDateInMonth(anchor, 'yearly', date.slice(0, 7))).toBe(date);
      }
    }
  });

  it.each([
    ['1 an', '2027-11-20', '2028-05-12'],
    ['5 ans', '2031-11-20', '2032-05-12'],
    ['15 ans', '2041-11-20', '2042-05-12'],
  ])('mensuelle toujours valide après %s : chaque mois de l\'horizon a son échéance, aucune date de fin', (_label, today, lastExpected) => {
    const dates = plan(monthly, today);
    const month = today.slice(0, 7);
    for (let k = 0; k <= CONSULTABLE_MONTHS_AHEAD; k += 1) {
      expect(dates).toContain(`${shiftMonth(month, k)}-12`);
    }
    expect(dates[dates.length - 1]).toBe(lastExpected); // le dernier mois de l'horizon glissant
    expect(dates[0]).toBe('2026-11-12'); // l'historique commence toujours à l'ancre
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('mensuelle : un siècle plus tard la série continue (aucune limite absolue de validité)', () => {
    for (const today of ['2100-01-15', '2126-12-01', '2160-06-30', '2400-02-29']) {
      const dates = plan(monthly, today);
      expect(dates.length).toBeLessThanOrEqual(MAX_PLANNED_DATES + 2);
      const last = dates[dates.length - 1];
      expect(last > today).toBe(true);
      expect(dates).toContain(`${today.slice(0, 7)}-12`);
    }
  });

  it('annuelle toujours valide après plusieurs décennies', () => {
    for (const years of [1, 5, 15, 40, 70]) {
      const today = `${2026 + years}-11-20`;
      const dates = plan(yearly, today);
      expect(dates).toContain(`${2026 + years}-11-12`); // l'échéance de l'année, passée
      expect(dates).toContain(`${2027 + years}-11-12`); // la suivante, toujours présente
      expect(dates).toHaveLength(years + 2);
    }
  });

  it('mois lointain : seule l\'échéance de ce mois s\'ajoute, jamais les mois d\'entre-deux', () => {
    const base = plan(monthly, '2026-11-01');
    for (const viewedMonth of ['2027-09', '2030-11', '2040-01', '2099-12']) {
      const withView = plan(monthly, '2026-11-01', viewedMonth);
      expect(withView).toEqual([...base, `${viewedMonth}-12`]);
    }
    // Un mois déjà couvert, passé ou invalide ne change rien.
    for (const viewedMonth of ['2026-12', '2027-05', '2025-01', 'nimporte', '2027-13']) {
      expect(plan(monthly, '2026-11-01', viewedMonth)).toEqual(base);
    }
  });

  it('mois lointain d\'une série annuelle : uniquement si c\'est son mois', () => {
    const base = plan(yearly, '2026-11-01');
    expect(plan(yearly, '2026-11-01', '2040-11')).toEqual([...base, '2040-11-12']);
    expect(plan(yearly, '2026-11-01', '2040-03')).toEqual(base);
  });

  it('mois consulté très lointain : coût constant, nombre de dates inchangé à une unité près', () => {
    for (const viewedMonth of ['2200-06', '2500-01', '2999-12']) {
      expect(plan(monthly, '2026-11-01', viewedMonth)).toHaveLength(plan(monthly, '2026-11-01').length + 1);
    }
  });

  it('aucune génération infinie ni massive : le nombre de dates reste borné à toutes les époques', () => {
    for (const anchor of ['2026-11-12', '2026-01-31', '2028-02-29']) {
      for (const recurrence of ['monthly', 'yearly'] as const) {
        for (const today of ['2026-11-01', '2036-02-29', '2056-12-31', '2126-06-15']) {
          const dates = plan({ anchor, recurrence, stoppedOn: null }, today, '2999-12');
          expect(dates.length).toBeLessThanOrEqual(MAX_PLANNED_DATES + 2);
        }
      }
    }
  });

  it('ancre absurde (1900) : la matérialisation est bornée et la série garde une échéance à venir', () => {
    const dates = plan({ anchor: '1900-01-31', recurrence: 'monthly', stoppedOn: null }, '2026-11-01');
    expect(dates.length).toBeLessThanOrEqual(MAX_PLANNED_DATES + 1);
    expect(dates.some((date) => date > '2026-11-01')).toBe(true);
    expect(dates[dates.length - 1]).toBe('2027-05-31');
    // Les plus récentes sont gardées : la fenêtre glisse, elle ne fige pas la série.
    expect(dates[0] >= '1996-01-01').toBe(true);
  });

  it('dueDatesThrough : fenêtre bornée sur les dates les plus récentes, ordre croissant', () => {
    const dates = dueDatesThrough('1900-01-31', 'monthly', '2026-11-30');
    expect(dates).toHaveLength(MAX_PLANNED_DATES);
    expect(dates[dates.length - 1]).toBe('2026-11-30');
    expect([...dates].sort()).toEqual(dates);
    expect(dueDatesThrough('2026-11-12', 'monthly', '2026-11-11')).toEqual([]); // avant l'ancre
    expect(dueDatesThrough('2026-11-12', 'monthly', '2026-11-12')).toEqual(['2026-11-12']);
    expect(dueDatesThrough('2026-11-12', 'yearly', '2029-11-11')).toEqual(['2026-11-12', '2027-11-12', '2028-11-12']);
  });

  it('seule la date d\'arrêt termine la série : rien après, même pour un mois consulté lointain', () => {
    const stopped = { ...monthly, stoppedOn: '2027-01-31' };
    expect(plan(stopped, '2026-11-01')).toEqual(['2026-11-12', '2026-12-12', '2027-01-12']);
    expect(plan(stopped, '2028-06-01', '2040-01')).toEqual(['2026-11-12', '2026-12-12', '2027-01-12']);
    expect(plan({ ...yearly, stoppedOn: '2030-12-31' }, '2040-01-01', '2040-11')).toEqual([
      '2026-11-12', '2027-11-12', '2028-11-12', '2029-11-12', '2030-11-12',
    ]);
    // Arrêtée le jour de l'échéance : cette échéance reste, la suivante n'existe pas.
    expect(plan({ ...monthly, stoppedOn: '2026-12-12' }, '2027-03-01', '2027-02')).toEqual(['2026-11-12', '2026-12-12']);
  });

  it('une série oubliée depuis des années garde toutes ses échéances impayées (jusqu\'à la fenêtre de rattrapage)', () => {
    const dates = plan(monthly, '2031-11-01'); // l'application n'a pas servi pendant 5 ans
    expect(dates.slice(0, 3)).toEqual(['2026-11-12', '2026-12-12', '2027-01-12']);
    expect(dates).toContain('2030-10-12');
    expect(dates).toContain('2032-05-12');
    expect(dates).toHaveLength(67);
  });

  it('février et années bissextiles : le 29 février annuel revient le 29 en 2032, 2036, 2040… et le 28 sinon', () => {
    const leap = { anchor: '2028-02-29', recurrence: 'yearly' as const, stoppedOn: null };
    expect(dueDateInMonth(leap.anchor, 'yearly', '2032-02')).toBe('2032-02-29');
    expect(dueDateInMonth(leap.anchor, 'yearly', '2033-02')).toBe('2033-02-28');
    expect(dueDateInMonth(leap.anchor, 'yearly', '2100-02')).toBe('2100-02-28'); // 2100 n'est pas bissextile
    expect(dueDateInMonth(leap.anchor, 'yearly', '2400-02')).toBe('2400-02-29'); // 2400 l'est
    expect(plan(leap, '2040-03-01')).toContain('2040-02-29');
    // Mensuelle du 30 : février se replie, puis le 30 revient.
    expect(dueDateInMonth('2027-01-30', 'monthly', '2040-02')).toBe('2040-02-29');
    expect(dueDateInMonth('2027-01-30', 'monthly', '2041-02')).toBe('2041-02-28');
    expect(dueDateInMonth('2027-01-30', 'monthly', '2041-03')).toBe('2041-03-30');
  });

  it('passage de décembre à janvier : l\'année change sans trou, loin dans le futur aussi', () => {
    const dates = plan({ anchor: '2026-12-31', recurrence: 'monthly', stoppedOn: null }, '2055-12-15');
    expect(dates.slice(-7)).toEqual(['2055-12-31', '2056-01-31', '2056-02-29', '2056-03-31', '2056-04-30', '2056-05-31', '2056-06-30']);
    expect(dueDateInMonth('2026-12-31', 'monthly', '2057-01')).toBe('2057-01-31');
  });

  it('jours civils : même résultat dans tous les fuseaux, autour des changements d\'heure, très loin dans le futur', () => {
    const original = process.env.TZ;
    try {
      const results = ['UTC', 'Europe/Paris', 'Europe/Moscow', 'America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata'].map((zone) => {
        process.env.TZ = zone;
        return [
          plan({ anchor: '2026-03-29', recurrence: 'monthly', stoppedOn: null }, '2041-10-25', '2060-10').join(','),
          plan({ anchor: '2026-10-25', recurrence: 'yearly', stoppedOn: null }, '2056-03-29', '2070-10').join(','),
          dueDateInMonth('2026-01-31', 'monthly', '2044-02'),
          daysBetween('2041-03-30', '2041-03-31'),
        ];
      });
      for (const result of results) expect(result).toEqual(results[0]);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('est idempotente : le plan ne dépend que de ses entrées, à n\'importe quelle date', () => {
    for (const today of ['2026-11-01', '2041-06-30', '2099-12-31']) {
      expect(plan(monthly, today, '2150-03')).toEqual(plan(monthly, today, '2150-03'));
    }
  });
});

describe('statuts', () => {
  const status = (dueOn: string, today: string, paidOn: string | null = null) => billStatus({ dueOn, paidOn }, today);

  it('payée l\'emporte sur tout, même si la date est passée', () => {
    expect(status('2026-01-01', '2026-11-01', '2026-01-02')).toBe('paid');
    expect(status('2027-01-01', '2026-11-01', '2026-11-01')).toBe('paid');
  });

  it('en retard seulement si la date est strictement antérieure à aujourd\'hui', () => {
    expect(status('2026-10-31', '2026-11-01')).toBe('overdue');
    expect(status('2026-11-01', '2026-11-01')).toBe('today');
  });

  it('bientôt : de demain à 7 jours inclus, puis à venir', () => {
    expect(SOON_WINDOW_DAYS).toBe(7);
    expect(status('2026-11-02', '2026-11-01')).toBe('soon');
    expect(status('2026-11-08', '2026-11-01')).toBe('soon');
    expect(status('2026-11-09', '2026-11-01')).toBe('upcoming');
  });

  it('change de statut quand le jour passe, sans toucher à l\'heure', () => {
    expect(status('2026-11-12', '2026-11-11')).toBe('soon');
    expect(status('2026-11-12', '2026-11-12')).toBe('today');
    expect(status('2026-11-12', '2026-11-13')).toBe('overdue');
  });

  it('compte les jours de retard', () => {
    expect(daysOverdue({ dueOn: '2026-10-25', paidOn: null }, '2026-11-01')).toBe(7);
    expect(daysOverdue({ dueOn: '2026-11-01', paidOn: null }, '2026-11-01')).toBe(0);
    expect(daysOverdue({ dueOn: '2026-10-25', paidOn: '2026-10-26' }, '2026-11-01')).toBe(0);
  });
});

describe('montants affichés', () => {
  it('non payée : le montant prévu, ou null (à renseigner) — jamais 0', () => {
    expect(displayAmount(occ('2026-11-15', { amountCents: 15000 }))).toBe(15000);
    expect(displayAmount(occ('2026-11-15', { amountCents: null }))).toBeNull();
  });

  it('payée : le montant réellement payé, qui peut différer du prévu ou rester inconnu', () => {
    expect(displayAmount(occ('2026-11-15', { amountCents: 2999, paidOn: '2026-11-12', paidAmountCents: 3150 }))).toBe(3150);
    expect(displayAmount(occ('2026-11-15', { amountCents: 2999, paidOn: '2026-11-12', paidAmountCents: null }))).toBeNull();
  });

  it('valide les montants : null, entier positif, limite', () => {
    expect(isValidBillAmount(null)).toBe(true);
    expect(isValidBillAmount(1)).toBe(true);
    expect(isValidBillAmount(MAX_BILL_AMOUNT_CENTS)).toBe(true);
    expect(isValidBillAmount(0)).toBe(false);
    expect(isValidBillAmount(-5)).toBe(false);
    expect(isValidBillAmount(10.5)).toBe(false);
    expect(isValidBillAmount(MAX_BILL_AMOUNT_CENTS + 1)).toBe(false);
    expect(isValidBillAmount(Number.NaN)).toBe(false);
  });
});

describe('répartition par mois', () => {
  const today = '2026-11-10';

  it('sépare en retard, à venir et payées', () => {
    const list = [
      occ('2026-10-12'), // en retard (mois précédent)
      occ('2026-11-05'), // en retard (ce mois)
      occ('2026-11-10'), // aujourd'hui
      occ('2026-11-20'), // à venir
      occ('2026-12-12'), // autre mois
      occ('2026-11-03', { paidOn: '2026-11-03', paidAmountCents: 1000 }),
      occ('2026-10-03', { paidOn: '2026-10-03', paidAmountCents: 1000 }),
    ];
    const result = partitionBills(list, '2026-11', today);
    expect(result.overdue.map((o) => o.dueOn)).toEqual(['2026-10-12', '2026-11-05']);
    expect(result.upcoming.map((o) => o.dueOn)).toEqual(['2026-11-10', '2026-11-20']);
    expect(result.paid.map((o) => o.dueOn)).toEqual(['2026-11-03']);
  });

  it('une facture en retard ne disparaît pas quand on change de mois', () => {
    const list = [occ('2026-09-12')];
    for (const month of ['2026-08', '2026-09', '2026-10', '2026-11', '2027-03']) {
      expect(partitionBills(list, month, today).overdue).toHaveLength(1);
    }
  });

  it('une échéance n\'apparaît que dans une seule liste', () => {
    const list = [occ('2026-09-12'), occ('2026-11-20'), occ('2026-11-02', { paidOn: '2026-11-02' })];
    const result = partitionBills(list, '2026-11', today);
    const all = [...result.overdue, ...result.upcoming, ...result.paid];
    expect(new Set(all).size).toBe(all.length);
  });

  it('une échéance payée est classée dans le mois de son échéance', () => {
    const list = [occ('2026-10-28', { paidOn: '2026-11-02', paidAmountCents: 500 })];
    expect(partitionBills(list, '2026-10', today).paid).toHaveLength(1);
    expect(partitionBills(list, '2026-11', today).paid).toHaveLength(0);
  });
});

describe('totaux de la période', () => {
  const today = '2026-11-10';

  it('reste à payer = non payées du mois ; les retards des mois précédents sont à part', () => {
    const list = [
      occ('2026-09-12', { amountCents: 5000 }), // retard ancien
      occ('2026-10-12', { amountCents: 2999 }), // retard du mois dernier
      occ('2026-11-05', { amountCents: 1000 }), // retard de ce mois
      occ('2026-11-20', { amountCents: 15000 }),
      occ('2026-11-25', { amountCents: 300 }),
      occ('2026-11-02', { amountCents: 9999, paidOn: '2026-11-02', paidAmountCents: 9999 }), // payée : exclue
      occ('2026-12-12', { amountCents: 7000 }), // autre mois
    ];
    const summary = summarizePeriod(list, '2026-11', today);
    expect(summary.remaining).toEqual({ count: 3, knownCents: 16300, unknownCount: 0, partial: false });
    expect(summary.upcomingCount).toBe(2);
    expect(summary.overdueInPeriodCount).toBe(1);
    expect(summary.carriedOver).toEqual({ count: 2, knownCents: 7999, unknownCount: 0, partial: false });
    expect(summary.overdueCount).toBe(3);
  });

  it('ne compte jamais deux fois la même échéance', () => {
    const list = [occ('2026-10-12', { amountCents: 100 }), occ('2026-11-05', { amountCents: 200 })];
    const summary = summarizePeriod(list, '2026-11', today);
    expect(summary.remaining.knownCents + summary.carriedOver.knownCents).toBe(300);
    expect(summary.remaining.count + summary.carriedOver.count).toBe(2);
  });

  it('un montant inconnu rend le total partiel, sans le compter comme 0', () => {
    const list = [occ('2026-11-20', { amountCents: 15000 }), occ('2026-11-22', { amountCents: null })];
    const summary = summarizePeriod(list, '2026-11', today);
    expect(summary.remaining).toEqual({ count: 2, knownCents: 15000, unknownCount: 1, partial: true });
  });

  it('tous les montants inconnus : total nul MAIS partiel (il ne faut pas afficher « 0 € » comme un total)', () => {
    const summary = summarizePeriod([occ('2026-11-20', { amountCents: null })], '2026-11', today);
    expect(summary.remaining).toEqual({ count: 1, knownCents: 0, unknownCount: 1, partial: true });
  });

  it('mois sans échéance, ou tout payé : rien à payer', () => {
    expect(summarizePeriod([], '2026-11', today).remaining.count).toBe(0);
    const paid = [occ('2026-11-20', { paidOn: '2026-11-20', paidAmountCents: 100 })];
    const summary = summarizePeriod(paid, '2026-11', today);
    expect(summary.remaining.count).toBe(0);
    expect(summary.overdueCount).toBe(0);
  });

  it('additionne de grands montants sans perte (centimes entiers)', () => {
    const big = MAX_BILL_AMOUNT_CENTS;
    const list = Array.from({ length: 50 }, (_, i) => occ(`2026-11-${String(10 + (i % 20)).padStart(2, '0')}`, { amountCents: big }));
    const summary = summarizePeriod(list, '2026-11', today);
    expect(summary.remaining.knownCents).toBe(big * 50);
    expect(Number.isSafeInteger(summary.remaining.knownCents)).toBe(true);
  });

  it('un mois futur affiche ses propres échéances ; les retards actuels restent dans « reportées »', () => {
    const list = [occ('2026-10-12', { amountCents: 2999 }), occ('2027-01-12', { amountCents: 2999 })];
    const summary = summarizePeriod(list, '2027-01', today);
    expect(summary.remaining.count).toBe(1);
    expect(summary.carriedOver.count).toBe(1);
  });
});

describe('validation', () => {
  it('nettoie et valide le nom', () => {
    expect(cleanBillName('  Assurance   habitation ')).toBe('Assurance habitation');
    expect(validateBillName('   ')).toBe('empty');
    expect(validateBillName('Internet')).toBeNull();
    expect(validateBillName('я'.repeat(MAX_BILL_NAME_LENGTH))).toBeNull();
    expect(validateBillName('я'.repeat(MAX_BILL_NAME_LENGTH + 1))).toBe('too-long');
  });

  it('nettoie la note : vide devient null', () => {
    expect(cleanBillNote('  ')).toBeNull();
    expect(cleanBillNote(null)).toBeNull();
    expect(cleanBillNote(undefined)).toBeNull();
    expect(cleanBillNote(' contrat 123 ')).toBe('contrat 123');
  });

  it('valide la première échéance d\'une nouvelle facture', () => {
    expect(validateNewDueDate('2026-11-15', '2026-11-01')).toBeNull();
    expect(validateNewDueDate('2026-11-01', '2026-11-01')).toBeNull();
    expect(validateNewDueDate('2026-10-01', '2026-11-01')).toBeNull();
    expect(validateNewDueDate('2025-11-01', '2026-11-01')).toBeNull();
    expect(validateNewDueDate('2025-10-30', '2026-11-01')).toBe('too-old');
    expect(validateNewDueDate('2026-02-30', '2026-11-01')).toBe('invalid');
    expect(validateNewDueDate('demain', '2026-11-01')).toBe('invalid');
  });
});
