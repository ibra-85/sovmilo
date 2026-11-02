import {
  canReorder,
  isSameOrder,
  DEFAULT_GOAL_ICON,
  GOAL_EMOJIS,
  MAX_GOAL_NAME_LENGTH,
  MAX_SAVINGS_AMOUNT_CENTS,
  cleanGoalName,
  cleanNote,
  compareMovements,
  dragTargetIndex,
  findTimelineProblem,
  goalProgress,
  isConsistentTimeline,
  isValidSavingsAmount,
  maxWithdrawalCents,
  moveItem,
  newestFirst,
  reorderBackAction,
  runningBalances,
  savedCents,
  shiftSlots,
  slotsToOrder,
  summarizeGoals,
  validateGoalName,
  validateMovementFields,
  validateTargetDate,
  type MovementLike,
} from './savings';

let counter = 0;
const move = (kind: 'deposit' | 'withdrawal', amountCents: number, occurredOn: string, overrides: Partial<MovementLike> = {}): MovementLike => {
  counter += 1;
  return { id: `m${String(counter).padStart(3, '0')}`, kind, amountCents, occurredOn, createdAt: `2026-11-01T10:00:${String(counter % 60).padStart(2, '0')}.000Z`, ...overrides };
};
const dep = (cents: number, on: string) => move('deposit', cents, on);
const wd = (cents: number, on: string) => move('withdrawal', cents, on);

describe('montant épargné', () => {
  it('est la somme des versements moins celle des retraits', () => {
    expect(savedCents([])).toBe(0);
    expect(savedCents([dep(10_000, '2026-11-01'), dep(5_050, '2026-11-02'), wd(3_000, '2026-11-03')])).toBe(12_050);
  });

  it('reste exact sur de grands montants et des centimes (entiers, aucun arrondi flottant)', () => {
    expect(savedCents([dep(99_999_999_999, '2026-11-01'), wd(1, '2026-11-02')])).toBe(99_999_999_998);
    expect(savedCents([dep(10, '2026-11-01'), dep(20, '2026-11-01')])).toBe(30); // pas de 0,1 + 0,2
    expect(savedCents([dep(1, '2026-11-01'), dep(1, '2026-11-01'), dep(1, '2026-11-01')])).toBe(3);
  });
});

describe('chronologie', () => {
  it('trie par date, puis par ordre de saisie, puis par identifiant', () => {
    const a = move('deposit', 100, '2026-11-02', { id: 'a', createdAt: '2026-11-02T09:00:00.000Z' });
    const b = move('deposit', 100, '2026-11-01', { id: 'b', createdAt: '2026-11-03T09:00:00.000Z' });
    const c = move('deposit', 100, '2026-11-02', { id: 'c', createdAt: '2026-11-02T08:00:00.000Z' });
    const d = move('deposit', 100, '2026-11-02', { id: 'd', createdAt: '2026-11-02T08:00:00.000Z' });
    expect([a, b, c, d].sort(compareMovements).map((m) => m.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(newestFirst([a, b, c, d]).map((m) => m.id)).toEqual(['a', 'd', 'c', 'b']);
  });

  it('calcule le montant épargné après chaque mouvement', () => {
    const list = [wd(2_000, '2026-11-05'), dep(5_000, '2026-11-01'), dep(1_000, '2026-11-03')];
    expect(runningBalances(list).map((entry) => entry.balanceCents)).toEqual([5_000, 6_000, 4_000]);
  });

  it('un historique est cohérent tant que le montant épargné ne devient jamais négatif', () => {
    expect(isConsistentTimeline([dep(5_000, '2026-11-01'), wd(5_000, '2026-11-02')])).toBe(true); // retrait total : zéro, pas négatif
    expect(isConsistentTimeline([])).toBe(true);
  });

  it('refuse un retrait qui précède le versement qui le couvre, même si le total final est positif', () => {
    const early = wd(5_000, '2026-11-03');
    const list = [dep(8_000, '2026-11-05'), early];
    expect(savedCents(list)).toBe(3_000);
    expect(findTimelineProblem(list)).toEqual({ movementId: early.id, balanceCents: -5_000 });
  });

  it('même jour : l\'ordre de saisie décide (versement saisi avant le retrait)', () => {
    const first = move('deposit', 3_000, '2026-11-01', { id: 'x1', createdAt: '2026-11-01T08:00:00.000Z' });
    const second = move('withdrawal', 3_000, '2026-11-01', { id: 'x2', createdAt: '2026-11-01T09:00:00.000Z' });
    expect(isConsistentTimeline([first, second])).toBe(true);
    const inverted = [{ ...first, createdAt: '2026-11-01T10:00:00.000Z' }, second];
    expect(isConsistentTimeline(inverted)).toBe(false);
  });

  it('plus grand retrait possible à une date : le solde de ce moment, sans mettre en défaut un retrait plus tardif', () => {
    const history = [dep(10_000, '2026-11-01'), wd(4_000, '2026-11-10'), dep(2_000, '2026-11-15')];
    expect(maxWithdrawalCents(history, '2026-11-05')).toBe(6_000); // 10 000 − 4 000 déjà prévus plus tard
    expect(maxWithdrawalCents(history, '2026-11-20')).toBe(8_000);
    expect(maxWithdrawalCents(history, '2026-10-20')).toBe(0); // avant tout versement
    expect(maxWithdrawalCents([], '2026-11-01')).toBe(0);
  });
});

describe('progression', () => {
  it('objectif vide, en cours, atteint, dépassé', () => {
    expect(goalProgress(0, 200_000)).toMatchObject({ state: 'empty', percent: 0, barPercent: 0, remainingCents: 200_000, exceededCents: 0 });
    expect(goalProgress(50_000, 200_000)).toMatchObject({ state: 'inProgress', percent: 25, remainingCents: 150_000 });
    expect(goalProgress(200_000, 200_000)).toMatchObject({ state: 'reached', percent: 100, barPercent: 100, remainingCents: 0, exceededCents: 0 });
    expect(goalProgress(230_000, 200_000)).toMatchObject({ state: 'exceeded', percent: 115, barPercent: 100, remainingCents: 0, exceededCents: 30_000 });
  });

  it('la barre est plafonnée à 100 % mais le montant réel reste exact', () => {
    const progress = goalProgress(1_234_567, 100_000);
    expect(progress.barPercent).toBe(100);
    expect(progress.percent).toBe(1234);
    expect(progress.savedCents).toBe(1_234_567);
  });

  it('arrondit le pourcentage vers le bas : jamais 100 % avant la cible', () => {
    expect(goalProgress(199_999, 200_000).percent).toBe(99);
    expect(goalProgress(1, 3).percent).toBe(33);
    expect(goalProgress(2, 3).percent).toBe(66);
    expect(goalProgress(1, 1_000_000).percent).toBe(0);
  });

  it('un retrait qui repasse sous la cible recalcule l\'état', () => {
    const list = [dep(100_000, '2026-11-01')];
    expect(goalProgress(savedCents(list), 100_000).state).toBe('reached');
    list.push(wd(1, '2026-11-02'));
    expect(goalProgress(savedCents(list), 100_000)).toMatchObject({ state: 'inProgress', percent: 99, remainingCents: 1 });
  });

  it('valeurs extrêmes : cible maximale, montant négatif ignoré, cible nulle sans division par zéro', () => {
    expect(goalProgress(MAX_SAVINGS_AMOUNT_CENTS, MAX_SAVINGS_AMOUNT_CENTS)).toMatchObject({ state: 'reached', percent: 100 });
    expect(goalProgress(-5, 1000)).toMatchObject({ savedCents: 0, state: 'empty' });
    expect(goalProgress(10, 0).percent).toBe(0);
  });

  it('résume les objectifs actifs : total déclaré, nombre, objectifs atteints', () => {
    expect(summarizeGoals([])).toEqual({ totalSavedCents: 0, goalCount: 0, reachedCount: 0 });
    expect(
      summarizeGoals([
        { savedCents: 50_000, targetCents: 200_000 },
        { savedCents: 30_000, targetCents: 30_000 },
        { savedCents: 0, targetCents: 500_000 },
        { savedCents: 60_000, targetCents: 50_000 },
      ]),
    ).toEqual({ totalSavedCents: 140_000, goalCount: 4, reachedCount: 2 });
  });
});

describe('session de réorganisation', () => {
  it('ne propose de réorganiser qu\'à partir de deux objectifs', () => {
    expect(canReorder(0)).toBe(false);
    expect(canReorder(1)).toBe(false);
    expect(canReorder(2)).toBe(true);
  });

  it('compare deux ordres (même contenu, même séquence)', () => {
    expect(isSameOrder(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
    expect(isSameOrder(['a', 'b', 'c'], ['a', 'c', 'b'])).toBe(false);
    expect(isSameOrder(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(isSameOrder([], [])).toBe(true);
  });

  it('Retour : sans changement on quitte le mode, avec un changement non validé on demande', () => {
    expect(reorderBackAction(['a', 'b'], ['a', 'b'])).toBe('leave');
    expect(reorderBackAction(['a', 'b'], ['b', 'a'])).toBe('ask');
    // Un aller-retour qui retombe sur l'ordre de départ n'est pas un changement.
    expect(reorderBackAction(['a', 'b', 'c'], slotsToOrder(['a', 'b', 'c'], shiftSlots(shiftSlots([0, 1, 2], 0, 2), 0, 0)))).toBe('leave');
  });
});

describe('validation', () => {
  it('nom : espaces nettoyés, vide et trop long refusés', () => {
    expect(cleanGoalName('  Vacances   d\'été ')).toBe('Vacances d\'été');
    expect(validateGoalName('   ')).toBe('empty');
    expect(validateGoalName('a'.repeat(MAX_GOAL_NAME_LENGTH + 1))).toBe('too-long');
    expect(validateGoalName('a'.repeat(MAX_GOAL_NAME_LENGTH))).toBeNull();
    expect(validateGoalName('Отпуск на море')).toBeNull();
  });

  it('montants : entier de centimes strictement positif et borné', () => {
    expect(isValidSavingsAmount(1)).toBe(true);
    expect(isValidSavingsAmount(MAX_SAVINGS_AMOUNT_CENTS)).toBe(true);
    expect(isValidSavingsAmount(0)).toBe(false);
    expect(isValidSavingsAmount(-100)).toBe(false);
    expect(isValidSavingsAmount(10.5)).toBe(false);
    expect(isValidSavingsAmount(MAX_SAVINGS_AMOUNT_CENTS + 1)).toBe(false);
    expect(isValidSavingsAmount(null)).toBe(false);
    expect(isValidSavingsAmount(Number.NaN)).toBe(false);
  });

  it('date cible : facultative, valide, pas dans le passé quand on la choisit', () => {
    expect(validateTargetDate(null, '2026-11-01')).toBeNull();
    expect(validateTargetDate('2026-11-01', '2026-11-01')).toBeNull();
    expect(validateTargetDate('2028-02-29', '2026-11-01')).toBeNull();
    expect(validateTargetDate('2027-02-29', '2026-11-01')).toBe('invalid');
    expect(validateTargetDate('2026-10-31', '2026-11-01')).toBe('past');
    // Une date passée déjà enregistrée reste acceptée telle quelle (on peut modifier un autre champ).
    expect(validateTargetDate('2026-10-31', '2026-11-01', '2026-10-31')).toBeNull();
  });

  it('mouvement : montant valide, date qui existe, pas dans le futur', () => {
    expect(validateMovementFields(10_000, '2026-11-01', '2026-11-01')).toBeNull();
    expect(validateMovementFields(null, '2026-11-01', '2026-11-01')).toBe('amount');
    expect(validateMovementFields(0, '2026-11-01', '2026-11-01')).toBe('amount');
    expect(validateMovementFields(100, '2026-02-30', '2026-11-01')).toBe('date');
    expect(validateMovementFields(100, '2026-11-02', '2026-11-01')).toBe('future');
    expect(validateMovementFields(100, '2024-02-29', '2026-11-01')).toBeNull();
  });

  it('note : vide devient null', () => {
    expect(cleanNote('  ')).toBeNull();
    expect(cleanNote(null)).toBeNull();
    expect(cleanNote(' pour Noël ')).toBe('pour Noël');
  });

  it('propose des emojis, dont celui par défaut', () => {
    expect(GOAL_EMOJIS).toContain(DEFAULT_GOAL_ICON);
    expect(new Set(GOAL_EMOJIS).size).toBe(GOAL_EMOJIS.length);
  });
});

describe('ordre d\'affichage', () => {
  it('déplace un élément sans perdre ni dupliquer les autres', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('borne les positions et ignore un rang invalide', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, -4)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
    expect(moveItem([], 0, 0)).toEqual([]);
  });

  it('ne modifie pas la liste d\'origine', () => {
    const original = ['a', 'b', 'c'];
    moveItem(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('glisser : la ligne change de place quand son centre dépasse la moitié du voisin (seuil à mi-hauteur)', () => {
    expect(dragTargetIndex(1, 0, 70, 5)).toBe(1);
    expect(dragTargetIndex(1, 34, 70, 5)).toBe(1); // moins de la moitié : elle reste
    expect(dragTargetIndex(1, 36, 70, 5)).toBe(2);
    expect(dragTargetIndex(1, -36, 70, 5)).toBe(0);
    expect(dragTargetIndex(2, 300, 70, 5)).toBe(4); // borné au dernier rang
    expect(dragTargetIndex(2, -900, 70, 5)).toBe(0); // et au premier
  });

  it('glisser puis revenir à la case de départ : aucun changement (abandon)', () => {
    const from = 2;
    expect(dragTargetIndex(from, 80, 70, 5)).toBe(3);
    expect(dragTargetIndex(from, 5, 70, 5)).toBe(from);
  });

  it('décale les voisins quand une ligne descend', () => {
    expect(shiftSlots([0, 1, 2, 3], 0, 2)).toEqual([2, 0, 1, 3]);
    expect(slotsToOrder(['a', 'b', 'c', 'd'], shiftSlots([0, 1, 2, 3], 0, 2))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('décale les voisins quand une ligne monte', () => {
    expect(shiftSlots([0, 1, 2, 3], 3, 1)).toEqual([0, 2, 3, 1]);
    expect(slotsToOrder(['a', 'b', 'c', 'd'], shiftSlots([0, 1, 2, 3], 3, 1))).toEqual(['a', 'd', 'b', 'c']);
  });

  it('reste une permutation après de nombreux déplacements successifs (aucune place perdue ni dupliquée)', () => {
    let slots = [0, 1, 2, 3, 4, 5];
    const moves: [number, number][] = [[0, 5], [3, 0], [5, 2], [1, 1], [4, 99], [2, -3], [0, 3]];
    for (const [item, to] of moves) {
      slots = shiftSlots(slots, item, to);
      expect([...slots].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });

  it('glisser vers une place puis revenir à la place de départ rend l’ordre d’origine (abandon)', () => {
    const start = [0, 1, 2, 3];
    const away = shiftSlots(start, 1, 3);
    expect(away).not.toEqual(start);
    expect(shiftSlots(away, 1, 1)).toEqual(start);
  });

  it('élément ou place hors limites : places bornées, élément inconnu ignoré', () => {
    expect(shiftSlots([0, 1, 2], 0, 99)).toEqual([2, 0, 1]);
    expect(shiftSlots([0, 1, 2], 2, -5)).toEqual([1, 2, 0]);
    expect(shiftSlots([0, 1, 2], 7, 1)).toEqual([0, 1, 2]);
    expect(shiftSlots([], 0, 0)).toEqual([]);
  });

  it('entrées dégénérées : hauteur nulle ou liste vide gardent la position', () => {
    expect(dragTargetIndex(1, 200, 0, 4)).toBe(1);
    expect(dragTargetIndex(0, 200, 70, 0)).toBe(0);
  });
});
