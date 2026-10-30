import { EMPTY_FILTERS, countActiveFilters, filterHistory, groupByMonth, normalizeSearch, type HistoryItem } from './history';

const item = (overrides: Partial<HistoryItem> = {}): HistoryItem => ({
  type: 'expense',
  amountCents: 1250,
  categoryId: 'groceries',
  paymentMethod: 'card',
  occurredOn: '2026-03-17',
  note: null,
  categoryName: 'Courses',
  ...overrides,
});

describe('normalizeSearch', () => {
  it('ignore la casse, les accents et les espaces en trop', () => {
    expect(normalizeSearch('  ÉLECTRICITÉ   Été ')).toBe('electricite ete');
  });

  it('traite « ё » comme « е » en russe', () => {
    expect(normalizeSearch('Жильё')).toBe('жилье');
  });
});

describe('filterHistory', () => {
  const groceries = item({ note: 'Pain et lait' });
  const salary = item({ type: 'income', amountCents: 150_000, categoryId: 'salary', categoryName: 'Salaire', paymentMethod: 'other' });
  const savings = item({ type: 'transfer', amountCents: 20_000, categoryId: null, categoryName: '', paymentMethod: 'transfer' });
  const cash = item({ amountCents: 899, categoryId: 'health', categoryName: 'Santé', paymentMethod: 'cash', note: 'Pharmacie' });
  const all = [groceries, salary, savings, cash];

  it('ne filtre rien sans critère et garde l’ordre', () => {
    expect(filterHistory(all, EMPTY_FILTERS)).toEqual(all);
  });

  it('filtre par type', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, type: 'transfer' })).toEqual([savings]);
    expect(filterHistory(all, { ...EMPTY_FILTERS, type: 'expense' })).toEqual([groceries, cash]);
  });

  it('filtre par moyen de paiement', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, paymentMethod: 'cash' })).toEqual([cash]);
  });

  it('filtre par catégorie', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, categoryId: 'salary' })).toEqual([salary]);
  });

  it('combine les filtres (ET)', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, type: 'expense', paymentMethod: 'cash' })).toEqual([cash]);
    expect(filterHistory(all, { ...EMPTY_FILTERS, type: 'income', paymentMethod: 'cash' })).toEqual([]);
  });

  it('cherche dans la note, sans tenir compte de la casse ni des accents', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: 'LAIT' })).toEqual([groceries]);
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: 'sante' })).toEqual([cash]);
  });

  it('cherche dans le nom de la catégorie', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: 'salaire' })).toEqual([salary]);
  });

  it('exige que chaque mot soit trouvé', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: 'courses pain' })).toEqual([groceries]);
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: 'courses pharmacie' })).toEqual([]);
  });

  it('cherche un montant, avec la virgule française ou le point', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: '8,99' })).toEqual([cash]);
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: '8.99' })).toEqual([cash]);
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: '1500' })).toEqual([salary]);
  });

  it('ne confond pas un montant avec un autre', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: '8,9' })).toEqual([]); // 8,90 € n’existe pas
  });

  it('une recherche d’espaces seuls ne filtre rien', () => {
    expect(filterHistory(all, { ...EMPTY_FILTERS, query: '   ' })).toEqual(all);
  });

  it('gère une liste vide', () => {
    expect(filterHistory([], { ...EMPTY_FILTERS, query: 'x' })).toEqual([]);
  });
});

describe('countActiveFilters', () => {
  it('compte type, paiement et catégorie, pas la recherche', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, query: 'x' })).toBe(0);
    expect(countActiveFilters({ query: '', type: 'expense', paymentMethod: 'card', categoryId: null })).toBe(2);
    expect(countActiveFilters({ query: '', type: 'expense', paymentMethod: 'card', categoryId: 'a' })).toBe(3);
  });
});

describe('groupByMonth', () => {
  it('regroupe par mois en gardant l’ordre', () => {
    const items = [
      item({ occurredOn: '2026-03-20' }),
      item({ occurredOn: '2026-03-02' }),
      item({ occurredOn: '2026-02-28' }),
      item({ occurredOn: '2025-12-31' }),
    ];
    const groups = groupByMonth(items);
    expect(groups.map((g) => g.month)).toEqual(['2026-03', '2026-02', '2025-12']);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1, 1]);
    expect(groups[0].items.map((i) => i.occurredOn)).toEqual(['2026-03-20', '2026-03-02']);
  });

  it('renvoie une liste vide sans opération', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
