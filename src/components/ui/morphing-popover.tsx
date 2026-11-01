import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, View, useWindowDimensions, type GestureResponderEvent, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePopoverEngine } from '@/hooks/use-popover-engine';
import { radius, sizes, space } from '@/theme/layout';
import { maxFontScale, typography } from '@/theme/typography';
import { useTheme } from '@/theme/use-theme';

import { GlassOverlay, useGlassLook } from './glass-surface';
import {
  computePopoverPlacement,
  estimateMenuHeight,
  estimateMenuWidth,
  menuMaxHeight,
  type PopoverAlign,
  type PopoverMode,
  type PopoverPlacement,
  type Rect,
} from './popover-layout';
import { usePopoverHost } from './popover-host';
import { MENU_PADDING, PopoverMenu, type PopoverItem } from './popover-menu';
import { SELECT_ARM_MS, lerp, lerpGeometry, ramp, scaleBetween, stages } from './popover-motion';
import { createActionGate, resolvePopoverBack, resolveRowPress, resolveScrimTap } from './popover-session';
import { useAnchorMeasure, usePopoverTrigger, type PopoverAnchor } from './popover-trigger';
import { Pressable } from './pressable';

export { useAnchorMeasure, usePopoverTrigger };
export type { PopoverAlign, PopoverAnchor, PopoverItem, PopoverMode };

export interface PopoverTriggerLook {
  /** Fond OPAQUE du déclencheur : la surface part de cette couleur, puis passe à celle du verre du menu. */
  backgroundColor: string;
  borderColor: string;
  /** Ombre du déclencheur au repos (par défaut : ombre de tuile). Reproduite sous la surface, puis effacée. */
  shadow?: ViewStyle['boxShadow'];
}

export interface MorphingPopoverProps {
  /** Rectangle du déclencheur dans la fenêtre ; `null` = fermé. */
  anchor: PopoverAnchor | null;
  onClose: () => void;
  /**
   * Un toucher sur le déclencheur PENDANT la fermeture rouvre le menu aussitôt. Reçoit l'emplacement du déclencheur ;
   * à brancher sur `reopen` de `usePopoverTrigger` (ou sur le setter de l'ancre). Sans lui, ce toucher est ignoré.
   */
  onReopen?: (anchor: PopoverAnchor) => void;
  items: readonly PopoverItem[];
  /** Nom du menu pour TalkBack (« Actions sur l'opération »). */
  accessibilityLabel: string;
  /** Largeur imposée. Par défaut : adaptée au plus long libellé (jamais moins que `sizes.contextMenuWidth`, jamais plus que l'écran). */
  width?: number;
  /** Rayon du déclencheur : la surface part de cette forme et prend celle du menu en s'ouvrant. */
  anchorRadius?: number;
  /** `end` (défaut) : bord droit sur celui du bouton « ⋯ ». `center` : centré sur une tuile. */
  align?: PopoverAlign;
  /** `cover` (défaut) : le déclencheur se transforme en menu. `beside` : le menu se pose à côté et le laisse visible. */
  mode?: PopoverMode;
  /**
   * Contenu du déclencheur (icône, libellé), repris À L'IDENTIQUE au-dessus de la surface pour qu'il s'efface en douceur
   * pendant que le menu apparaît. Le déclencheur réel, lui, est masqué (`cover` de l'ancre) pendant tout le mouvement.
   */
  triggerContent?: ReactNode;
  /** Matière du déclencheur (par défaut : fond, contour et ombre des cartes). */
  triggerLook?: PopoverTriggerLook;
}

/** Marge autour du déclencheur où un toucher le rouvre pendant la fermeture (zone tactile confortable). */
const REOPEN_SLOP = 8;
/** Espace déclencheur ↔ menu, en mode `beside` uniquement. */
const BESIDE_GAP = 6;

/** Largeur d'un menu pour ces lignes (voir `estimateMenuWidth`) ; `maxWidth` : largeur de l'écran moins les marges. */
function menuWidthFor(items: readonly PopoverItem[], maxWidth: number, fontScale: number): number {
  return estimateMenuWidth({
    labels: items.map((item) => item.label),
    hasIcon: items.some((item) => item.icon !== undefined),
    hasCheck: items.some((item) => item.selected),
    minWidth: sizes.contextMenuWidth,
    maxWidth,
    fontScale: Math.min(fontScale, maxFontScale.bodyStrong),
    fontSize: typography.bodyStrong.fontSize as number,
  });
}

/**
 * Popover « le bouton se transforme en menu » : menu « ⋯ », sélecteur de mois, menu d'une catégorie, futurs menus déroulants.
 * Un seul composant, découpé ainsi :
 *  - état ouvert/fermé et démontage : ici (`MorphingPopover`) et `popover-session.ts` (logique pure, testée) ;
 *  - géométrie : `popover-layout.ts` (pure, testée) ;
 *  - moteur d'animation : `hooks/use-popover-engine.ts` + `popover-motion.ts` (pur, testé) ;
 *  - couche d'affichage : `popover-host.tsx` (au-dessus de l'application, même hiérarchie native, sans `Modal`) ;
 *  - présentation du menu : `popover-menu.tsx` ;
 *  - contenu métier : les `items` fournis par l'écran.
 *
 * UNE seule surface visible pendant toute l'interaction. À l'ouverture, dans le MÊME rendu : la surface prend la place du
 * déclencheur et celui-ci est masqué (`anchor.cover(true)`) ; elle part de son rectangle exact (position, taille, rayon,
 * fond, contour, ombre, contenu) et grandit vers sa place en gardant l'arête du déclencheur. À la fermeture tout se déroule
 * à l'envers ; quand la surface est revenue sur le bouton et au repos, le bouton réapparaît et la surface disparaît dans le
 * MÊME rendu (`anchor.cover(false)`) : aucun délai à régler, le transfert se fait sur deux images identiques.
 *
 * Interruption : voir `usePopoverEngine` (position et vitesse conservées, inversion par ralentissement).
 * Fermeture : toucher à côté, toucher sur le déclencheur (bascule), Retour d'Android, choix d'une ligne.
 * Animations réduites : le menu se pose à côté du déclencheur (qui reste visible, aucun masquage) et apparaît en fondu.
 */
export function MorphingPopover(props: MorphingPopoverProps) {
  const { anchor } = props;
  // On garde le dernier emplacement pendant la fermeture (l'ancre est déjà remise à zéro) ; `mounted` passe à vrai pendant
  // le rendu (motif recommandé par React) et à faux seulement quand le moteur est au repos, fermé.
  const [lastAnchor, setLastAnchor] = useState<PopoverAnchor | null>(anchor);
  if (anchor && anchor !== lastAnchor) setLastAnchor(anchor);
  const [mounted, setMounted] = useState(anchor !== null);
  if (anchor && !mounted) setMounted(true);

  // La hauteur mesurée du contenu survit à la fermeture : à la réouverture, la surface connaît déjà sa taille finale
  // (aucun ajustement de la cible pendant les premières images). Elle n'est réutilisée que pour les mêmes libellés, la même
  // largeur d'écran et la même taille de texte.
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const contentKey = `${props.items.map((item) => item.label).join('|')}#${props.width ?? ''}#${Math.round(windowWidth)}#${fontScale}`;
  const [measurement, setMeasurement] = useState<{ key: string; height: number } | null>(null);
  const knownHeight = measurement?.key === contentKey ? measurement.height : null;

  if (!mounted || !lastAnchor) return null;
  return (
    <PopoverLayer
      {...props}
      trigger={lastAnchor}
      open={anchor !== null}
      knownHeight={knownHeight}
      onMeasured={(height) =>
        setMeasurement((previous) => (previous?.key === contentKey && previous.height === height ? previous : { key: contentKey, height }))
      }
      onUnmount={() => setMounted(false)}
    />
  );
}

interface PopoverLayerProps extends MorphingPopoverProps {
  trigger: PopoverAnchor;
  open: boolean;
  knownHeight: number | null;
  onMeasured: (height: number) => void;
  onUnmount: () => void;
}

/**
 * Tout ce qui n'existe que pendant que le popover est visible : moteur, écouteurs (Retour, clavier), masquage du
 * déclencheur. Ne dessine rien lui-même : il confie la surface à l'hôte (`PopoverHostProvider`).
 */
function PopoverLayer({
  trigger,
  open,
  onClose,
  onReopen,
  onUnmount,
  knownHeight,
  onMeasured,
  items,
  accessibilityLabel,
  width: fixedWidth,
  anchorRadius = radius.pill,
  align = 'end',
  mode = 'cover',
  triggerContent,
  triggerLook,
}: PopoverLayerProps) {
  const host = usePopoverHost();
  const id = useId();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const [gate] = useState(createActionGate);
  const engine = usePopoverEngine({
    // Le moteur est au repos, fermé, et c'est toujours le dernier ordre : le déclencheur réapparaît, la surface disparaît
    // (même rendu), puis l'action choisie peut s'exécuter.
    onSettledClosed: () => {
      trigger.cover?.(false);
      onUnmount();
      gate.flush();
    },
  });
  const { progress, reduced, setOpen } = engine;
  // Animations réduites : pas de transformation du bouton ; le menu se pose à côté et apparaît en fondu.
  const placementMode: PopoverMode = reduced ? 'beside' : mode;

  // L'intention vient de l'écran (`open`). Le moteur ne repart pas de zéro : il change seulement de cible.
  useEffect(() => {
    if (open) gate.reset();
    setOpen(open);
  }, [open, setOpen, gate]);

  // Les lignes n'acceptent un choix qu'un instant après l'ordre d'ouverture (voir `resolveRowPress`).
  const armedRef = useRef(false);
  useEffect(() => {
    armedRef.current = false;
    if (!open) return;
    const timer = setTimeout(() => {
      armedRef.current = true;
    }, SELECT_ARM_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // Fermeture demandée par le composant lui-même (fond, Retour, choix d'une ligne) : le moteur est prévenu tout de suite,
  // sans attendre le rendu de l'écran.
  function requestClose() {
    setOpen(false);
    onClose();
  }

  // Retour d'Android : fermer le menu, et ne jamais laisser le Retour traverser (écran, navigation) tant que la surface existe.
  const backRef = useRef<() => void>(() => {});
  useEffect(() => {
    backRef.current = () => {
      if (resolvePopoverBack({ intentOpen: engine.isOpenRequested() }) === 'close') requestClose();
    };
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  // Largeur ou taille du texte changées (rotation, écran partagé, pliage) : la mesure du déclencheur est périmée → fermeture.
  // La hauteur seule (clavier, barre système) ne ferme pas : le placement est simplement recalculé.
  const layoutKey = `${Math.round(window.width)}:${window.fontScale}`;
  const firstLayoutKey = useRef(layoutKey);
  useEffect(() => {
    if (firstLayoutKey.current === layoutKey) return;
    firstLayoutKey.current = layoutKey;
    setOpen(false);
    onClose();
  }, [layoutKey, setOpen, onClose]);

  // Largeur : celle qui laisse le plus long libellé sur UNE ligne (estimation généreuse, bornée par l'écran). La même fonction
  // de ces seules entrées (libellés, taille du texte, largeur d'écran) donne la clé de mesure de `MorphingPopover`.
  const margin = space.screen / 2;
  const width =
    fixedWidth ??
    menuWidthFor(items, window.width - 2 * (margin + Math.max(insets.left, insets.right)), window.fontScale);

  // Hauteur réelle du contenu, MESURÉE (libellés longs sur deux lignes, russe, texte agrandi). Avant la première mesure,
  // une estimation à une ligne par entrée ; la mesure arrive dès le premier rendu, alors que la surface est minuscule.
  const contentHeight =
    knownHeight !== null ? knownHeight + MENU_PADDING * 2 : estimateMenuHeight(items.length, sizes.contextMenuRow, MENU_PADDING);
  const placement = useMemo(
    () =>
      computePopoverPlacement({
        trigger,
        contentHeight,
        width,
        window,
        insets,
        margin,
        gap: BESIDE_GAP,
        align,
        keyboardHeight,
        mode: placementMode,
        // Une longue liste (mois) ne prend jamais plus de la moitié de la zone utilisable : elle défile dans la surface.
        maxHeight: menuMaxHeight(window.height, insets),
      }),
    [trigger, contentHeight, width, window, insets, margin, align, keyboardHeight, placementMode],
  );

  function handleScrimPress(event: GestureResponderEvent) {
    const decision = resolveScrimTap({
      intentOpen: engine.isOpenRequested(),
      actionPending: gate.pending(),
      point: { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY },
      anchor: trigger,
      slop: REOPEN_SLOP,
    });
    if (decision === 'close') {
      requestClose();
    } else if (decision === 'reopen' && onReopen) {
      gate.reset();
      setOpen(true);
      onReopen(trigger);
    }
  }

  function handleSelect(item: PopoverItem) {
    const decision = resolveRowPress({ intentOpen: engine.isOpenRequested(), armed: armedRef.current });
    if (decision === 'ignore') return;
    if (decision === 'close') {
      requestClose();
      return;
    }
    // Un second toucher rapide (même ligne ou autre) est refusé : l'action ne part qu'une fois, après la fermeture.
    if (!gate.select(item.onPress)) return;
    requestClose();
  }

  const overlay = (
    <PopoverOverlay
      progress={progress}
      reduced={reduced}
      open={open}
      trigger={trigger}
      placement={placement}
      anchorRadius={anchorRadius}
      triggerContent={reduced ? undefined : triggerContent}
      triggerLook={triggerLook}
      items={items}
      accessibilityLabel={accessibilityLabel}
      onScrimPress={handleScrimPress}
      onSelect={handleSelect}
      onMeasured={onMeasured}
    />
  );

  // Même passe de rendu : l'hôte reçoit la surface ET le déclencheur est masqué, donc ils apparaissent/disparaissent dans la
  // même image native. En mouvement réduit le déclencheur reste visible (le menu est à côté).
  const cover = reduced ? undefined : trigger.cover;
  useLayoutEffect(() => {
    host?.show(id, overlay);
  });
  useLayoutEffect(() => {
    cover?.(true);
    return () => cover?.(false);
  }, [cover]);
  useLayoutEffect(() => () => host?.hide(id), [host, id]);

  if (host) return null;
  // Sans hôte (test, écran isolé) : la couche est rendue ici, plein écran.
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {overlay}
    </View>
  );
}

interface PopoverOverlayProps {
  progress: SharedValue<number>;
  reduced: boolean;
  open: boolean;
  trigger: Rect;
  placement: PopoverPlacement;
  anchorRadius: number;
  triggerContent?: ReactNode;
  triggerLook?: PopoverTriggerLook;
  items: readonly PopoverItem[];
  accessibilityLabel: string;
  onScrimPress: (event: GestureResponderEvent) => void;
  onSelect: (item: PopoverItem) => void;
  onMeasured: (height: number) => void;
}

/** Seules les ombres PORTÉES sont reproduites sous la surface : un liseré intérieur serait caché par elle (le reflet fait cela). */
function outerShadows(shadow: ViewStyle['boxShadow']): ViewStyle['boxShadow'] {
  return Array.isArray(shadow) ? shadow.filter((layer) => !layer.inset) : shadow;
}

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * La surface elle-même, dans l'hôte. Coût du mouvement, image par image : UNE vue dont la mise en page change (la surface :
 * position et taille), tout le reste n'est que opacité ou transformation (ombres, reflet, lignes, contenu du déclencheur).
 * Les ombres et le reflet ne sont donc jamais redessinés à une autre taille pendant le mouvement.
 */
function PopoverOverlay({
  progress,
  reduced,
  open,
  trigger,
  placement,
  anchorRadius,
  triggerContent,
  triggerLook,
  items,
  accessibilityLabel,
  onScrimPress,
  onSelect,
  onMeasured,
}: PopoverOverlayProps) {
  const { colors, shadows } = useTheme();
  const glass = useGlassLook('menu');
  const menuRadius = radius.contextMenu;

  const look = {
    backgroundColor: triggerLook?.backgroundColor ?? colors.surface,
    borderColor: triggerLook?.borderColor ?? colors.surfaceBorder,
    shadow: triggerLook?.shadow ?? shadows.tile,
  };

  // Départ (le déclencheur) et arrivée (le menu) : calculés une fois par rendu, lus par les styles animés.
  const from = useMemo(
    () => ({ left: trigger.x, top: trigger.y, width: trigger.width, height: trigger.height }),
    [trigger.x, trigger.y, trigger.width, trigger.height],
  );
  const to = useMemo(
    () => ({ left: placement.left, top: placement.top, width: placement.width, height: placement.height }),
    [placement.left, placement.top, placement.width, placement.height],
  );

  // La surface : seule vue dont la mise en page est animée.
  const surfaceStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (reduced) {
      return {
        left: to.left,
        top: to.top,
        width: to.width,
        height: to.height,
        borderRadius: menuRadius,
        backgroundColor: glass.recipe.fill,
        borderColor: glass.recipe.border,
        opacity: p,
      };
    }
    const geometry = lerpGeometry(from, to, p);
    const material = ramp(p, stages.material[0], stages.material[1]);
    return {
      left: geometry.left,
      top: geometry.top,
      width: geometry.width,
      height: geometry.height,
      borderRadius: lerp(anchorRadius, menuRadius, p),
      backgroundColor: interpolateColor(material, [0, 1], [look.backgroundColor, glass.recipe.fill]),
      borderColor: interpolateColor(material, [0, 1], [look.borderColor, glass.recipe.border]),
      opacity: 1,
    };
  });

  // Ombre du déclencheur : posée sous la surface, à la place de celle du vrai bouton (masqué), puis effacée.
  const triggerShadowStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : 1 - ramp(progress.value, stages.triggerFade[0], stages.triggerFade[1] + 0.1),
  }));

  // Ombre du menu : couche à la taille FINALE, ramenée sur la surface par une simple transformation (jamais redessinée).
  const menuShadowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (reduced) return { opacity: p, transform: [{ translateX: 0 }, { translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }] };
    const t = scaleBetween(from, to, p);
    return {
      opacity: ramp(p, stages.material[0], stages.material[1]),
      transform: [{ translateX: t.translateX }, { translateY: t.translateY }, { scaleX: t.scaleX }, { scaleY: t.scaleY }],
    };
  });

  const glossStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : ramp(progress.value, stages.material[0], stages.material[1]),
  }));

  const replicaStyle = useAnimatedStyle(() => ({
    opacity: 1 - ramp(progress.value, stages.triggerFade[0], stages.triggerFade[1]),
  }));

  return (
    <>
      {/* Fond : reçoit tous les touchers hors menu. Le toucher part dès l'appui (réaction immédiate). Invisible pour
          TalkBack : le menu se ferme avec le geste Retour, et c'est le menu qui reçoit le focus. */}
      <Pressable accessible={false} importantForAccessibility="no" pressTranslate={0} onPressIn={onScrimPress} style={FILL} />

      {!reduced && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: from.left,
              top: from.top,
              width: from.width,
              height: from.height,
              borderRadius: anchorRadius,
              boxShadow: outerShadows(look.shadow),
            },
            triggerShadowStyle,
          ]}
        />
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: to.left,
            top: to.top,
            width: to.width,
            height: to.height,
            borderRadius: menuRadius,
            boxShadow: outerShadows(shadows.menu),
          },
          menuShadowStyle,
        ]}
      />

      {/* La surface laisse passer les touchers qu'elle ne traite pas (box-none) : un second toucher sur le déclencheur arrive
          au fond et referme le menu. */}
      <Animated.View
        pointerEvents="box-none"
        accessibilityRole="menu"
        accessibilityLabel={accessibilityLabel}
        accessibilityViewIsModal
        importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
        style={[{ position: 'absolute', overflow: 'hidden', borderWidth: 1 }, surfaceStyle]}>
        {/* Reflet et contenu à leur taille finale : ils ne se remettent pas en page pendant que la surface grandit. */}
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: 0, top: 0, width: to.width - 2, height: to.height - 2 }, glossStyle]}>
          <GlassOverlay variant="menu" radius={menuRadius - 1} />
        </Animated.View>

        <View style={{ position: 'absolute', left: 0, top: 0, width: to.width - 2, height: to.height - 2, padding: MENU_PADDING }}>
          <PopoverMenu
            items={items}
            progress={progress}
            reduced={reduced}
            side={placement.side}
            onSelect={onSelect}
            onMeasured={onMeasured}
          />
        </View>
      </Animated.View>

      {/* Contenu du déclencheur, immobile à sa place d'origine, au-dessus de la surface ; il s'efface pendant l'ouverture. */}
      {triggerContent !== undefined && (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              position: 'absolute',
              left: from.left,
              top: from.top,
              width: from.width,
              height: from.height,
              alignItems: 'center',
              justifyContent: 'center',
            },
            replicaStyle,
          ]}>
          {triggerContent}
        </Animated.View>
      )}
    </>
  );
}
