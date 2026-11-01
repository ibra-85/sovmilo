import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomReserve } from '@/theme/layout';

export { FloatingNavigation } from './floating-navigation';

/** Style de contenu des écrans défilants d'onglets : `contentContainerStyle={[…, useTabContentStyle()]}`. */
export function useTabContentStyle() {
  const insets = useSafeAreaInsets();
  return { paddingBottom: bottomReserve(insets.bottom) } as const;
}
