/**
 * Moteur de mouvement du popover : fonctions pures (testées) exécutées sur le thread UI par `usePopoverEngine`.
 *
 * Pourquoi un ressort écrit ici plutôt que `withSpring` : le code de Reanimated 4.7.1 (`animation/spring/spring.ts`, `onStart`)
 * remet la vitesse à zéro quand la nouvelle cible va dans le sens CONTRAIRE du mouvement en cours (« Inertia is only preserved
 * when it already points toward toValue »). Un second toucher qui inverse l'ouverture ferait donc un arrêt net avant de repartir.
 * Ici la position ET la vitesse sont l'état du système : changer la cible ne change que la force de rappel. La position et la
 * vitesse ne sautent jamais ; mais un ressort assez raide pour s'ouvrir en 220 ms fait demi-tour en une à deux images : la
 * « conservation de la vitesse » est exacte dans le modèle, elle est à peine perceptible à l'écran.
 *
 * Deux étages, mais un seul compte au départ. `position` est un ressort à amortissement critique qui poursuit `lead` ; `lead`
 * poursuit la cible. Quand tout est au repos, `lead` est calé sur la nouvelle cible dès la première image : le départ est celui
 * d'UN seul ressort (10 % en ~25 ms, 50 % en ~60 ms, contre 50 et 104 ms pour la cascade de la V2, qui partait toujours de zéro).
 * `lead` ne sert donc qu'à l'INVERSION en plein mouvement : il y adoucit le changement de force, ce qui donne un demi-tour
 * en deux ou trois images avec un peu de course encore parcourue (jusqu'à ~15 % à mi-chemin) au lieu d'un virage sec.
 * Il faut rester lucide : à l'écran c'est un adoucissement de quelques dizaines de millisecondes, pas une vraie inertie.
 *
 * Toutes les fonctions marquées `worklet` n'utilisent que des nombres : elles tournent telles quelles sur le thread UI et en Jest.
 */

export interface MotionState {
  /** Avancement : 0 = forme du déclencheur, 1 = menu ouvert. C'est ce que lisent les styles animés. */
  position: number;
  /** Vitesse de `position`, en unités d'avancement par seconde (signée). */
  velocity: number;
  /** Cible adoucie que `position` poursuit (voir plus haut) ; égale à la cible tant qu'aucune inversion n'a lieu. */
  lead: number;
  leadVelocity: number;
}

export interface MotionStep extends MotionState {
  /** Vrai quand tout est au repos sur la cible : l'état a alors été calé dessus et le moteur peut s'arrêter. */
  settled: boolean;
}

export const INITIAL_MOTION: MotionState = { position: 0, velocity: 0, lead: 0, leadVelocity: 0 };

/** Seuils de repos : sous 0,4 % d'écart (moins d'un demi-dp sur un menu de 130 dp) et 0,05 avancement/s, rien n'est perceptible. */
export const REST_DISTANCE = 0.004;
export const REST_VELOCITY = 0.05;

/** Temps de calage à 1 % d'un ressort critique, en multiples de 1/ω : (1 + x)·e^(−x) = 0,01 → x ≈ 6,64. */
const SETTLE_FACTOR = 6.64;
/** Raideur du premier étage relative à la surface : plus lent qu'elle, il arrondit le demi-tour (mesuré : 0,8 donne le plus doux). */
export const LEAD_RATIO = 0.8;
/** Pas interne maximal (s) : le résultat ne dépend pas de la durée de l'image. */
const MAX_SUBSTEP = 1 / 240;
const MAX_SUBSTEPS = 24;

/** Pulsation ω (rad/s) du ressort pour un calage à 1 % en `settleMs` millisecondes. */
export function omegaForSettle(settleMs: number): number {
  return SETTLE_FACTOR / (Math.max(1, settleMs) / 1000);
}

/** Un étage : ressort à amortissement critique, solution exacte x(t) = target + (x₀ + (v₀ + ωx₀)t)·e^(−ωt). Sans rebond possible. */
function criticalStep(position: number, velocity: number, target: number, omega: number, dt: number) {
  'worklet';
  const x0 = position - target;
  const c = velocity + omega * x0;
  const decay = Math.exp(-omega * dt);
  return { position: target + (x0 + c * dt) * decay, velocity: (velocity - omega * c * dt) * decay };
}

/**
 * Fait avancer le mouvement de `dt` secondes vers `target` (0 = fermé, 1 = ouvert).
 *
 * Aucune remise à zéro de la position ni de la vitesse : un changement de cible (second toucher) ne déplace que ce que
 * `lead` poursuit. Aucun rebond (pôles réels). Un mouvement arrivé vite contre une borne peut la dépasser une fois : la
 * position est alors bornée à [0, 1] et la vitesse annulée.
 */
export function stepMotion(state: MotionState, target: number, omega: number, dt: number): MotionStep {
  'worklet';
  if (!(dt > 0)) return { ...state, settled: false };

  let { position, velocity, lead, leadVelocity } = state;
  // Tout est au repos (départ depuis l'arrêt) : le premier étage est calé sur la cible, le départ est celui d'un seul ressort.
  if (
    Math.abs(velocity) <= REST_VELOCITY &&
    Math.abs(leadVelocity) <= REST_VELOCITY &&
    Math.abs(lead - position) <= REST_DISTANCE
  ) {
    lead = target;
    leadVelocity = 0;
  }

  const count = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / MAX_SUBSTEP)));
  const h = Math.min(dt, MAX_SUBSTEP * MAX_SUBSTEPS) / count;
  for (let i = 0; i < count; i++) {
    const first = criticalStep(lead, leadVelocity, target, omega * LEAD_RATIO, h);
    lead = first.position;
    leadVelocity = first.velocity;
    if (lead > 1) {
      lead = 1;
      if (leadVelocity > 0) leadVelocity = 0;
    } else if (lead < 0) {
      lead = 0;
      if (leadVelocity < 0) leadVelocity = 0;
    }

    const second = criticalStep(position, velocity, lead, omega, h);
    position = second.position;
    velocity = second.velocity;
    if (position > 1) {
      position = 1;
      if (velocity > 0) velocity = 0;
    } else if (position < 0) {
      position = 0;
      if (velocity < 0) velocity = 0;
    }
  }

  if (
    Math.abs(position - target) <= REST_DISTANCE &&
    Math.abs(velocity) <= REST_VELOCITY &&
    Math.abs(lead - target) <= REST_DISTANCE &&
    Math.abs(leadVelocity) <= REST_VELOCITY
  ) {
    return { position: target, velocity: 0, lead: target, leadVelocity: 0, settled: true };
  }
  return { position, velocity, lead, leadVelocity, settled: false };
}

/** Avancement de `value` entre `start` et `end`, borné à [0, 1]. */
export function ramp(value: number, start: number, end: number): number {
  'worklet';
  if (end <= start) return value >= end ? 1 : 0;
  const t = (value - start) / (end - start);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(from: number, to: number, t: number): number {
  'worklet';
  return from + (to - from) * t;
}

/**
 * Étapes du morphing, exprimées dans l'avancement du ressort (0 → 1). Une seule grandeur physique pilote tout : à la
 * fermeture ou à l'inversion, ces étapes se déroulent à l'envers au même rythme que la surface, sans minuterie.
 */
export const stages = {
  /** Contenu et ombre du déclencheur : s'effacent pendant que la surface commence à s'ouvrir. */
  triggerFade: [0, 0.22],
  /** Matière : fond, contour et ombre passent de ceux du déclencheur à ceux du menu. */
  material: [0, 0.5],
  /** Première ligne du menu : début et fin du fondu ; chaque ligne suivante démarre un peu plus tard. */
  rowStart: 0.3,
  rowDuration: 0.4,
  rowStagger: 0.025,
  rowStaggerMax: 5,
} as const;

/** Délai (ms) après l'ordre d'ouverture avant que les lignes acceptent un choix : un double toucher ne choisit jamais la 1ʳᵉ action. */
export const SELECT_ARM_MS = 260;

export function rowRange(index: number): readonly [number, number] {
  'worklet';
  const shift = Math.min(index, stages.rowStaggerMax) * stages.rowStagger;
  return [stages.rowStart + shift, stages.rowStart + shift + stages.rowDuration];
}

export interface Geometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function lerpGeometry(from: Geometry, to: Geometry, t: number): Geometry {
  'worklet';
  return {
    left: lerp(from.left, to.left, t),
    top: lerp(from.top, to.top, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
  };
}

export interface ScaleTransform {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Transformation qui fait coïncider une vue posée à sa taille FINALE (`to`) avec la géométrie intermédiaire entre `from` et
 * `to` : translation du centre puis échelle autour du centre. Sert aux couches décoratives (ombre) pour qu'elles suivent la
 * surface sans changer de taille en mise en page : seule une transformation est animée, jamais la mise en page.
 */
export function scaleBetween(from: Geometry, to: Geometry, t: number): ScaleTransform {
  'worklet';
  const g = lerpGeometry(from, to, t);
  return {
    translateX: g.left + g.width / 2 - (to.left + to.width / 2),
    translateY: g.top + g.height / 2 - (to.top + to.height / 2),
    scaleX: to.width > 0 ? g.width / to.width : 1,
    scaleY: to.height > 0 ? g.height / to.height : 1,
  };
}
