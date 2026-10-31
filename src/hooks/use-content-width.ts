import { useWindowDimensions } from 'react-native';

import { space } from '@/theme/layout';

/** Largeur utile d'un écran (fenêtre moins les marges de 20 dp) : la place dont dispose un montant posé pleine largeur. */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return Math.max(0, width - space.screen * 2);
}
