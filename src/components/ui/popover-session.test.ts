import { createActionGate, resolvePopoverBack, resolveRowPress, resolveScrimTap, shouldUnmount } from './popover-session';

const anchor = { x: 300, y: 40, width: 44, height: 44 };
const onAnchor = { x: 320, y: 60 };
const elsewhere = { x: 20, y: 400 };

describe('resolveScrimTap', () => {
  it('ferme le menu ouvert, où que tombe le toucher (y compris sur le déclencheur : bascule)', () => {
    expect(resolveScrimTap({ intentOpen: true, actionPending: false, point: elsewhere, anchor, slop: 6 })).toBe('close');
    expect(resolveScrimTap({ intentOpen: true, actionPending: false, point: onAnchor, anchor, slop: 6 })).toBe('close');
  });

  it('rouvre le menu en cours de fermeture quand on retouche le déclencheur', () => {
    expect(resolveScrimTap({ intentOpen: false, actionPending: false, point: onAnchor, anchor, slop: 6 })).toBe('reopen');
  });

  it('tolère une marge autour du déclencheur (zone tactile confortable), pas au-delà', () => {
    const near = { x: anchor.x - 5, y: anchor.y + 10 };
    expect(resolveScrimTap({ intentOpen: false, actionPending: false, point: near, anchor, slop: 6 })).toBe('reopen');
    const far = { x: anchor.x - 30, y: anchor.y + 10 };
    expect(resolveScrimTap({ intentOpen: false, actionPending: false, point: far, anchor, slop: 6 })).toBe('ignore');
  });

  it('ignore un toucher ailleurs pendant la fermeture', () => {
    expect(resolveScrimTap({ intentOpen: false, actionPending: false, point: elsewhere, anchor, slop: 6 })).toBe('ignore');
  });

  it('ne rouvre pas un menu dont une action vient d’être choisie', () => {
    expect(resolveScrimTap({ intentOpen: false, actionPending: true, point: onAnchor, anchor, slop: 6 })).toBe('ignore');
  });

  it('ignore sans ancre', () => {
    expect(resolveScrimTap({ intentOpen: false, actionPending: false, point: onAnchor, anchor: null, slop: 6 })).toBe('ignore');
  });
});

describe('shouldUnmount (fermeture et démontage)', () => {
  it('démonte quand le dernier ordre était « fermer » et que le moteur le confirme', () => {
    expect(shouldUnmount({ settledEpoch: 4, currentEpoch: 4, intentOpen: false })).toBe(true);
  });

  it('ne démonte pas si une réouverture a eu lieu depuis (message en retard)', () => {
    expect(shouldUnmount({ settledEpoch: 4, currentEpoch: 5, intentOpen: true })).toBe(false);
    expect(shouldUnmount({ settledEpoch: 4, currentEpoch: 6, intentOpen: false })).toBe(false); // rouvert puis refermé
  });

  it('ne démonte jamais un menu dont l’intention est « ouvert »', () => {
    expect(shouldUnmount({ settledEpoch: 3, currentEpoch: 3, intentOpen: true })).toBe(false);
  });
});

describe('createActionGate (aucune action exécutée deux fois)', () => {
  it('exécute l’action une seule fois, à la fin de la fermeture', () => {
    const gate = createActionGate();
    const action = jest.fn();
    expect(gate.select(action)).toBe(true);
    expect(action).not.toHaveBeenCalled();
    expect(gate.pending()).toBe(true);
    expect(gate.flush()).toBe(true);
    expect(gate.flush()).toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    expect(gate.pending()).toBe(false);
  });

  it('refuse un second toucher rapide, sur la même ligne ou sur une autre', () => {
    const gate = createActionGate();
    const first = jest.fn();
    const second = jest.fn();
    expect(gate.select(first)).toBe(true);
    expect(gate.select(first)).toBe(false);
    expect(gate.select(second)).toBe(false);
    gate.flush();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('refuse encore après l’exécution tant que le menu n’a pas été rouvert, puis accepte de nouveau', () => {
    const gate = createActionGate();
    const action = jest.fn();
    gate.select(action);
    gate.flush();
    expect(gate.select(action)).toBe(false);
    gate.reset();
    expect(gate.select(action)).toBe(true);
    gate.flush();
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('flush sans action en attente ne fait rien', () => {
    expect(createActionGate().flush()).toBe(false);
  });
});

describe('resolveRowPress (toucher sur une ligne)', () => {
  it('choisit la ligne une fois le menu armé', () => {
    expect(resolveRowPress({ intentOpen: true, armed: true })).toBe('select');
  });

  it('un toucher trop tôt (double toucher sur le déclencheur) ferme le menu sans rien choisir', () => {
    expect(resolveRowPress({ intentOpen: true, armed: false })).toBe('close');
  });

  it('ignore tout toucher pendant la fermeture', () => {
    expect(resolveRowPress({ intentOpen: false, armed: true })).toBe('ignore');
    expect(resolveRowPress({ intentOpen: false, armed: false })).toBe('ignore');
  });
});

describe('resolvePopoverBack (Retour d’Android)', () => {
  it('ferme le menu ouvert', () => {
    expect(resolvePopoverBack({ intentOpen: true })).toBe('close');
  });

  it('pendant la fermeture, le Retour est absorbé : il ne traverse pas vers l’écran', () => {
    expect(resolvePopoverBack({ intentOpen: false })).toBe('absorb');
  });
});

describe('scénario : ouvrir, retoucher, rouvrir (aucune action perdue ni doublée)', () => {
  it('une action choisie ne s’exécute qu’une fois, après la fermeture, même avec des touchers rapides', () => {
    const gate = createActionGate();
    const run = jest.fn();
    expect(gate.select(run)).toBe(true);
    expect(gate.select(run)).toBe(false); // second toucher rapide
    expect(run).not.toHaveBeenCalled(); // rien avant la fin de la fermeture
    expect(gate.flush()).toBe(true);
    expect(gate.flush()).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('une réouverture annule l’action en attente d’un menu qui se fermait', () => {
    const gate = createActionGate();
    const run = jest.fn();
    gate.select(run);
    gate.reset();
    expect(gate.flush()).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
