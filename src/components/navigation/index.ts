import { sizes } from '@/theme/layout';

export { FloatingNavigation } from './floating-navigation';

/**
 * Marge basse des écrans d'onglets : le contenu défile jusqu'au-dessus de la navigation flottante (132 dp).
 * Provisoire pour les anciens écrans ; les écrans refaits au lot 3 l'utiliseront aussi.
 */
export const tabContentStyle = { paddingBottom: sizes.bottomReserve } as const;
