import {
  MAX_ITEM_NAME_LENGTH,
  MAX_LIST_NAME_LENGTH,
  MAX_QUANTITY_MILLI,
  MAX_UNIT_PRICE_CENTS,
  SHOPPING_UNITS,
  cleanShoppingName,
  defaultQuantityMilli,
  lineTotalCents,
  parseQuantity,
  parseUnitPrice,
  priceUnitOf,
  quantityToInputString,
  stepQuantity,
  summarizeItems,
  unitDecimals,
  unitStepMilli,
  validateItemName,
  validateListName,
  type ShoppingItemLike,
  type ShoppingUnit,
} from './shopping';

describe('noms', () => {
  it('nettoie les espaces (début, fin, doublons, insécables)', () => {
    expect(cleanShoppingName('  Pain   complet ')).toBe('Pain complet');
    expect(cleanShoppingName('Lait demi écrémé')).toBe('Lait demi écrémé');
  });

  it('refuse un nom vide ou fait uniquement d’espaces', () => {
    expect(validateListName('')).toBe('empty');
    expect(validateListName('     ')).toBe('empty');
    expect(validateItemName('')).toBe('empty');
  });

  it('accepte exactement la longueur maximale et refuse au-delà (après nettoyage)', () => {
    expect(validateListName('a'.repeat(MAX_LIST_NAME_LENGTH))).toBeNull();
    expect(validateListName('a'.repeat(MAX_LIST_NAME_LENGTH + 1))).toBe('too-long');
    expect(validateItemName('б'.repeat(MAX_ITEM_NAME_LENGTH))).toBeNull();
    expect(validateItemName('б'.repeat(MAX_ITEM_NAME_LENGTH + 1))).toBe('too-long');
    // les espaces superflus ne comptent pas dans la longueur
    expect(validateItemName(`  ${'a'.repeat(MAX_ITEM_NAME_LENGTH)}   `)).toBeNull();
  });
});

describe('parseQuantity', () => {
  it.each([
    ['3', 'piece', 3000],
    ['1,5', 'kg', 1500],
    ['1.5', 'kg', 1500],
    ['0,25', 'kg', 250],
    [',5', 'l', 500],
    ['2,', 'kg', 2000],
    ['1,500', 'kg', 1500],
    ['250', 'g', 250_000],
    [' 1 000 ', 'ml', 1_000_000],
    ['2,0', 'piece', 2000], // « 2,0 » = 2 : les zéros inutiles ne sont pas des décimales
  ] as const)('« %s » en %s → %i millièmes', (input, unit, milli) => {
    expect(parseQuantity(input, unit)).toEqual({ ok: true, milli });
  });

  it('refuse les décimales là où elles n’ont pas de sens', () => {
    expect(parseQuantity('2,5', 'piece')).toEqual({ ok: false, reason: 'decimals' });
    expect(parseQuantity('1,5', 'g')).toEqual({ ok: false, reason: 'decimals' });
    expect(parseQuantity('0,5', 'pack')).toEqual({ ok: false, reason: 'decimals' });
    expect(parseQuantity('1,2345', 'kg')).toEqual({ ok: false, reason: 'decimals' });
  });

  it('refuse zéro, vide, lettres, négatif et séparateurs multiples', () => {
    expect(parseQuantity('0', 'piece')).toEqual({ ok: false, reason: 'zero' });
    expect(parseQuantity('0,000', 'kg')).toEqual({ ok: false, reason: 'zero' });
    for (const bad of ['', ' ', ',', '.', 'abc', '2 kg', '-1', '1,2,3', '1.2.3', '1,000,5']) {
      expect(parseQuantity(bad, 'kg')).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('accepte la limite et refuse au-delà', () => {
    expect(parseQuantity('9999,999', 'kg')).toEqual({ ok: true, milli: MAX_QUANTITY_MILLI });
    expect(parseQuantity('10000', 'piece')).toEqual({ ok: false, reason: 'too-large' });
    expect(parseQuantity('99999999999', 'piece')).toEqual({ ok: false, reason: 'too-large' });
  });
});

describe('quantités : texte, pas', () => {
  it('quantityToInputString', () => {
    expect(quantityToInputString(1500)).toBe('1,5');
    expect(quantityToInputString(3000)).toBe('3');
    expect(quantityToInputString(250)).toBe('0,25');
    expect(quantityToInputString(1, '.')).toBe('0.001');
    expect(() => quantityToInputString(-1)).toThrow(RangeError);
    expect(() => quantityToInputString(1.5)).toThrow(RangeError);
  });

  it('quantityToInputString ↔ parseQuantity font l’aller-retour', () => {
    for (const milli of [1, 250, 500, 1000, 1500, 2750, 9_999_999]) {
      expect(parseQuantity(quantityToInputString(milli), 'kg')).toEqual({ ok: true, milli });
    }
  });

  it('stepQuantity ne passe jamais à zéro ni au-dessus du maximum', () => {
    expect(stepQuantity(1000, 1000)).toBe(2000);
    expect(stepQuantity(1500, -500)).toBe(1000);
    expect(stepQuantity(500, -500)).toBe(500); // reste au plus petit pas positif
    expect(stepQuantity(1000, -5000)).toBe(1000);
    expect(stepQuantity(MAX_QUANTITY_MILLI - 10, 1000)).toBe(MAX_QUANTITY_MILLI);
  });

  it('la quantité par défaut de chaque unité est valide pour cette unité', () => {
    for (const unit of SHOPPING_UNITS) {
      const text = quantityToInputString(defaultQuantityMilli(unit));
      expect(parseQuantity(text, unit)).toEqual({ ok: true, milli: defaultQuantityMilli(unit) });
    }
  });

  it('chaque unité a un pas valide pour ses décimales', () => {
    for (const unit of SHOPPING_UNITS) {
      const text = quantityToInputString(unitStepMilli(unit));
      expect(parseQuantity(text, unit).ok).toBe(true);
      expect(unitDecimals(unit)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('parseUnitPrice', () => {
  it('vide ou zéro = pas de prix (le prix est facultatif)', () => {
    expect(parseUnitPrice('')).toEqual({ ok: true, cents: null });
    expect(parseUnitPrice('   ')).toEqual({ ok: true, cents: null });
    expect(parseUnitPrice('0')).toEqual({ ok: true, cents: null });
    expect(parseUnitPrice('0,00')).toEqual({ ok: true, cents: null });
  });

  it('virgule française, point, espaces, une ou deux décimales', () => {
    expect(parseUnitPrice('1,20')).toEqual({ ok: true, cents: 120 });
    expect(parseUnitPrice('1.2')).toEqual({ ok: true, cents: 120 });
    expect(parseUnitPrice('0,05')).toEqual({ ok: true, cents: 5 });
    expect(parseUnitPrice('1 234,50')).toEqual({ ok: true, cents: 123_450 });
  });

  it('refuse le texte invalide, le négatif et trois décimales', () => {
    for (const bad of ['abc', '-1', '1,234', '1,2,3', '€']) {
      expect(parseUnitPrice(bad)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('plafonne à 999 999,99 €', () => {
    expect(parseUnitPrice('999999,99')).toEqual({ ok: true, cents: MAX_UNIT_PRICE_CENTS });
    expect(parseUnitPrice('1000000')).toEqual({ ok: false, reason: 'too-large' });
    expect(parseUnitPrice('99999999999999')).toEqual({ ok: false, reason: 'too-large' });
  });
});

describe('lineTotalCents : entiers, arrondi unique à la moitié supérieure', () => {
  const line = (quantityMilli: number, unit: ShoppingUnit, unitPriceCents: number | null) => ({ quantityMilli, unit, unitPriceCents });

  it('article sans prix : null (il n’entre dans aucun total)', () => {
    expect(lineTotalCents(line(2000, 'kg', null))).toBeNull();
  });

  it('pièces : quantité × prix', () => {
    expect(lineTotalCents(line(3000, 'piece', 120))).toBe(360);
    expect(lineTotalCents(line(1000, 'pack', 249))).toBe(249);
  });

  it('kg et litres décimaux', () => {
    expect(lineTotalCents(line(1500, 'kg', 399))).toBe(599); // 5,985 → 5,99 (moitié supérieure)
    expect(lineTotalCents(line(2500, 'l', 120))).toBe(300);
    expect(lineTotalCents(line(500, 'kg', 335))).toBe(168); // 1,675 → 1,68
  });

  it('g et ml : le prix est au kg / au litre', () => {
    expect(lineTotalCents(line(250_000, 'g', 420))).toBe(105); // 250 g à 4,20 €/kg
    expect(lineTotalCents(line(500_000, 'ml', 190))).toBe(95); // 500 mL à 1,90 €/L
    expect(lineTotalCents(line(1_000_000, 'g', 999))).toBe(999); // 1 kg exactement
    expect(priceUnitOf('g')).toBe('kg');
    expect(priceUnitOf('ml')).toBe('l');
    expect(priceUnitOf('piece')).toBe('piece');
  });

  it('pas d’erreur de flottant sur les cas classiques (0,1 + 0,2, 1,005…)', () => {
    expect((lineTotalCents(line(1000, 'piece', 10)) as number) + (lineTotalCents(line(1000, 'piece', 20)) as number)).toBe(30);
    expect(lineTotalCents(line(1005, 'piece', 100))).toBe(101); // 1,005 × 1,00 € = 1,005 € → 1,01 € (pas 1,00 €)
    expect(lineTotalCents(line(333, 'kg', 300))).toBe(100); // 0,333 kg × 3,00 € = 0,999 € → 1,00 €
  });

  it('valeurs maximales : reste exact et entier', () => {
    const total = lineTotalCents(line(MAX_QUANTITY_MILLI, 'piece', MAX_UNIT_PRICE_CENTS));
    expect(total).toBe(Number((BigInt(MAX_QUANTITY_MILLI) * BigInt(MAX_UNIT_PRICE_CENTS) + 500n) / 1000n));
    expect(Number.isSafeInteger(total)).toBe(true);
  });

  it('résultat toujours entier et jamais négatif', () => {
    for (const unit of SHOPPING_UNITS) {
      for (const milli of [1, 7, 333, 999, 1000, 12_345]) {
        for (const price of [1, 7, 99, 250, 12_345]) {
          const total = lineTotalCents(line(milli, unit, price));
          expect(Number.isInteger(total)).toBe(true);
          expect(total).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('summarizeItems', () => {
  let counter = 0;
  const item = (overrides: Partial<ShoppingItemLike> = {}): ShoppingItemLike => {
    counter += 1;
    return {
      quantityMilli: 1000,
      unit: 'piece',
      unitPriceCents: null,
      checked: false,
      sortOrder: counter,
      createdAt: `2026-11-01T10:00:0${counter % 10}.000Z`,
      checkedAt: null,
      ...overrides,
    };
  };

  it('liste vide : tout à zéro, total non partiel', () => {
    const summary = summarizeItems([]);
    expect(summary).toMatchObject({ total: 0, remaining: 0, checked: 0 });
    expect(summary.estimate).toEqual({ cents: 0, pricedCount: 0, unpricedCount: 0, partial: false });
  });

  it('sépare à acheter / déjà pris, dans l’ordre d’ajout puis du plus récemment coché', () => {
    const a = item({ sortOrder: 2 });
    const b = item({ sortOrder: 1 });
    const c = item({ checked: true, checkedAt: '2026-11-01T11:00:00.000Z', sortOrder: 3 });
    const d = item({ checked: true, checkedAt: '2026-11-01T12:00:00.000Z', sortOrder: 4 });
    const summary = summarizeItems([a, b, c, d]);
    expect(summary.todo).toEqual([b, a]);
    expect(summary.done).toEqual([d, c]);
    expect([summary.total, summary.remaining, summary.checked]).toEqual([4, 2, 2]);
  });

  it('le total estimé ne compte que les prix renseignés et signale qu’il est partiel', () => {
    const summary = summarizeItems([
      item({ quantityMilli: 2000, unitPriceCents: 150 }), // 3,00 €
      item({ quantityMilli: 1500, unit: 'kg', unitPriceCents: 399 }), // 5,99 €
      item({}), // sans prix
    ]);
    expect(summary.estimate).toEqual({ cents: 899, pricedCount: 2, unpricedCount: 1, partial: true });
  });

  it('un article déjà pris n’entre plus dans l’estimation', () => {
    const summary = summarizeItems([item({ unitPriceCents: 500 }), item({ unitPriceCents: 900, checked: true, checkedAt: '2026-11-01T11:00:00.000Z' })]);
    expect(summary.estimate).toEqual({ cents: 500, pricedCount: 1, unpricedCount: 0, partial: false });
  });

  it('cocher / décocher fait passer l’article d’un groupe à l’autre sans rien perdre', () => {
    const base = item({ unitPriceCents: 250, quantityMilli: 2000 });
    const before = summarizeItems([base]);
    const after = summarizeItems([{ ...base, checked: true, checkedAt: '2026-11-01T11:00:00.000Z' }]);
    const restored = summarizeItems([{ ...base, checked: false, checkedAt: null }]);
    expect([before.remaining, after.remaining, restored.remaining]).toEqual([1, 0, 1]);
    expect(before.estimate.cents).toBe(500);
    expect(after.estimate.cents).toBe(0);
    expect(restored.estimate.cents).toBe(500);
  });

  it('beaucoup d’articles chers : somme exacte en centimes', () => {
    const items = Array.from({ length: 1000 }, () => item({ quantityMilli: 3000, unitPriceCents: 9_999_999 }));
    expect(summarizeItems(items).estimate.cents).toBe(1000 * 3 * 9_999_999);
  });
});
