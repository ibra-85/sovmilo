import {
  MAX_AMOUNT_CENTS,
  applyKeypadKey,
  centsToInputString,
  formatKeypadValue,
  formatMoney,
  getCurrencySymbol,
  getDecimalSeparator,
  keypadValueToCents,
  parseAmountToCents,
  type KeypadKey,
} from './money';

// Intl insère des espaces insécables (U+00A0 / U+202F) : on les remplace par un espace normal pour comparer.
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('parseAmountToCents', () => {
  it.each([
    ['12,50', 1250],
    ['12.50', 1250],
    ['12,5', 1250],
    ['12', 1200],
    ['0', 0],
    ['0,00', 0],
    ['0,05', 5],
    ['0,99', 99],
    [',5', 50],
    ['12,', 1200],
    ['  12,50  ', 1250],
  ])('lit « %s » comme %i centimes', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it('gère les séparateurs de milliers (espace, espace insécable, point, virgule)', () => {
    expect(parseAmountToCents('1 234,50')).toBe(123450);
    expect(parseAmountToCents('1 234,50')).toBe(123450);
    expect(parseAmountToCents('1 234,50')).toBe(123450);
    expect(parseAmountToCents('1.234,50')).toBe(123450);
    expect(parseAmountToCents('1,234.50')).toBe(123450);
  });

  it('gère les grands montants sans perte de précision', () => {
    expect(parseAmountToCents('1000000')).toBe(100_000_000);
    expect(parseAmountToCents('999999999,99')).toBe(MAX_AMOUNT_CENTS);
    expect(parseAmountToCents('1000000000')).toBeNull();
    expect(parseAmountToCents('99999999999999999999')).toBeNull();
  });

  it('évite les erreurs d’arrondi des flottants (19,99 et 0,29)', () => {
    expect(parseAmountToCents('19,99')).toBe(1999);
    expect(parseAmountToCents('0,29')).toBe(29); // 0.29 * 100 = 28.999999999999996 en flottant
    expect(parseAmountToCents('1,15')).toBe(115); // 1.15 * 100 = 114.99999999999999
  });

  it.each(['', '   ', ',', '.', '-5', '+5', 'abc', '12 €', '12,555', '1,234', '1.2.3', '12,5,3', '1.234,5.0', '--'])(
    'refuse « %s »',
    (input) => {
      expect(parseAmountToCents(input)).toBeNull();
    },
  );
});

describe('centsToInputString', () => {
  it('renvoie un texte éditable', () => {
    expect(centsToInputString(0)).toBe('0');
    expect(centsToInputString(1200)).toBe('12');
    expect(centsToInputString(1250)).toBe('12,50');
    expect(centsToInputString(5)).toBe('0,05');
    expect(centsToInputString(123456, '.')).toBe('1234.56');
  });

  it('est l’inverse de parseAmountToCents', () => {
    for (const cents of [0, 1, 9, 10, 99, 100, 101, 1999, 123456, MAX_AMOUNT_CENTS]) {
      expect(parseAmountToCents(centsToInputString(cents))).toBe(cents);
    }
  });

  it('refuse les flottants et les négatifs', () => {
    expect(() => centsToInputString(12.5)).toThrow(RangeError);
    expect(() => centsToInputString(-1)).toThrow(RangeError);
    expect(() => centsToInputString(Number.NaN)).toThrow(RangeError);
  });
});

describe('formatMoney', () => {
  it('formate en euros selon la langue', () => {
    expect(plain(formatMoney(123450, 'fr'))).toBe('1 234,50 €');
    expect(plain(formatMoney(123450, 'ru'))).toBe('1 234,50 €');
    expect(plain(formatMoney(0, 'fr'))).toBe('0,00 €');
    expect(plain(formatMoney(5, 'fr'))).toBe('0,05 €');
  });

  it('formate les grands montants', () => {
    expect(plain(formatMoney(100_000_000, 'fr'))).toBe('1 000 000,00 €');
    expect(plain(formatMoney(MAX_AMOUNT_CENTS, 'fr'))).toBe('999 999 999,99 €');
  });

  it('affiche le signe des montants négatifs (reste à dépenser dépassé)', () => {
    expect(plain(formatMoney(-1250, 'fr'))).toMatch(/^[-−]12,50 €$/);
  });

  it('ajoute « + » seulement si signed est demandé, jamais pour zéro', () => {
    expect(plain(formatMoney(1250, 'fr', { signed: true }))).toBe('+12,50 €');
    expect(plain(formatMoney(-1250, 'fr', { signed: true }))).toMatch(/^[-−]12,50 €$/);
    expect(plain(formatMoney(0, 'fr', { signed: true }))).toBe('0,00 €');
    expect(plain(formatMoney(1250, 'fr'))).toBe('12,50 €');
  });

  it('refuse les montants non entiers', () => {
    expect(() => formatMoney(12.5, 'fr')).toThrow(RangeError);
  });
});

describe('getDecimalSeparator', () => {
  it('est la virgule en français et en russe', () => {
    expect(getDecimalSeparator('fr')).toBe(',');
    expect(getDecimalSeparator('ru')).toBe(',');
  });
});

describe('getCurrencySymbol', () => {
  it('renvoie « € » pour l’euro', () => {
    expect(getCurrencySymbol('fr')).toBe('€');
    expect(getCurrencySymbol('ru')).toBe('€');
  });
});

describe('pavé numérique', () => {
  const type = (keys: KeypadKey[], start = '') => keys.reduce(applyKeypadKey, start);

  it('compose un montant touche par touche', () => {
    expect(type(['1', '2', 'decimal', '5'])).toBe('12.5');
    expect(keypadValueToCents(type(['1', '2', 'decimal', '5']))).toBe(1250);
  });

  it('commence par « 0. » quand on appuie sur la virgule en premier', () => {
    expect(type(['decimal', '5'])).toBe('0.5');
  });

  it('ignore une deuxième virgule', () => {
    expect(type(['1', 'decimal', '2', 'decimal', '3'])).toBe('1.23');
  });

  it('limite à 2 décimales', () => {
    expect(type(['1', 'decimal', '2', '5', '9'])).toBe('1.25');
  });

  it('n’empile pas les zéros initiaux', () => {
    expect(type(['0', '0', '0'])).toBe('0');
    expect(type(['0', '5'])).toBe('5');
    expect(type(['0', 'decimal', '0', '5'])).toBe('0.05');
  });

  it('limite à 9 chiffres avant la virgule', () => {
    const nine = type(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(nine).toBe('123456789');
    expect(applyKeypadKey(nine, '0')).toBe(nine);
    expect(keypadValueToCents(nine)).toBeLessThanOrEqual(MAX_AMOUNT_CENTS);
  });

  it('efface chiffre par chiffre, y compris la virgule', () => {
    expect(type(['backspace'], '1.5')).toBe('1.');
    expect(type(['backspace', 'backspace'], '1.5')).toBe('1');
    expect(type(['backspace'], '')).toBe('');
  });

  it('affiche la saisie dans la langue, avec séparateur de milliers', () => {
    expect(formatKeypadValue('', 'fr')).toBe('0');
    expect(formatKeypadValue('7', 'fr')).toBe('7');
    expect(plain(formatKeypadValue('1234', 'fr'))).toBe('1 234');
    expect(formatKeypadValue('12.5', 'fr')).toBe('12,5');
    expect(formatKeypadValue('0.', 'ru')).toBe('0,');
    expect(plain(formatKeypadValue('1234567.05', 'ru'))).toBe('1 234 567,05');
    expect(plain(formatKeypadValue('999999999', 'fr'))).toBe('999 999 999');
  });

  it('vaut 0 centime quand la saisie est vide', () => {
    expect(keypadValueToCents('')).toBe(0);
    expect(keypadValueToCents('0')).toBe(0);
    expect(keypadValueToCents('3.')).toBe(300);
  });
});
