import {
  CATEGORY_ICON_IDS,
  FALLBACK_CATEGORY_ICON,
  isCategoryIconId,
  parseCategoryIcon,
  serializeCategoryIcon,
} from './category-icon';

describe('parseCategoryIcon', () => {
  it('lit une icône du catalogue', () => {
    expect(parseCategoryIcon('icon:groceries')).toEqual({ kind: 'icon', id: 'groceries' });
  });

  it('lit un emoji tel quel, y compris composé (famille, drapeau, teinte de peau)', () => {
    expect(parseCategoryIcon('🐶')).toEqual({ kind: 'emoji', emoji: '🐶' });
    expect(parseCategoryIcon('👨‍👩‍👧‍👦')).toEqual({ kind: 'emoji', emoji: '👨‍👩‍👧‍👦' });
    expect(parseCategoryIcon('🇫🇷')).toEqual({ kind: 'emoji', emoji: '🇫🇷' });
    expect(parseCategoryIcon('👍🏽')).toEqual({ kind: 'emoji', emoji: '👍🏽' });
  });

  it('ignore les espaces autour de la valeur', () => {
    expect(parseCategoryIcon('  icon:bills ')).toEqual({ kind: 'icon', id: 'bills' });
    expect(parseCategoryIcon(' 🌿 ')).toEqual({ kind: 'emoji', emoji: '🌿' });
  });

  it('renvoie l\'icône de remplacement pour un identifiant inconnu', () => {
    expect(parseCategoryIcon('icon:does-not-exist')).toEqual({ kind: 'icon', id: FALLBACK_CATEGORY_ICON });
    expect(parseCategoryIcon('icon:')).toEqual({ kind: 'icon', id: FALLBACK_CATEGORY_ICON });
  });

  it('renvoie l\'icône de remplacement pour une valeur vide, nulle ou absente', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(parseCategoryIcon(value)).toEqual({ kind: 'icon', id: FALLBACK_CATEGORY_ICON });
    }
  });

  it('rejette un long texte qui n\'est pas un emoji', () => {
    expect(parseCategoryIcon('ceci est une description beaucoup trop longue')).toEqual({
      kind: 'icon',
      id: FALLBACK_CATEGORY_ICON,
    });
  });
});

describe('serializeCategoryIcon', () => {
  it('fait l\'aller-retour pour chaque icône du catalogue', () => {
    for (const id of CATEGORY_ICON_IDS) {
      expect(parseCategoryIcon(serializeCategoryIcon({ kind: 'icon', id }))).toEqual({ kind: 'icon', id });
    }
  });

  it('fait l\'aller-retour pour un emoji', () => {
    expect(parseCategoryIcon(serializeCategoryIcon({ kind: 'emoji', emoji: '🐶' }))).toEqual({
      kind: 'emoji',
      emoji: '🐶',
    });
  });

  it('stocke un identifiant, jamais un tracé', () => {
    expect(serializeCategoryIcon({ kind: 'icon', id: 'paw' })).toBe('icon:paw');
  });
});

describe('catalogue', () => {
  it('ne contient pas de doublon et inclut l\'icône de remplacement', () => {
    expect(new Set(CATEGORY_ICON_IDS).size).toBe(CATEGORY_ICON_IDS.length);
    expect(isCategoryIconId(FALLBACK_CATEGORY_ICON)).toBe(true);
    expect(isCategoryIconId('nope')).toBe(false);
  });
});
