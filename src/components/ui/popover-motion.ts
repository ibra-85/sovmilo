/**
 * Moteur de mouvement du popover : fonctions pures (testées) exécutées sur le thread UI par `usePopoverEngine`.
 *
 * Pourquoi un ressort écrit ici plutôt que `withSpring` : le code de Reanimated 4.7.1 (`animation/spring/spring.ts`, `onStart`)
 * remet la vitesse à zéro quand la nouvelle cible va dans le sens CONTRAIRE du mouvement en cours (« Inertia is only preserved
 * when it already points toward toValue »). Un second toucher qui inverse l'ouverture ferait donc un arrêt net avant de repartir.
 * Ici la position ET la vitesse sont l'état du système : changer la cible ne change que la force de rappel, si bien que le
 * mouvement ralentit sous l'effet du ressort, s'arrête, puis repart dans l'autre sens, sans aucune discontinuité de position
 * ni de vitesse. Un second étage (voir `stepMotion`) rend aussi l'accélération continue : l'inversion se voit comme un
 * ralentissement, pas comme un virage sec.
 *
 * Toutes les fonctions marquées `worklet` n'utilisent que des nombres : elles tournent telles quelles sur le thread UI et en Jest.
 */

export interface MotionState {
  /** Avancement : 0 = forme du déclencheur, 1 = menu ouvert. C'est ce que lisent les styles animés. */
  position: number;
  /** Vitesse de `position`, en unités d'avancement par seconde (signée). */
  velocity: number;
  /** Premier étage : valeur qui suit la cible et que `position` poursuit (voir `stepMotion`). */
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

/** Temps de calage à 1 % d'un ressort critique en cascade de deux étages, en multiples de 1/ω. */
const SETTLE_FACTOR = 6.5;
/** Le premier étage est plus raide que le second : il arrondit les changements de force sans retarder l'ensemble. */
export const LEAD_RATIO = 1.5;
/** Pas interne maximal (s) : l'état est avancé par sous-pas pour que le résultat ne dépende pas de la durée de l'image. */
const MAX_SUBSTEP = 1 / 240;
const MAX_SUBSTEPS = 24;

/** Pulsation ω (rad/s) du ressort pour un calage à 1 % en `settleMs` millisecondes. */
export function omegaForSettle(settleMs: number): number {
  return SETTLE_FACTOR / (Math.max(1, settleMs) / 1000);
}

/** Un étage : ressort à amortissement critique, solution exacte x(t) = (x₀ + (v₀ + ωx₀)t)·e^(−ωt). Sans rebond possible. */
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
 * Deux ressorts à amortissement critique en cascade : `lead` suit la cible, `position` suit `lead`. Chaque étage a une
 * position ET une vitesse comme état, que rien ne remet à zéro. Un changement de cible (second toucher) ne fait que
 * déplacer ce que `lead` poursuit : la surface garde sa position et sa vitesse, ralentit sous la force de rappel
 * qui change progressivement (l'accélération est continue grâce au premier étage), s'arrête, puis repart en sens inverse.
 * Aucun rebond (tous les pôles sont réels), position bornée à [0, 1] (la vitesse est annulée contre une borne).
 */
export function stepMotion(state: MotionState, target: number, omega: number, dt: number): MotionStep {
  'worklet';
  if (!(dt > 0)) return { ...state, settled: false };

  const count = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / MAX_SUBSTEP)));
  const h = Math.min(dt, MAX_SUBSTEP * MAX_SUBSTEPS) / count;
  let { position, velocity, lead, leadVelocity } = state;

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
  /** Contenu du déclencheur (icône, libellé) : s'efface pendant que la surface commence à s'ouvrir. */
  triggerFade: [0, 0.28],
  /** Matière : fond, contour et ombre passent de ceux du déclencheur à ceux du menu. */
  material: [0, 0.5],
  /** Surface qui apparaît quand il n'y a pas de réplique du déclencheur à fondre. */
  surfaceFade: [0, 0.2],
  /** Première ligne du menu : début et fin du fondu ; chaque ligne suivante démarre un peu plus tard. */
  rowStart: 0.4,
  rowDuration: 0.4,
  rowStagger: 0.025,
  rowStaggerMax: 5,
  /** Au-delà, les lignes reçoivent les touchers (avant : un double toucher rapide ne choisit jamais une ligne par erreur). */
  interactiveAt: 0.55,
} as const;

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
