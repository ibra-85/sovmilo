import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { usePopoverEngine } from '@/hooks/use-popover-engine';
import { radius, sizes, space } from '@/theme/layout';
import { typography } from '@/theme/typography';
import { useTheme } from '@/theme/use-theme';

import { GlassOverlay, useGlassLook } from './glass-surface';
import {
  computePopoverPlacement,
  estimateMenuHeight,
  type PopoverAlign,
  type PopoverMode,
  type Rect,
} from './popover-layout';
import { MENU_PADDING, PopoverMenu, type PopoverItem } from './popover-menu';
import { lerp, lerpGeometry, ramp, stages } from './popover-motion';
import { createActionGate, resolveScrimTap } from './popover-session';
import { useAnchorMeasure, usePopoverTrigger, type PopoverAnchor } from './popover-trigger';
import { Pressable } from './pressable';

export { useAnchorMeasure, usePopoverTrigger };
export type { PopoverAlign, PopoverAnchor, PopoverItem, PopoverMode };

export interface PopoverTriggerLook {
  /** Fond OPAQUE du déclencheur : la surface part de cette couleur, puis passe à celle du verre du menu. */
  backgroundColor: string;
  borderColor: string;
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
  width?: number;
  /** Rayon du déclencheur : la surface part de cette forme et prend celle du menu en s'ouvrant. */
  anchorRadius?: number;
  /** `end` (défaut) : bord droit sur celui du bouton « ⋯ ». `center` : centré sur une tuile. */
  align?: PopoverAlign;
  /** `cover` (défaut) : le déclencheur se transforme en menu. `beside` : le menu se pose à côté et le laisse visible. */
  mode?: PopoverMode;
  /**
   * Contenu du déclencheur (icône, libellé), repris À L'IDENTIQUE dans la surface pour qu'il s'efface en douceur pendant que
   * le menu apparaît. Sans lui, la surface apparaît en fondu au-dessus du déclencheur (moins continu).
   */
  triggerContent?: ReactNode;
  /** Matière du déclencheur (par défaut : fond et contour des cartes). */
  triggerLook?: PopoverTriggerLook;
}

/** Marge autour du déclencheur où un toucher le rouvre pendant la fermeture (zone tactile confortable). */
const REOPEN_SLOP = 8;
/** Espace déclencheur ↔ menu, en mode `beside` uniquement. */
const BESIDE_GAP = 6;

/**
 * Popover « le bouton se transforme en menu » : menu « ⋯ », sélecteur de mois, menu d'une catégorie, futurs menus déroulants.
 * Un seul composant, découpé ainsi :
 *  - état ouvert/fermé et démontage : ici (`MorphingPopover`) et `popover-session.ts` (logique pure, testée) ;
 *  - géométrie : `popover-layout.ts` (pure, testée) ;
 *  - moteur d'animation : `hooks/use-popover-engine.ts` + `popover-motion.ts` (pur, testé) ;
 *  - présentation du menu : `popover-menu.tsx` ;
 *  - contenu métier : les `items` fournis par l'écran.
 *
 * Transformation : UNE surface, qui part du rectangle exact du déclencheur (position, taille, rayon, fond, contour) et
 * grandit vers sa place en gardant l'arête du déclencheur (haut ou bas, bord droit ou centre). Le contenu du déclencheur
 * s'efface, la matière passe du fond du bouton au verre du menu, puis les lignes apparaissent. À la fermeture tout se
 * déroule à l'envers, et la surface retrouve la forme du bouton posé dessous (qui reste en place et n'est jamais déplacé).
 *
 * Interruption : voir `usePopoverEngine` (position et vitesse conservées, inversion par ralentissement).
 * Fermeture : toucher à côté, toucher sur le déclencheur (bascule), Retour d'Android, choix d'une ligne.
 * Animations réduites : la surface apparaît directement à sa place, en fondu court, sans mouvement.
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
  trigger: Rect;
  open: boolean;
  knownHeight: number | null;
  onMeasured: (height: number) => void;
  onUnmount: () => void;
}

/** Tout ce qui n'existe que pendant que le popover est visible : fenêtre, moteur, écouteurs du clavier. */
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
  width = sizes.contextMenuWidth,
  anchorRadius = radius.pill,
  align = 'end',
  mode = 'cover',
  triggerContent,
  triggerLook,
}: PopoverLayerProps) {
  const { colors, shadows } = useTheme();
  const glass = useGlassLook('menu');
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  // Hauteur d'une ligne de texte du libellé, texte agrandi compris (l'icône se centre dessus).
  const lineHeight = Math.round((typography.body.lineHeight as number) * Math.min(window.fontScale, 1.8));

  const [gate] = useState(createActionGate);
  const engine = usePopoverEngine({
    // Le moteur est au repos, fermé, et c'est toujours le dernier ordre : l'action choisie peut s'exécuter, la fenêtre se démonte.
    onSettledClosed: () => {
      gate.flush();
      onUnmount();
    },
  });
  const { progress, interactive, reduced, setOpen } = engine;

  // L'intention vient de l'écran (`open`). Le moteur ne repart pas de zéro : il change seulement de cible.
  useEffect(() => {
    if (open) gate.reset();
    setOpen(open);
  }, [open, setOpen, gate]);

  // Fermeture demandée par le composant lui-même (fond, Retour, choix d'une ligne) : le moteur est prévenu tout de suite,
  // sans attendre le rendu de l'écran.
  function requestClose() {
    setOpen(false);
    onClose();
  }

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
        margin: space.screen / 2,
        gap: BESIDE_GAP,
        align,
        keyboardHeight,
        mode,
      }),
    [trigger, contentHeight, width, window, insets, align, keyboardHeight, mode],
  );

  const look = triggerLook ?? { backgroundColor: colors.surface, borderColor: colors.surfaceBorder };
  const hasReplica = triggerContent !== undefined;
  const menuRadius = radius.contextMenu;

  // Tous les styles animés lisent le MÊME avancement : une seule grandeur physique pilote la surface, la matière, le
  // contenu du déclencheur et les lignes, donc une inversion les ramène tous ensemble.
  const surfaceStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const g = reduced ? 1 : p;
    const geometry = lerpGeometry(
      { left: trigger.x, top: trigger.y, width: trigger.width, height: trigger.height },
      placement,
      g,
    );
    const material = reduced ? 1 : ramp(p, stages.material[0], stages.material[1]);
    return {
      left: geometry.left,
      top: geometry.top,
      width: geometry.width,
      height: geometry.height,
      borderRadius: lerp(anchorRadius, menuRadius, g),
      backgroundColor: interpolateColor(material, [0, 1], [look.backgroundColor, glass.recipe.fill]),
      borderColor: interpolateColor(material, [0, 1], [look.borderColor, glass.recipe.border]),
      opacity: reduced ? p : hasReplica ? 1 : ramp(p, stages.surfaceFade[0], stages.surfaceFade[1]),
    };
  });

  // Ombre du menu : portée par une couche transparente de même forme (une ombre extérieure ne se dessine qu'autour de la
  // surface) qui apparaît avec la matière, pour que l'ombre douce du menu ne surgisse pas autour d'un bouton encore plat.
  const shadowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const g = reduced ? 1 : p;
    const geometry = lerpGeometry(
      { left: trigger.x, top: trigger.y, width: trigger.width, height: trigger.height },
      placement,
      g,
    );
    return {
      left: geometry.left,
      top: geometry.top,
      width: geometry.width,
      height: geometry.height,
      borderRadius: lerp(anchorRadius, menuRadius, g),
      opacity: reduced ? p : ramp(p, stages.material[0], stages.material[1]),
    };
  });

  const glossStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : ramp(progress.value, stages.material[0], stages.material[1]),
  }));

  // Réplique du déclencheur : reste À SA PLACE à l'écran pendant que la surface grandit autour d'elle, puis s'efface.
  const replicaStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const g = reduced ? 1 : p;
    const geometry = lerpGeometry(
      { left: trigger.x, top: trigger.y, width: trigger.width, height: trigger.height },
      placement,
      g,
    );
    return {
      left: trigger.x - geometry.left - 1, // −1 : épaisseur du contour de la surface
      top: trigger.y - geometry.top - 1,
      opacity: reduced ? 0 : 1 - ramp(p, stages.triggerFade[0], stages.triggerFade[1]),
    };
  });

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
    // Un second toucher rapide (même ligne ou autre) est refusé : l'action ne part qu'une fois, après la fermeture.
    if (!gate.select(item.onPress)) return;
    requestClose();
  }

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
      {/* Fond : reçoit tous les touchers hors menu. Le toucher part dès l'appui (réaction immédiate). Invisible pour
          TalkBack : le menu se ferme avec le geste Retour, et c'est le menu qui reçoit le focus. */}
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        pressTranslate={0}
        onPressIn={handleScrimPress}
        style={{ flex: 1 }}
      />

      <Animated.View pointerEvents="none" style={[{ position: 'absolute', boxShadow: shadows.menu }, shadowStyle]} />

      {/* La surface laisse passer les touchers qu'elle ne peut pas traiter (box-none) : tant que les lignes ne sont pas
          interactives, un second toucher sur le déclencheur arrive au fond et referme le menu. */}
      <Animated.View
        pointerEvents="box-none"
        accessibilityRole="menu"
        accessibilityLabel={accessibilityLabel}
        accessibilityViewIsModal
        importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
        style={[{ position: 'absolute', overflow: 'hidden', borderWidth: 1 }, surfaceStyle]}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, glossStyle]} pointerEvents="none">
          <GlassOverlay variant="menu" radius={menuRadius - 1} />
        </Animated.View>

        {hasReplica && (
          <Animated.View
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={[
              {
                position: 'absolute',
                width: trigger.width,
                height: trigger.height,
                alignItems: 'center',
                justifyContent: 'center',
              },
              replicaStyle,
            ]}>
            {triggerContent}
          </Animated.View>
        )}

        {/* Contenu à sa taille finale : il ne se remet pas en page pendant que la surface grandit. */}
        <View
          pointerEvents={interactive ? 'auto' : 'none'}
          style={{ position: 'absolute', left: 0, top: 0, width: placement.width - 2, height: placement.height - 2, padding: MENU_PADDING }}>
          <PopoverMenu
            items={items}
            progress={progress}
            reduced={reduced}
            side={placement.side}
            lineHeight={lineHeight}
            onSelect={handleSelect}
            onMeasured={onMeasured}
          />
        </View>
      </Animated.View>
    </Modal>
  );
}
