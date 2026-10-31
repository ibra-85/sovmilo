/**
 * Icône d'une catégorie : soit une icône du catalogue de l'application (identifiant stable), soit un emoji Unicode.
 *
 * En base, la colonne `icon` est un texte :
 *  - `icon:groceries` → icône du catalogue (jamais un composant ni un tracé SVG : on change le dessin sans migrer) ;
 *  - tout autre texte non vide (« 🛒 », « 🐶 ») → emoji, affiché tel quel avec la police emoji du téléphone.
 * Les catégories créées aux étapes 1 et 2a stockent déjà un emoji : elles restent valides sans migration.
 */

/** Identifiants du catalogue. Le fichier src/components/ui/icons.ts associe chacun à un dessin Hugeicons. */
export const CATEGORY_ICON_IDS = [
  'groceries',
  'bills',
  'cart',
  'bakery',
  'book',
  'cup',
  'gift',
  'health',
  'paw',
  'plane',
  'shirt',
  'star',
  'tag',
  'transport',
  'house',
] as const;

export type CategoryIconId = (typeof CATEGORY_ICON_IDS)[number];

/** Icône affichée quand l'identifiant est inconnu (catalogue modifié, donnée synchronisée par une version plus récente…). */
export const FALLBACK_CATEGORY_ICON: CategoryIconId = 'tag';

export type CategoryIcon = { kind: 'icon'; id: CategoryIconId } | { kind: 'emoji'; emoji: string };

const ICON_PREFIX = 'icon:';
/** Plus long qu'un emoji composé (famille, drapeau, teinte de peau) mais assez court pour rejeter un texte quelconque. */
const MAX_EMOJI_LENGTH = 16;

export function isCategoryIconId(value: string): value is CategoryIconId {
  return (CATEGORY_ICON_IDS as readonly string[]).includes(value);
}

/** Texte à stocker en base pour une icône du catalogue. */
export function serializeCategoryIcon(icon: CategoryIcon): string {
  return icon.kind === 'icon' ? `${ICON_PREFIX}${icon.id}` : icon.emoji;
}

/** Texte stocké → icône à afficher. Ne lève jamais d'erreur : une valeur illisible donne l'icône de remplacement. */
export function parseCategoryIcon(stored: string | null | undefined): CategoryIcon {
  const value = stored?.trim() ?? '';
  if (value === '') return { kind: 'icon', id: FALLBACK_CATEGORY_ICON };

  if (value.startsWith(ICON_PREFIX)) {
    const id = value.slice(ICON_PREFIX.length);
    return { kind: 'icon', id: isCategoryIconId(id) ? id : FALLBACK_CATEGORY_ICON };
  }

  return value.length <= MAX_EMOJI_LENGTH
    ? { kind: 'emoji', emoji: value }
    : { kind: 'icon', id: FALLBACK_CATEGORY_ICON };
}
