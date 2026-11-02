import { isValidDate } from './bills';
import { MAX_AMOUNT_CENTS } from './money';

/**
 * Objectifs d'épargne : règles pures (aucune dépendance à la base ni à l'écran), testées.
 *
 * L'épargne de Sovmilo est DÉCLARATIVE : ajouter 100 € à un objectif signifie « j'ai mis 100 € de côté pour cela ». Ce n'est ni un
 * virement bancaire, ni une dépense, ni un revenu : rien ici ne touche aux opérations, au solde, aux budgets ni aux factures.
 *
 * Modèle : un OBJECTIF (nom, montant cible, icône, date cible indicative) et des MOUVEMENTS (versement ou retrait, montant, date).
 * Le montant épargné n'est jamais stocké : c'est la somme des mouvements actifs (versements − retraits). Il ne peut donc pas
 * diverger de l'historique. Montants : centimes entiers. Dates : dates civiles `YYYY-MM-DD`, sans heure ni fuseau.
 */

export const MOVEMENT_KINDS = ['deposit', 'withdrawal'] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export function isMovementKind(value: unknown): value is MovementKind {
  return typeof value === 'string' && (MOVEMENT_KINDS as readonly string[]).includes(value);
}

export const MAX_GOAL_NAME_LENGTH = 60;
export const MAX_GOAL_NOTE_LENGTH = 200;
export const MAX_MOVEMENT_NOTE_LENGTH = 120;
export const MAX_SAVINGS_AMOUNT_CENTS = MAX_AMOUNT_CENTS;

/** Icône proposée quand l'utilisatrice n'en choisit pas (emoji, comme les catégories personnalisées). */
export const DEFAULT_GOAL_ICON = '🎯';

/** Emojis proposés pour un objectif : une courte liste pensée pour une famille, pas le catalogue Unicode. */
export const GOAL_EMOJIS = ['🎯', '🏖️', '✈️', '🚗', '🏠', '🎁', '🛡️', '💍', '🎓', '👶', '🐶', '💻', '📱', '🚲', '🎄', '💶'] as const;

// ---------------------------------------------------------------------------
// Mouvements et chronologie
// ---------------------------------------------------------------------------

/** Ce que les calculs lisent d'un mouvement. `createdAt` départage deux mouvements du même jour (ordre de saisie). */
export interface MovementLike {
  id: string;
  kind: MovementKind;
  amountCents: number;
  occurredOn: string;
  createdAt: string;
}

/** Ordre chronologique : par date, puis par ordre de saisie, puis par identifiant (ordre total et stable). */
export function compareMovements(a: MovementLike, b: MovementLike): number {
  if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Variation du montant épargné apportée par un mouvement : + pour un versement, − pour un retrait. */
export function signedAmount(movement: Pick<MovementLike, 'kind' | 'amountCents'>): number {
  return movement.kind === 'deposit' ? movement.amountCents : -movement.amountCents;
}

/** Montant épargné : somme des versements moins somme des retraits. */
export function savedCents(movements: readonly Pick<MovementLike, 'kind' | 'amountCents'>[]): number {
  let total = 0;
  for (const movement of movements) total += signedAmount(movement);
  return total;
}

/** Montant épargné après chaque mouvement, dans l'ordre chronologique. */
export function runningBalances<T extends MovementLike>(movements: readonly T[]): { movement: T; balanceCents: number }[] {
  let balance = 0;
  return [...movements].sort(compareMovements).map((movement) => {
    balance += signedAmount(movement);
    return { movement, balanceCents: balance };
  });
}

export interface TimelineProblem {
  /** Premier mouvement après lequel le montant épargné devient négatif. */
  movementId: string;
  /** Montant épargné à cet instant (strictement négatif). */
  balanceCents: number;
}

/**
 * Un historique est cohérent si le montant épargné ne devient JAMAIS négatif à aucun moment de la chronologie, pas seulement à la fin.
 * Retirer 50 € le 3 du mois alors que le versement de 80 € date du 5 est refusé, même si le total final est positif.
 */
export function findTimelineProblem(movements: readonly MovementLike[]): TimelineProblem | null {
  for (const { movement, balanceCents } of runningBalances(movements)) {
    if (balanceCents < 0) return { movementId: movement.id, balanceCents };
  }
  return null;
}

export function isConsistentTimeline(movements: readonly MovementLike[]): boolean {
  return findTimelineProblem(movements) === null;
}

/** Historique d'affichage : le plus récent d'abord (même ordre total que la chronologie, inversé). */
export function newestFirst<T extends MovementLike>(movements: readonly T[]): T[] {
  return [...movements].sort((a, b) => compareMovements(b, a));
}

/** Plus grand retrait possible à une date donnée sans rendre l'historique incohérent (versements passés − retraits passés, et tout retrait futur reste couvert). */
export function maxWithdrawalCents(movements: readonly MovementLike[], occurredOn: string, candidateId = '￿', candidateCreatedAt = '￿'): number {
  // Retrait fictif à insérer : on cherche le plus grand montant qui garde tous les soldes positifs.
  const probe: MovementLike = { id: candidateId, kind: 'withdrawal', amountCents: 0, occurredOn, createdAt: candidateCreatedAt };
  const timeline = [...movements, probe].sort(compareMovements);
  let balance = 0;
  let before = 0; // solde juste avant le retrait fictif
  let lowestAfter = Number.POSITIVE_INFINITY; // plus bas solde atteint après lui
  let passed = false;
  for (const movement of timeline) {
    if (movement === probe) {
      before = balance;
      passed = true;
      continue;
    }
    balance += signedAmount(movement);
    if (passed) lowestAfter = Math.min(lowestAfter, balance);
  }
  // Après le retrait de X, les soldes suivants baissent de X : il faut lowestAfter − X ≥ 0 et before − X ≥ 0.
  return Math.max(0, Math.min(before, lowestAfter));
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export type GoalState = 'empty' | 'inProgress' | 'reached' | 'exceeded';

export interface GoalProgress {
  savedCents: number;
  targetCents: number;
  /** Reste à épargner, jamais négatif. */
  remainingCents: number;
  /** Dépassement de la cible (0 si la cible n'est pas dépassée). */
  exceededCents: number;
  /** Pourcentage réel ARRONDI À L'ENTIER INFÉRIEUR (jamais 100 % tant que la cible n'est pas atteinte), peut dépasser 100. */
  percent: number;
  /** Remplissage de la barre : le pourcentage plafonné à 100. */
  barPercent: number;
  state: GoalState;
}

/**
 * Progression d'un objectif. Calcul en entiers (aucun flottant sur les montants). Le pourcentage est arrondi vers le BAS : 99,9 %
 * s'affiche 99 %, jamais 100 % avant d'avoir atteint la cible. Si l'objectif dépasse sa cible, le montant réel reste exact
 * (`savedCents`, `exceededCents`) ; seule la barre est plafonnée.
 */
export function goalProgress(saved: number, target: number): GoalProgress {
  const safeSaved = Math.max(0, saved);
  const percent = target > 0 ? Math.floor((safeSaved * 100) / target) : 0;
  const state: GoalState = safeSaved === 0 ? 'empty' : safeSaved > target ? 'exceeded' : safeSaved === target ? 'reached' : 'inProgress';
  return {
    savedCents: safeSaved,
    targetCents: target,
    remainingCents: Math.max(0, target - safeSaved),
    exceededCents: Math.max(0, safeSaved - target),
    percent,
    barPercent: Math.min(percent, 100),
    state,
  };
}

export interface SavingsSummary {
  /** Total DÉCLARÉ dans les objectifs actifs (jamais un solde bancaire). */
  totalSavedCents: number;
  goalCount: number;
  reachedCount: number;
}

/** Résumé des objectifs actifs. */
export function summarizeGoals(goals: readonly { savedCents: number; targetCents: number }[]): SavingsSummary {
  let total = 0;
  let reached = 0;
  for (const goal of goals) {
    total += Math.max(0, goal.savedCents);
    if (goal.savedCents >= goal.targetCents) reached += 1;
  }
  return { totalSavedCents: total, goalCount: goals.length, reachedCount: reached };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function cleanGoalName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export type GoalNameProblem = 'empty' | 'too-long';

export function validateGoalName(name: string): GoalNameProblem | null {
  const cleaned = cleanGoalName(name);
  if (cleaned === '') return 'empty';
  return cleaned.length > MAX_GOAL_NAME_LENGTH ? 'too-long' : null;
}

/** Note nettoyée (`null` si vide). */
export function cleanNote(note: string | null | undefined): string | null {
  const cleaned = (note ?? '').trim();
  return cleaned === '' ? null : cleaned;
}

/** Montant cible ou montant d'un mouvement : un entier de centimes STRICTEMENT positif, dans la limite. */
export function isValidSavingsAmount(cents: number | null): cents is number {
  return cents !== null && Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_SAVINGS_AMOUNT_CENTS;
}

export type TargetDateProblem = 'invalid' | 'past';

/**
 * Date cible, INDICATIVE : une date qui existe. Pas dans le passé quand on la choisit ; une date déjà passée déjà enregistrée reste
 * acceptée telle quelle (`previous`), on ne bloque pas la modification d'un autre champ.
 */
export function validateTargetDate(value: string | null, today: string, previous: string | null = null): TargetDateProblem | null {
  if (value === null) return null;
  if (!isValidDate(value)) return 'invalid';
  return value < today && value !== previous ? 'past' : null;
}

export type MovementProblem = 'amount' | 'date' | 'future';

/** Mouvement déclaré : un montant strictement positif et une date qui existe, pas dans le futur (on déclare ce qui est fait). */
export function validateMovementFields(amountCents: number | null, occurredOn: string, today: string): MovementProblem | null {
  if (!isValidSavingsAmount(amountCents)) return 'amount';
  if (!isValidDate(occurredOn)) return 'date';
  return occurredOn > today ? 'future' : null;
}

// ---------------------------------------------------------------------------
// Ordre d'affichage
// ---------------------------------------------------------------------------

/** Déplace l'élément `from` à la position `to` (copie ; positions bornées). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  if (from < 0 || from >= copy.length) return copy;
  const target = Math.min(Math.max(to, 0), copy.length - 1);
  const [moved] = copy.splice(from, 1);
  copy.splice(target, 0, moved);
  return copy;
}

/**
 * Nouvelle répartition des places quand l'élément `item` va à la place `toSlot` : `slots[i]` est la place actuelle de l'élément `i`.
 * L'élément déplacé prend `toSlot` ; ceux qui se trouvaient entre sa place de départ et `toSlot` reculent ou avancent d'une place.
 * Toujours une permutation : aucune place perdue ni dupliquée. Utilisée pendant le glissement, sans toucher à la base.
 */
export function shiftSlots(slots: readonly number[], item: number, toSlot: number): number[] {
  'worklet';
  const count = slots.length;
  if (item < 0 || item >= count) return slots.slice();
  const from = slots[item];
  const to = Math.min(Math.max(toSlot, 0), count - 1);
  const next: number[] = [];
  for (let index = 0; index < count; index++) {
    const slot = slots[index];
    if (index === item) next.push(to);
    else if (from < to && slot > from && slot <= to) next.push(slot - 1);
    else if (from > to && slot >= to && slot < from) next.push(slot + 1);
    else next.push(slot);
  }
  return next;
}

/** Identifiants dans l'ordre d'affichage, d'après les places : `ids[i]` occupe la place `slots[i]`. */
export function slotsToOrder<T>(ids: readonly T[], slots: readonly number[]): T[] {
  const order: T[] = new Array<T>(ids.length);
  ids.forEach((id, index) => {
    order[slots[index]] = id;
  });
  return order;
}

/**
 * Position visée quand on fait glisser la ligne `from` de `translationY` dp, les lignes ayant toutes la hauteur `rowHeight`.
 * La ligne change de place dès que son centre dépasse la moitié de la ligne voisine (arrondi au plus proche).
 */
export function dragTargetIndex(from: number, translationY: number, rowHeight: number, count: number): number {
  'worklet';
  if (rowHeight <= 0 || count <= 0) return from;
  const target = Math.round(from + translationY / rowHeight);
  return Math.min(Math.max(target, 0), count - 1);
}

// ---------------------------------------------------------------------------
// Session de réorganisation (mode « Réorganiser » d'Épargne)
// ---------------------------------------------------------------------------

/** Réorganiser n'a de sens qu'à partir de deux objectifs actifs. */
export function canReorder(goalCount: number): boolean {
  return goalCount >= 2;
}

/** Deux listes d'identifiants dans le même ordre exactement. */
export function isSameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Que fait « Retour » (bouton Android, flèche de l'en-tête) pendant la réorganisation ? Sans changement : on quitte le mode.
 * Avec un ordre modifié et non validé : on demande avant de l'abandonner (rien n'est enregistré avant « Terminé »).
 */
export function reorderBackAction(initial: readonly string[], draft: readonly string[]): 'leave' | 'ask' {
  return isSameOrder(initial, draft) ? 'leave' : 'ask';
}
