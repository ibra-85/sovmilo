import { createContext, Fragment, useCallback, useContext, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';

interface PopoverHostApi {
  /** Pose (ou remplace) le contenu d'une couche. Appelé après chaque rendu du popover. */
  show: (id: string, node: ReactNode) => void;
  /** Retire la couche. */
  hide: (id: string) => void;
}

const PopoverHostContext = createContext<PopoverHostApi | null>(null);

/** Hôte des popovers de l'application, ou `null` s'il n'y en a pas (le popover se pose alors à l'endroit où il est rendu). */
export const usePopoverHost = () => useContext(PopoverHostContext);

/**
 * Hôte des popovers : une couche plein écran posée AU-DESSUS de toute l'application, dans la MÊME hiérarchie native (pas de
 * `Modal`, donc pas de seconde fenêtre Android à créer à l'ouverture, ni de décalage de coordonnées entre le déclencheur et
 * la surface). À poser une fois, à la racine, autour de la navigation.
 *
 * - Coordonnées : celles de la fenêtre (`measureInWindow`). L'origine réelle de l'hôte est mesurée ; si elle n'est pas (0, 0)
 *   (barres système non translucides), la couche est décalée d'autant et les rectangles restent corrects.
 * - Accessibilité : tant qu'une couche est affichée, le reste de l'application est masqué à TalkBack (le menu est modal).
 * - Touchers : la couche entière absorbe les touchers (le fond du popover les reçoit), comme le faisait la fenêtre `Modal`.
 */
export function PopoverHostProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<Readonly<Record<string, ReactNode>>>({});
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const window = useWindowDimensions();
  const hostRef = useRef<ComponentRef<typeof View>>(null);

  const show = useCallback((id: string, node: ReactNode) => setLayers((previous) => ({ ...previous, [id]: node })), []);
  const hide = useCallback(
    (id: string) =>
      setLayers((previous) => {
        if (!(id in previous)) return previous;
        const next = { ...previous };
        delete next[id];
        return next;
      }),
    [],
  );
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  const measureOrigin = useCallback(() => {
    hostRef.current?.measureInWindow((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) setOrigin((previous) => (previous.x === x && previous.y === y ? previous : { x, y }));
    });
  }, []);

  const ids = Object.keys(layers);
  const active = ids.length > 0;

  return (
    <PopoverHostContext.Provider value={api}>
      <View ref={hostRef} collapsable={false} onLayout={measureOrigin} style={{ flex: 1 }}>
        <View
          style={{ flex: 1 }}
          importantForAccessibility={active ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={active}>
          {children}
        </View>
        {active && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: -origin.x, top: -origin.y, width: window.width, height: window.height }}>
            {ids.map((id) => (
              <Fragment key={id}>{layers[id]}</Fragment>
            ))}
          </View>
        )}
      </View>
    </PopoverHostContext.Provider>
  );
}
