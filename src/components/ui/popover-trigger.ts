import { useCallback, useRef, useState, type ComponentRef } from 'react';
import type { View, ViewStyle } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/theme/layout';

import { fallbackAnchor, isUsableRect, resolveAnchor, sameRect, type Rect } from './popover-layout';

/**
 * Emplacement d'un déclencheur dans la fenêtre. `cover` est posé par la mesure : le popover l'appelle avec `true` à
 * l'instant où sa surface prend la place du déclencheur, et avec `false` au moment exact où elle la lui rend.
 */
export interface PopoverAnchor extends Rect {
  cover?: (covered: boolean) => void;
}

/** Style du déclencheur pendant que la surface du popover le remplace : invisible (ni fond, ni contour, ni ombre, ni icône). */
const COVERED_STYLE: ViewStyle = { opacity: 0 };

/**
 * Mesure un élément dans la fenêtre à la demande (appui long sur une tuile, bouton « ⋯ » d'une ligne de liste) : pour
 * plusieurs déclencheurs qui partagent UN seul popover. `bind` se place en `ref` sur l'élément (vue avec `collapsable={false}`),
 * et `coverStyle` dans son `style` : c'est ce qui le masque pendant que le popover le remplace (une seule surface visible).
 *
 * Mesure native (`measureInWindow`), prise AU TOUCHER donc jamais périmée (l'écran ne défile plus une fois le menu ouvert).
 * Repli : si la mesure échoue (référence pas encore posée, vue détachée, rectangle vide), on prend la dernière bonne mesure
 * de ce déclencheur, sinon un emplacement en haut à droite — le toucher n'est jamais ignoré.
 */
export function useAnchorMeasure() {
  const [node, bind] = useState<ComponentRef<typeof View> | null>(null);
  const [covered, setCovered] = useState(false);
  const lastGood = useRef<Rect | null>(null);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const measure = useCallback(
    (onMeasured: (anchor: PopoverAnchor) => void) => {
      const fallback = fallbackAnchor(window, insets, space.screen / 2);
      if (!node) {
        onMeasured({ ...resolveAnchor(null, lastGood.current, fallback), cover: setCovered });
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        const fresh: Rect = { x, y, width, height };
        onMeasured({ ...resolveAnchor(fresh, lastGood.current, fallback), cover: setCovered });
        if (isUsableRect(fresh)) lastGood.current = fresh;
      });
    },
    [node, window, insets],
  );

  return { bind, measure, covered, coverStyle: covered ? COVERED_STYLE : undefined };
}

/**
 * Ouverture d'un popover : `bindTrigger` se place en `ref` sur le déclencheur (et `coverStyle` dans son style), `open()` le
 * mesure dans la fenêtre puis affiche le popover. `reopen` est passé à `onReopen` : un toucher sur le déclencheur pendant la
 * fermeture rouvre le menu. Un second `open()` sur le même emplacement ne crée pas de nouvel objet (aucun rendu inutile).
 */
export function usePopoverTrigger() {
  const { bind: bindTrigger, measure, coverStyle } = useAnchorMeasure();
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const open = useCallback(
    () => measure((measured) => setAnchor((previous) => (sameRect(previous, measured) ? previous : measured))),
    [measure],
  );
  const close = useCallback(() => setAnchor(null), []);
  const reopen = useCallback((again: PopoverAnchor) => setAnchor(again), []);
  return { bindTrigger, coverStyle, anchor, open, close, reopen, isOpen: anchor !== null };
}
