import { usePathname, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { IconName } from '@/components/ui';
import { sizes, space } from '@/theme/layout';
import { useTheme } from '@/theme/use-theme';

import { ActionMenu, type ActionMenuItem } from './action-menu';
import { ExpandableActionButton } from './expandable-action-button';
import { FloatingTabBar } from './floating-tab-bar';

interface TabDefinition {
  href: Href;
  /** Chemin tel que `usePathname()` le renvoie quand l'onglet est affiché. */
  path: string;
  icon: IconName;
  labelKey: 'tabs.home' | 'tabs.history' | 'tabs.budget' | 'tabs.more';
}

const TABS: readonly TabDefinition[] = [
  { href: '/', path: '/', icon: 'home', labelKey: 'tabs.home' },
  { href: '/history', path: '/history', icon: 'transactions', labelKey: 'tabs.history' },
  { href: '/budget', path: '/budget', icon: 'budgets', labelKey: 'tabs.budget' },
  { href: '/more', path: '/more', icon: 'services', labelKey: 'tabs.more' },
];

/**
 * Navigation flottante : fondu sous la barre, barre d'onglets, bouton +, menu d'actions rapides avec son voile.
 * Elle est dessinée par-dessus tous les écrans d'onglets (voir `src/app/(tabs)/_layout.tsx`) pour que le voile
 * recouvre le contenu sans que la barre ne bouge, et reste absente des écrans secondaires (ajout, détail, réglages).
 *
 * Position : 20 dp des bords, 32 dp au-dessus du bas, ou 12 dp au-dessus de la zone des gestes système si elle est
 * plus haute (voir docs/design-deviations.md).
 */
export function FloatingNavigation() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();

  // Le menu est lié à l'écran où il a été ouvert : s'il s'ouvre puis qu'on change d'écran autrement que par ses
  // actions (lien profond, retour système), il se referme de lui-même, sans effet ni état à resynchroniser.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const menuOpen = openedAt === pathname;
  const closeMenu = useCallback(() => setOpenedAt(null), []);

  const activeIndex = Math.max(
    0,
    TABS.findIndex((tab) => tab.path === pathname),
  );
  const bottom = Math.max(sizes.navBottom, insets.bottom + 12);
  const menuBottom = bottom + sizes.fabSize + (sizes.actionMenuBottom - sizes.navBottom - sizes.fabSize);

  const items: ActionMenuItem[] = [
    {
      key: 'expense',
      icon: 'expense',
      label: t('nav.addExpense'),
      highlighted: true,
      onPress: () => router.push({ pathname: '/add', params: { type: 'expense' } }),
    },
    {
      key: 'income',
      icon: 'income',
      label: t('nav.addIncome'),
      onPress: () => router.push({ pathname: '/add', params: { type: 'income' } }),
    },
    // Le scan de tickets n'existe pas encore (V1.3) : la ligne du design est montrée, mais grisée et sans action.
    { key: 'scan', icon: 'scanReceipt', label: t('nav.scanReceipt'), unavailableHint: t('nav.soon') },
  ];

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <BottomFade height={sizes.navFade + insets.bottom} color={colors.bg} />

      <ActionMenu
        open={menuOpen}
        onClose={closeMenu}
        items={items}
        bottom={menuBottom}
        right={space.screen}
        scrimLabel={t('nav.closeQuickActions')}
        menuLabel={t('nav.quickActions')}
      />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: space.screen,
          right: space.screen,
          bottom,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: sizes.navFabGap,
        }}>
        <FloatingTabBar
          items={TABS.map((tab) => ({ key: tab.path, icon: tab.icon, label: t(tab.labelKey) }))}
          activeIndex={activeIndex}
          fontScale={fontScale}
          accessibilityLabel={t('nav.main')}
          onSelect={(index) => {
            closeMenu();
            if (index !== activeIndex) router.navigate(TABS[index].href);
          }}
        />
        <ExpandableActionButton
          open={menuOpen}
          label={menuOpen ? t('nav.closeQuickActions') : t('nav.quickActions')}
          onPress={() => setOpenedAt(menuOpen ? null : pathname)}
        />
      </View>
    </View>
  );
}

/** Fondu du fond d'écran sous la barre : le contenu qui défile disparaît en douceur au lieu d'être coupé net. */
function BottomFade({ height, color }: { height: number; color: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="navFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.6" stopColor={color} stopOpacity={0.85} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#navFade)" />
      </Svg>
    </View>
  );
}
