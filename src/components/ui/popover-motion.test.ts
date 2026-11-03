import {
  INITIAL_MOTION,
  REST_DISTANCE,
  SELECT_ARM_MS,
  lerpGeometry,
  omegaForSettle,
  ramp,
  rowRange,
  scaleBetween,
  stages,
  stepMotion,
  type MotionState,
} from './popover-motion';

const FRAME = 1 / 60;
const OMEGA_IN = omegaForSettle(220);
const OMEGA_OUT = omegaForSettle(160);

interface Frame extends MotionState {
  settled: boolean;
  target: number;
}

/** Fait tourner le moteur image par image ; `target` et `omega` peuvent dépendre du numéro d'image (second toucher). */
function simulate(opts: {
  from?: MotionState;
  steps: number;
  target: number | ((frame: number) => number);
  omega?: (target: number) => number;
  dt?: number;
}): Frame[] {
  let state: MotionState = opts.from ?? INITIAL_MOTION;
  const trace: Frame[] = [];
  for (let frame = 0; frame < opts.steps; frame++) {
    const target = typeof opts.target === 'function' ? opts.target(frame) : opts.target;
    const omega = (opts.omega ?? ((t: number) => (t === 1 ? OMEGA_IN : OMEGA_OUT)))(target);
    const next = stepMotion(state, target, omega, opts.dt ?? FRAME);
    state = next;
    trace.push({ ...next, target });
  }
  return trace;
}

const REVERSE_AT = 8; // ≈ 133 ms après le premier toucher, en pleine ouverture

describe('stepMotion : ressort à amortissement critique', () => {
  it('rejoint la cible sans la dépasser ni revenir en arrière (aucun rebond)', () => {
    const trace = simulate({ steps: 120, target: 1 });
    expect(Math.max(...trace.map((s) => s.position))).toBeLessThanOrEqual(1);
    expect(trace[trace.length - 1]).toMatchObject({ position: 1, velocity: 0, settled: true });
    for (let i = 1; i < trace.length; i++) expect(trace[i].position).toBeGreaterThanOrEqual(trace[i - 1].position);
  });

  it('se cale dans l’ordre de grandeur de la durée demandée', () => {
    const open = simulate({ steps: 120, target: 1 });
    const openMs = open.findIndex((s) => s.settled) * FRAME * 1000;
    expect(openMs).toBeGreaterThan(180);
    expect(openMs).toBeLessThan(400);
    const close = simulate({ steps: 120, target: 0, from: { position: 1, velocity: 0, lead: 1, leadVelocity: 0 } });
    expect(close.findIndex((s) => s.settled)).toBeLessThan(open.findIndex((s) => s.settled)); // fermer est plus rapide
  });

  it('répond tout de suite : la surface a déjà bougé à la première image et atteint 50 % en moins de 120 ms', () => {
    const trace = simulate({ steps: 12, target: 1 });
    expect(trace[0].position).toBeGreaterThan(0.001);
    expect(trace[0].velocity).toBeGreaterThan(0);
    const halfAt = trace.findIndex((s) => s.position >= 0.5) * FRAME * 1000;
    expect(halfAt).toBeLessThan(120);
  });

  it('donne le même résultat quelle que soit la durée des images (images sautées comprises)', () => {
    const fine = simulate({ steps: 60, target: 1, dt: 1 / 240 });
    const coarse = simulate({ steps: 15, target: 1, dt: 1 / 60 });
    const long = simulate({ steps: 5, target: 1, dt: 3 / 60 });
    const at = fine[59]; // 250 ms
    expect(coarse[14].position).toBeCloseTo(at.position, 2);
    expect(long[4].position).toBeCloseTo(at.position, 2);
  });

  it('ignore un pas de durée nulle ou négative', () => {
    const state = { position: 0.4, velocity: 1.5, lead: 0.6, leadVelocity: 2 };
    expect(stepMotion(state, 1, OMEGA_IN, 0)).toEqual({ ...state, settled: false });
    expect(stepMotion(state, 1, OMEGA_IN, -0.01)).toEqual({ ...state, settled: false });
  });

  it('reste borné à [0, 1] et annule la vitesse contre la borne', () => {
    const high = stepMotion({ position: 0.99, velocity: 40, lead: 1, leadVelocity: 0 }, 1, OMEGA_IN, 0.1);
    expect(high.position).toBeLessThanOrEqual(1);
    const low = stepMotion({ position: 0.01, velocity: -40, lead: 0, leadVelocity: 0 }, 0, OMEGA_IN, 0.1);
    expect(low.position).toBeGreaterThanOrEqual(0);
  });

  it('au repos exact sur la cible, il reste immobile', () => {
    const rest = stepMotion({ position: 1, velocity: 0, lead: 1, leadVelocity: 0 }, 1, OMEGA_IN, FRAME);
    expect(rest).toEqual({ position: 1, velocity: 0, lead: 1, leadVelocity: 0, settled: true });
    expect(REST_DISTANCE).toBeLessThan(0.01);
  });
});

describe('changement de cible pendant l’animation (conservation de la dynamique)', () => {
  const reversing = () => simulate({ steps: 90, target: (frame) => (frame < REVERSE_AT ? 1 : 0) });

  it('ne saute jamais de position quand la cible s’inverse', () => {
    const trace = reversing();
    // le déplacement d'une image est borné par la vitesse maximale atteinte (position = ∫ vitesse) : jamais de téléportation
    const peakSpeed = Math.max(...trace.map((s) => Math.abs(s.velocity)));
    for (let i = 1; i < trace.length; i++) {
      expect(Math.abs(trace[i].position - trace[i - 1].position)).toBeLessThanOrEqual(peakSpeed * FRAME * 1.1);
    }
  });

  it('à l’inversion, position et vitesse sont celles du moment (aucune remise à zéro), et la surface fait demi-tour en quelques images', () => {
    const trace = reversing();
    const before = trace[REVERSE_AT - 1];
    const after = trace[REVERSE_AT];
    expect(before.velocity).toBeGreaterThan(1); // en pleine ouverture
    // la position de la première image après l'inversion prolonge le mouvement d'une image (pas de retour en arrière brutal) ;
    expect(Math.abs(after.position - before.position)).toBeLessThan(0.1);
    // la vitesse change de sens en peu d'images : un ressort raide fait demi-tour presque tout de suite. C'est voulu (réaction
    // immédiate au second toucher) et c'est dit tel quel : l'inertie qui subsiste est de l'ordre d'une à deux images.
    const turn = trace.slice(REVERSE_AT).findIndex((s) => s.velocity <= 0);
    expect(turn).toBeGreaterThanOrEqual(0);
    expect(turn).toBeLessThanOrEqual(3);
    // jamais au-delà de l'ouverture complète, et la surface finit refermée au repos
    expect(Math.max(...trace.map((s) => s.position))).toBeLessThan(1);
    expect(trace[trace.length - 1]).toMatchObject({ position: 0, settled: true });
  });

  it('le changement de vitesse d’une image à l’autre reste borné à l’inversion (pas de téléportation, pas d’à-coup infini)', () => {
    const jump = (trace: Frame[]) => Math.max(...trace.slice(1).map((s, i) => Math.abs(s.velocity - trace[i].velocity)));
    const natural = Math.max(jump(simulate({ steps: 40, target: 1 })), jump(simulate({ steps: 40, target: 0, from: { position: 1, velocity: 0, lead: 1, leadVelocity: 0 } })));
    // Mesuré : un demi-tour demande 2 à 3 fois l'à-coup d'un départ ordinaire à 60 Hz (4 fois sans le premier étage) ; plafond : 3,5.
    expect(jump(reversing())).toBeLessThanOrEqual(natural * 3.5);
  });

  it('ne passe pas sous la forme du déclencheur en revenant (pas de rebond de l’autre côté)', () => {
    expect(Math.min(...reversing().map((s) => s.position))).toBeGreaterThanOrEqual(0);
  });

  it('plusieurs inversions rapides ne bloquent pas : le système finit au repos sur la dernière cible', () => {
    const trace = simulate({
      steps: 300,
      target: (frame) => (frame < 40 ? (Math.floor(frame / 5) % 2 === 0 ? 1 : 0) : 1),
    });
    expect(trace[trace.length - 1]).toMatchObject({ position: 1, velocity: 0, settled: true });
    for (const step of trace) {
      expect(step.position).toBeGreaterThanOrEqual(0);
      expect(step.position).toBeLessThanOrEqual(1);
    }
  });

  it('réouverture immédiate au milieu de la fermeture : repart de la position et de la vitesse courantes', () => {
    const closing = simulate({
      steps: 6,
      target: 0,
      from: { position: 1, velocity: 0, lead: 1, leadVelocity: 0 },
    });
    const mid = closing[closing.length - 1];
    expect(mid.position).toBeLessThan(1);
    expect(mid.position).toBeGreaterThan(0);
    expect(mid.velocity).toBeLessThan(0);
    const reopened = stepMotion(mid, 1, OMEGA_IN, FRAME);
    expect(Math.abs(reopened.position - mid.position)).toBeLessThan(0.1);
    // la surface repart de là où elle est, sans repasser par une extrémité, et finit ouverte au repos
    const further = simulate({ steps: 40, target: 1, from: mid });
    expect(Math.min(...further.map((s) => s.position))).toBeGreaterThan(mid.position - 0.1);
    expect(further[further.length - 1]).toMatchObject({ position: 1, settled: true });
  });
});

describe('étapes du morphing', () => {
  it('ramp borne l’avancement', () => {
    expect(ramp(-1, 0, 1)).toBe(0);
    expect(ramp(0.5, 0, 1)).toBe(0.5);
    expect(ramp(3, 0, 1)).toBe(1);
    expect(ramp(0.3, 0.5, 0.5)).toBe(0);
  });

  it('les lignes arrivent avec un très léger décalage et sont toutes visibles avant la fin du mouvement', () => {
    const [firstStart] = rowRange(0);
    const [secondStart] = rowRange(1);
    expect(secondStart - firstStart).toBeCloseTo(stages.rowStagger);
    expect(rowRange(40)[1]).toBeLessThan(1); // même avec beaucoup de lignes, le décalage est plafonné
    expect(firstStart).toBeGreaterThanOrEqual(stages.triggerFade[1]); // le contenu attend que la surface soit ouverte
  });

  it('interpole la géométrie de la forme du déclencheur à celle du menu', () => {
    const from = { left: 300, top: 40, width: 44, height: 44 };
    const to = { left: 112, top: 40, width: 232, height: 112 };
    expect(lerpGeometry(from, to, 0)).toEqual(from);
    expect(lerpGeometry(from, to, 1)).toEqual(to);
    expect(lerpGeometry(from, to, 0.5)).toEqual({ left: 206, top: 40, width: 138, height: 78 });
  });
});

describe('réactivité du départ (le premier étage est calé sur la cible quand tout est au repos)', () => {
  it('démarre vite : 10 % en moins de 35 ms, 50 % en moins de 80 ms (la cascade de la V2 : 50 ms et 104 ms)', () => {
    const trace = simulate({ steps: 30, target: 1, dt: 1 / 240 });
    const at = (fraction: number) => trace.findIndex((s) => s.position >= fraction) * (1000 / 240);
    expect(at(0.1)).toBeLessThan(35);
    expect(at(0.5)).toBeLessThan(80);
  });

  it('se cale dans la durée annoncée (220 ms à l’ouverture, 160 ms à la fermeture) à 15 % / 35 % près', () => {
    const open = simulate({ steps: 300, target: 1, dt: 1 / 240 });
    const openMs = open.findIndex((s) => s.settled) * (1000 / 240);
    expect(openMs).toBeGreaterThan(220 * 0.85);
    expect(openMs).toBeLessThan(220 * 1.35); // le seuil de repos (0,4 %) allonge un peu la queue invisible
    const close = simulate({ steps: 300, target: 0, from: { position: 1, velocity: 0, lead: 1, leadVelocity: 0 }, dt: 1 / 240 });
    const closeMs = close.findIndex((s) => s.settled) * (1000 / 240);
    expect(closeMs).toBeLessThan(160 * 1.4);
  });
});

describe('scaleBetween (couches décoratives suivant la surface par transformation)', () => {
  const from = { left: 300, top: 40, width: 44, height: 44 };
  const to = { left: 112, top: 40, width: 232, height: 112 };

  it('au départ la couche, à sa taille finale, recouvre exactement le déclencheur', () => {
    const t = scaleBetween(from, to, 0);
    expect(t.scaleX * to.width).toBeCloseTo(from.width);
    expect(t.scaleY * to.height).toBeCloseTo(from.height);
    expect(to.left + to.width / 2 + t.translateX).toBeCloseTo(from.left + from.width / 2);
    expect(to.top + to.height / 2 + t.translateY).toBeCloseTo(from.top + from.height / 2);
  });

  it('à l’arrivée, c’est l’identité', () => {
    expect(scaleBetween(from, to, 1)).toEqual({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 });
  });

  it('à tout moment elle coïncide avec la géométrie interpolée de la surface', () => {
    for (const p of [0.2, 0.5, 0.8]) {
      const g = lerpGeometry(from, to, p);
      const t = scaleBetween(from, to, p);
      expect(t.scaleX * to.width).toBeCloseTo(g.width);
      expect(to.left + to.width / 2 + t.translateX - (t.scaleX * to.width) / 2).toBeCloseTo(g.left);
    }
  });

  it('ne divise pas par zéro pour une cible sans taille', () => {
    expect(scaleBetween(from, { left: 0, top: 0, width: 0, height: 0 }, 0.5)).toMatchObject({ scaleX: 1, scaleY: 1 });
  });
});

describe('garde anti double-toucher', () => {
  it('les lignes attendent plus longtemps qu’un double toucher courant (≈ 100–250 ms) mais moins qu’une lecture du menu', () => {
    expect(SELECT_ARM_MS).toBeGreaterThanOrEqual(220);
    expect(SELECT_ARM_MS).toBeLessThanOrEqual(350);
  });
});
