import { refreshLiveData, takeLiveError } from './live-store';

/** Attend que React ait appliqué le rendu provoqué par la relecture (deux images : validation puis affichage). Ce n'est pas un délai. */
export function nextRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Le travail d'une actualisation, dans l'ordre : `before` (propre à l'écran), relecture de toutes les requêtes, attente du rendu,
 * puis échec si une requête a échoué. Si `before` échoue, rien n'est relu. `settle` est l'attente du rendu (injectable pour les tests).
 */
export async function refreshAllData(before?: () => void | Promise<void>, settle: () => Promise<void> = nextRender): Promise<void> {
  await before?.();
  takeLiveError();
  refreshLiveData();
  await settle();
  const failure = takeLiveError();
  if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
}
