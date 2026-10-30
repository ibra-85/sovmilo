import {
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
