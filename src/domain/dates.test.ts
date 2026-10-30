import { formatShortDate, isMonthKey, monthKey, monthOfISODate, parseISODate, toISODate } from './dates';

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
