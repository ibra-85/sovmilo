/**
 * Détection des traductions manquantes. Fonctions pures : utilisées par les tests (la parité FR/RU est exigée) et par un
 * avertissement en développement. Le repli sur le français masque une clé russe absente à l'écran ; ces fonctions, elles, la signalent.
 */

/** Chemins (`a.b.c`) de toutes les feuilles d'un fichier de traduction. */
export function translationKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => translationKeys(value, prefix ? `${prefix}.${key}` : key));
}

/** `budget.count_few` → `budget.count` : les formes plurielles diffèrent selon la langue (2 en français, 4 en russe). */
export function withoutPluralSuffix(key: string): string {
  return key.replace(/_(zero|one|two|few|many|other)$/, '');
}

/** Clés (sans suffixe de pluriel), triées et uniques. */
export function baseTranslationKeys(translation: unknown): string[] {
  return [...new Set(translationKeys(translation).map(withoutPluralSuffix))].sort();
}

/** Clés présentes dans `reference` et absentes de `translation` : celles qui s'afficheraient en français dans l'autre langue. */
export function missingTranslations(reference: unknown, translation: unknown): string[] {
  const present = new Set(baseTranslationKeys(translation));
  return baseTranslationKeys(reference).filter((key) => !present.has(key));
}
