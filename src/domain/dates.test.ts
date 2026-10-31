import {
  daysInMonth,
  formatMonthName,
  formatMonthShort,
  formatMonthRange,
  formatWeekday,
  recentMonths,
  shiftMonth,
  formatLongDate,
  formatMonthLabel,
  formatShortDate,
  isMonthKey,
  monthKey,
  monthOfISODate,
  parseISODate,
  shiftISODate,
  toISODate,
} from './dates';

describe('toISODate / monthKey', () => {
  it('utilise la date LOCALE, pas UTC', () => {
    // 00h30 le 1er mars en heure locale : toISOString() donnerait 28 février dans un fuseau à l'est de UTC.
    const justAfterMidnight = new Date(2026, 2, 1, 0, 30);
    expect(toISODate(justAfterMidnight)).toBe('2026-03-01');
    expect(monthKey(justAfterMidnight)).toBe('2026-03');
  });

  it('complète les zéros', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('parseISODate / monthOfISODate', () => {
  it('lit une date valide', () => {
    const date = parseISODate('2026-03-17');
    expect(date && [date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 17]);
    expect(monthOfISODate('2026-03-17')).toBe('2026-03');
  });

  it('accepte le 29 février d’une année bissextile seulement', () => {
    expect(parseISODate('2028-02-29')).not.toBeNull();
    expect(parseISODate('2026-02-29')).toBeNull();
  });

  it.each(['', '2026-3-1', '2026-13-01', '2026-02-31', '17/03/2026', 'hier'])('refuse « %s »', (value) => {
    expect(parseISODate(value)).toBeNull();
    expect(monthOfISODate(value)).toBeNull();
  });
});

describe('isMonthKey', () => {
  it('valide le format YYYY-MM', () => {
    expect(isMonthKey('2026-03')).toBe(true);
    expect(isMonthKey('2026-00')).toBe(false);
    expect(isMonthKey('2026-3')).toBe(false);
    expect(isMonthKey('2026-03-01')).toBe(false);
  });
});

describe('formatShortDate', () => {
  it('formate selon la langue', () => {
    expect(formatShortDate('2026-03-17', 'fr')).toMatch(/^17 mars$/);
    expect(formatShortDate('2026-03-17', 'ru')).toMatch(/^17 мар\.$/);
  });

  it('renvoie la valeur brute si la date est invalide', () => {
    expect(formatShortDate('n’importe quoi', 'fr')).toBe('n’importe quoi');
  });
});

describe('shiftISODate', () => {
  it('recule et avance d’un jour, y compris sur fin de mois et d’année', () => {
    expect(shiftISODate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftISODate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftISODate('2028-02-28', 1)).toBe('2028-02-29'); // année bissextile
    expect(shiftISODate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('renvoie null pour une date inexistante', () => {
    expect(shiftISODate('2026-02-30', 1)).toBeNull();
  });
});

describe('formatMonthLabel', () => {
  it('met une majuscule et inclut l’année', () => {
    expect(formatMonthLabel('2026-03', 'fr')).toBe('Mars 2026');
    expect(formatMonthLabel('2026-03', 'ru')).toMatch(/^Март 2026/);
  });

  it('renvoie la valeur brute si le mois est invalide', () => {
    expect(formatMonthLabel('2026-13', 'fr')).toBe('2026-13');
  });
});

describe('formatLongDate', () => {
  it('affiche le jour de la semaine, la date et l’année', () => {
    expect(formatLongDate('2026-03-17', 'fr')).toBe('mardi 17 mars 2026');
  });

  it('renvoie la valeur brute si la date est invalide', () => {
    expect(formatLongDate('nope', 'fr')).toBe('nope');
  });
});

describe('shiftMonth / recentMonths', () => {
  it('passe d’une année à l’autre dans les deux sens', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
    expect(shiftMonth('2026-03', -15)).toBe('2024-12');
  });

  it('liste les derniers mois du plus récent au plus ancien', () => {
    expect(recentMonths('2026-02', 4)).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
  });

  it('refuse un mois invalide', () => {
    expect(() => shiftMonth('2026-13', 1)).toThrow(RangeError);
  });
});

describe('daysInMonth', () => {
  it.each([
    ['2026-02', 28],
    ['2028-02', 29],
    ['2026-04', 30],
    ['2026-12', 31],
  ])('%s a %i jours', (month, days) => {
    expect(daysInMonth(month)).toBe(days);
  });
});

describe('formatMonthRange / formatMonthName / formatWeekday', () => {
  it('écrit la période du mois en français avec « 1er »', () => {
    expect(formatMonthRange('2026-10', 'fr')).toBe('1er – 31 octobre 2026');
    expect(formatMonthRange('2026-02', 'fr')).toBe('1er – 28 février 2026');
  });

  it('écrit la période du mois en russe sans « 1er »', () => {
    expect(formatMonthRange('2026-10', 'ru')).toMatch(/^1 – 31 октября 2026/);
  });

  it('donne le nom du mois en minuscules', () => {
    expect(formatMonthName('2026-10', 'fr')).toBe('octobre');
    expect(formatMonthName('2026-10', 'ru')).toBe('октябрь');
  });

  it('donne le jour de la semaine avec une majuscule', () => {
    expect(formatWeekday('2026-10-31', 'fr')).toBe('Samedi');
    expect(formatWeekday('2026-10-29', 'fr')).toBe('Jeudi');
    expect(formatWeekday('pas une date', 'fr')).toBe('pas une date');
  });
});

describe('formatMonthShort', () => {
  it('abrège le nom du mois', () => {
    expect(formatMonthShort('2026-10', 'fr')).toBe('oct.');
    expect(formatMonthShort('2026-10', 'ru')).toMatch(/^окт/);
  });
});
