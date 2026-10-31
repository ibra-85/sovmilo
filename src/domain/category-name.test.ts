import { MAX_CATEGORY_NAME_LENGTH, cleanCategoryName, validateCategoryName } from './category-name';

describe('cleanCategoryName', () => {
  it('retire les espaces de début et de fin et réduit les espaces multiples', () => {
    expect(cleanCategoryName('  Jardin   et  serre ')).toBe('Jardin et serre');
  });
});

describe('validateCategoryName', () => {
  const existing = ['Courses', 'Santé', 'Électricité'];

  it('accepte un nom nouveau', () => {
    expect(validateCategoryName('Animaux', existing)).toBeNull();
  });

  it('refuse un nom vide ou fait d’espaces', () => {
    expect(validateCategoryName('', existing)).toBe('empty');
    expect(validateCategoryName('   ', existing)).toBe('empty');
  });

  it('refuse un doublon à la casse, aux accents et aux espaces près', () => {
    expect(validateCategoryName('courses', existing)).toBe('duplicate');
    expect(validateCategoryName(' SANTE ', existing)).toBe('duplicate');
    expect(validateCategoryName('electricite', existing)).toBe('duplicate');
  });

  it('reconnaît un doublon en russe (« ё » = « е »)', () => {
    expect(validateCategoryName('ёлка', ['Елка'])).toBe('duplicate');
  });

  it('accepte exactement la longueur maximale et refuse au-delà', () => {
    expect(validateCategoryName('a'.repeat(MAX_CATEGORY_NAME_LENGTH), [])).toBeNull();
    expect(validateCategoryName('a'.repeat(MAX_CATEGORY_NAME_LENGTH + 1), [])).toBe('tooLong');
  });
});
