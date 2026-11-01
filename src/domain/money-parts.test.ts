import { MAX_AMOUNT_CENTS, formatMoney, formatMoneyParts, sanitizeAmountInput } from './money';

/** Intl sépare les milliers avec une espace fine (fr) ou insécable (ru) : on les compare à une espace normale. */
const plain = (value: string) => value.replace(/[  ]/g, ' ');

describe('formatMoneyParts', () => {
  it('découpe un revenu signé en français (maquette Accueil : +1 248,60 €)', () => {
    const parts = formatMoneyParts(124_860, 'fr', { signed: true });
    expect(parts.sign).toBe('+');
    expect(plain(parts.integer)).toBe('1 248');
    expect(parts.decimal).toBe(',');
    expect(parts.fraction).toBe('60');
    expect(parts.currency).toBe('€');
    expect(parts.currencyFirst).toBe(false);
  });

  it('utilise le vrai signe moins (U+2212) pour une dépense', () => {
    const parts = formatMoneyParts(-4_280, 'fr');
    expect(parts.sign).toBe('−');
    expect(parts.sign).not.toBe('-');
    expect(parts.integer).toBe('42');
    expect(parts.fraction).toBe('80');
  });

  it('n\'ajoute « + » que si `signed` est demandé', () => {
    expect(formatMoneyParts(1_000, 'fr').sign).toBe('');
    expect(formatMoneyParts(1_000, 'fr', { signed: true }).sign).toBe('+');
  });

  it('ne met aucun signe sur zéro, même signé', () => {
    expect(formatMoneyParts(0, 'fr', { signed: true }).sign).toBe('');
    expect(formatMoneyParts(0, 'fr').integer).toBe('0');
  });

  it('masque « ,00 » des montants ronds avec fraction: auto, sans arrondir les autres', () => {
    const round = formatMoneyParts(31_200, 'fr', { fraction: 'auto' });
    expect(round.integer).toBe('312');
    expect(round.decimal).toBe('');
    expect(round.fraction).toBe('');

    const withCents = formatMoneyParts(31_240, 'fr', { fraction: 'auto' });
    expect(withCents.integer).toBe('312');
    expect(withCents.decimal).toBe(',');
    expect(withCents.fraction).toBe('40');
  });

  it('garde les décimales par défaut, même pour un montant rond', () => {
    expect(formatMoneyParts(15_000, 'fr').fraction).toBe('00');
  });

  it('gère le russe (séparateur décimal « , », milliers en espace insécable)', () => {
    const parts = formatMoneyParts(-90_140, 'ru');
    expect(parts.sign).toBe('−');
    expect(parts.integer).toBe('901');
    expect(parts.decimal).toBe(',');
    expect(parts.fraction).toBe('40');
    expect(parts.currency).toBe('€');
    expect(plain(formatMoneyParts(123_456_789, 'ru').integer)).toBe('1 234 567');
  });

  it('gère le montant maximal sans perdre de chiffre', () => {
    const parts = formatMoneyParts(MAX_AMOUNT_CENTS, 'fr');
    expect(plain(parts.integer)).toBe('999 999 999');
    expect(parts.fraction).toBe('99');
  });

  it('reconstitue exactement le texte de formatMoney (au signe près)', () => {
    for (const cents of [0, 5, 99, 100, 4_280, 124_860, 99_999_999_999]) {
      for (const locale of ['fr', 'ru'] as const) {
        const parts = formatMoneyParts(cents, locale);
        const rebuilt = `${parts.integer}${parts.decimal}${parts.fraction} ${parts.currency}`;
        expect(plain(rebuilt)).toBe(plain(formatMoney(cents, locale)));
      }
    }
  });

  it('refuse un montant qui n\'est pas un entier de centimes', () => {
    expect(() => formatMoneyParts(12.5, 'fr')).toThrow(RangeError);
  });
});

describe('sanitizeAmountInput', () => {
  it('convertit la virgule du clavier français en point canonique', () => {
    expect(sanitizeAmountInput('12,5')).toBe('12.5');
    expect(sanitizeAmountInput('12.50')).toBe('12.50');
  });

  it('ignore les caractères qui ne sont ni chiffres ni séparateur', () => {
    expect(sanitizeAmountInput('1 2,5 €')).toBe('12.5');
    expect(sanitizeAmountInput('abc')).toBe('');
    expect(sanitizeAmountInput('-5')).toBe('5');
  });

  it('applique les mêmes limites que le pavé : une seule virgule, 2 décimales, pas de zéro initial', () => {
    expect(sanitizeAmountInput('1,2,3')).toBe('1.23');
    expect(sanitizeAmountInput('1,234')).toBe('1.23');
    expect(sanitizeAmountInput('007')).toBe('7');
    expect(sanitizeAmountInput(',5')).toBe('0.5');
    expect(sanitizeAmountInput('1234567890')).toBe('123456789');
  });

  it('gère la suppression : le texte raccourci redonne la saisie précédente', () => {
    expect(sanitizeAmountInput('12.5'.slice(0, -1))).toBe('12.');
    expect(sanitizeAmountInput('')).toBe('');
  });
});
