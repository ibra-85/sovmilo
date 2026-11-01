import { and, asc, eq, isNull, max } from 'drizzle-orm';

import { db } from '@/db/client';
import { LOCAL_USER_ID, newId, nowISO } from '@/db/ids';
import { savingsGoals, savingsMovements, type SavingsGoal, type SavingsMovement } from '@/db/schema';
import {
  DEFAULT_GOAL_ICON,
  MAX_GOAL_NOTE_LENGTH,
  MAX_MOVEMENT_NOTE_LENGTH,
  cleanGoalName,
  cleanNote,
  findTimelineProblem,
  isMovementKind,
  isValidSavingsAmount,
  maxWithdrawalCents,
  validateGoalName,
  validateMovementFields,
  validateTargetDate,
  type MovementKind,
  type MovementLike,
} from '@/domain/savings';

/**
 * Accès aux objectifs d'épargne et à leurs mouvements (base locale). L'épargne est DÉCLARATIVE : rien ici ne touche à
 * `transactions`, aux budgets, aux factures ni au solde. Toutes les écritures valident leurs entrées et s'exécutent en une
 * transaction (tout ou rien). Suppression LOGIQUE : un mouvement annulé ou un objectif supprimé reste en base.
 *
 * Le montant épargné n'est jamais stocké : c'est la somme des mouvements actifs. Chaque écriture de mouvement revérifie
 * toute la chronologie (le montant épargné ne doit jamais devenir négatif, à aucun moment), donc un historique incohérent ne
 * peut pas être enregistré. Les dates sont des dates civiles ; `today` est TOUJOURS passé par l'appelant (testable).
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SavingsErrorCode =
  | 'invalid' // champ refusé par les règles (nom vide, montant nul, date future…)
  | 'not-found'
  | 'archived' // objectif archivé : à restaurer avant toute modification
  | 'negative' // l'opération rendrait l'historique incohérent (montant épargné négatif à un moment)
  | 'has-history'; // suppression refusée : l'objectif a des mouvements, il faut l'archiver

export class SavingsError extends Error {
  constructor(
    readonly code: SavingsErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'SavingsError';
  }
}

export interface GoalInput {
  name: string;
  targetCents: number;
  /** Emoji ; vide : l'icône par défaut. */
  icon: string;
  /** Date cible indicative `YYYY-MM-DD`, ou `null`. */
  targetDate: string | null;
  note: string | null;
}

export interface MovementInput {
  /**
   * Identifiant choisi par l'appelant AVANT l'enregistrement (à l'ouverture du panneau). Enregistrer deux fois le même
   * identifiant n'ajoute qu'un mouvement : protection contre le double toucher.
   */
  id?: string;
  kind: MovementKind;
  amountCents: number;
  occurredOn: string;
  note: string | null;
}

function cleanGoal(input: GoalInput, today: string, previousTargetDate: string | null): Omit<GoalInput, 'icon'> & { icon: string } {
  const name = cleanGoalName(input.name);
  const note = cleanNote(input.note);
  if (
    validateGoalName(input.name) !== null ||
    !isValidSavingsAmount(input.targetCents) ||
    validateTargetDate(input.targetDate, today, previousTargetDate) !== null ||
    (note !== null && note.length > MAX_GOAL_NOTE_LENGTH)
  ) {
    throw new SavingsError('invalid');
  }
  return { name, targetCents: input.targetCents, icon: input.icon.trim() || DEFAULT_GOAL_ICON, targetDate: input.targetDate, note };
}

function findGoal(tx: Tx, id: string): SavingsGoal {
  const goal = tx
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, id), isNull(savingsGoals.deletedAt)))
    .get();
  if (!goal) throw new SavingsError('not-found', 'Objectif introuvable');
  return goal;
}

function findMovement(tx: Tx, id: string): SavingsMovement {
  const movement = tx
    .select()
    .from(savingsMovements)
    .where(and(eq(savingsMovements.id, id), isNull(savingsMovements.deletedAt)))
    .get();
  if (!movement) throw new SavingsError('not-found', 'Mouvement introuvable');
  return movement;
}

function activeMovements(tx: Tx, goalId: string): SavingsMovement[] {
  return tx
    .select()
    .from(savingsMovements)
    .where(and(eq(savingsMovements.goalId, goalId), isNull(savingsMovements.deletedAt)))
    .all();
}

const asLike = (movement: SavingsMovement): MovementLike => ({
  id: movement.id,
  kind: movement.kind,
  amountCents: movement.amountCents,
  occurredOn: movement.occurredOn,
  createdAt: movement.createdAt,
});

function assertWritable(goal: SavingsGoal): void {
  if (goal.archivedAt !== null) throw new SavingsError('archived');
}

function assertConsistent(movements: readonly MovementLike[]): void {
  if (findTimelineProblem(movements) !== null) throw new SavingsError('negative');
}

function nextSortOrder(tx: Tx): number {
  const row = tx
    .select({ top: max(savingsGoals.sortOrder) })
    .from(savingsGoals)
    .where(and(isNull(savingsGoals.deletedAt), isNull(savingsGoals.archivedAt)))
    .get();
  return row?.top === null || row?.top === undefined ? 0 : row.top + 1;
}

// ---------------------------------------------------------------------------
// Objectifs
// ---------------------------------------------------------------------------

/** Crée un objectif (montant épargné : zéro) à la fin de la liste. Renvoie son identifiant. */
export function createGoal(input: GoalInput, today: string): string {
  const goal = cleanGoal(input, today, null);
  const id = newId();
  const now = nowISO();
  db.transaction((tx) => {
    tx.insert(savingsGoals)
      .values({ id, userId: LOCAL_USER_ID, ...goal, sortOrder: nextSortOrder(tx), createdAt: now, updatedAt: now })
      .run();
  });
  return id;
}

/** Modifie un objectif. Les mouvements ne sont jamais touchés, même si le montant cible change. */
export function updateGoal(id: string, input: GoalInput, today: string): void {
  db.transaction((tx) => {
    const current = findGoal(tx, id);
    const goal = cleanGoal(input, today, current.targetDate);
    tx.update(savingsGoals)
      .set({ ...goal, updatedAt: nowISO() })
      .where(eq(savingsGoals.id, id))
      .run();
  });
}

/** Archive un objectif : il quitte la liste active, tout son historique est conservé. */
export function archiveGoal(id: string): void {
  db.transaction((tx) => {
    const goal = findGoal(tx, id);
    if (goal.archivedAt !== null) return;
    const now = nowISO();
    tx.update(savingsGoals).set({ archivedAt: now, updatedAt: now }).where(eq(savingsGoals.id, id)).run();
  });
}

/** Restaure un objectif archivé, à la fin de la liste active. */
export function restoreGoal(id: string): void {
  db.transaction((tx) => {
    const goal = findGoal(tx, id);
    if (goal.archivedAt === null) return;
    tx.update(savingsGoals).set({ archivedAt: null, sortOrder: nextSortOrder(tx), updatedAt: nowISO() }).where(eq(savingsGoals.id, id)).run();
  });
}

/**
 * Supprime un objectif SANS mouvement actif. Un objectif qui a un historique n'est jamais supprimé : il faut l'archiver
 * (`has-history`). La suppression est logique ; les éventuels mouvements déjà annulés restent en base.
 */
export function deleteGoal(id: string): void {
  db.transaction((tx) => {
    findGoal(tx, id);
    if (activeMovements(tx, id).length > 0) throw new SavingsError('has-history');
    const now = nowISO();
    tx.update(savingsGoals).set({ deletedAt: now, updatedAt: now }).where(eq(savingsGoals.id, id)).run();
  });
}

/**
 * Enregistre l'ordre des objectifs ACTIFS : `orderedIds` du premier au dernier. Appelée une seule fois, au relâchement d'une ligne
 * (jamais pendant le glissement). Les identifiants inconnus ou archivés sont ignorés ; un objectif actif oublié garde sa place
 * relative et passe après les autres. N'écrit que les lignes dont la position change.
 */
export function reorderGoals(orderedIds: readonly string[]): void {
  db.transaction((tx) => {
    const active = tx
      .select()
      .from(savingsGoals)
      .where(and(isNull(savingsGoals.deletedAt), isNull(savingsGoals.archivedAt)))
      .orderBy(asc(savingsGoals.sortOrder), asc(savingsGoals.createdAt))
      .all();
    const byId = new Map(active.map((goal) => [goal.id, goal] as const));
    const seen = new Set<string>();
    const sequence: SavingsGoal[] = [];
    for (const id of orderedIds) {
      const goal = byId.get(id);
      if (goal && !seen.has(id)) {
        seen.add(id);
        sequence.push(goal);
      }
    }
    for (const goal of active) if (!seen.has(goal.id)) sequence.push(goal);
    const now = nowISO();
    sequence.forEach((goal, index) => {
      if (goal.sortOrder !== index) tx.update(savingsGoals).set({ sortOrder: index, updatedAt: now }).where(eq(savingsGoals.id, goal.id)).run();
    });
  });
}

// ---------------------------------------------------------------------------
// Mouvements
// ---------------------------------------------------------------------------

function cleanMovement(input: { kind: MovementKind; amountCents: number; occurredOn: string; note: string | null }, today: string) {
  const note = cleanNote(input.note);
  if (
    !isMovementKind(input.kind) ||
    validateMovementFields(input.amountCents, input.occurredOn, today) !== null ||
    (note !== null && note.length > MAX_MOVEMENT_NOTE_LENGTH)
  ) {
    throw new SavingsError('invalid');
  }
  return { kind: input.kind, amountCents: input.amountCents, occurredOn: input.occurredOn, note };
}

/**
 * Ajoute un versement ou un retrait. Refuse (`negative`) un retrait que l'historique ne permet pas : plus que le montant disponible
 * à cette date, ou qui laisserait un retrait plus tardif à découvert. Enregistrer deux fois le même `id` ne crée qu'un mouvement.
 */
export function addMovement(goalId: string, input: MovementInput, today: string): { id: string; created: boolean } {
  const fields = cleanMovement(input, today);
  const id = input.id ?? newId();
  return db.transaction((tx) => {
    const goal = findGoal(tx, goalId);
    const already = tx.select().from(savingsMovements).where(eq(savingsMovements.id, id)).get();
    if (already) {
      if (already.goalId !== goalId) throw new SavingsError('invalid');
      return { id, created: false };
    }
    assertWritable(goal);
    const now = nowISO();
    const row = { id, userId: LOCAL_USER_ID, goalId, ...fields, createdAt: now, updatedAt: now };
    assertConsistent([...activeMovements(tx, goalId).map(asLike), { id, kind: fields.kind, amountCents: fields.amountCents, occurredOn: fields.occurredOn, createdAt: now }]);
    tx.insert(savingsMovements).values(row).run();
    return { id, created: true };
  });
}

export type MovementPatch = Partial<Pick<MovementInput, 'kind' | 'amountCents' | 'occurredOn' | 'note'>>;

/** Corrige un mouvement (type, montant, date, note). L'historique complet est revérifié : une correction qui le rendrait incohérent est refusée. */
export function updateMovement(id: string, patch: MovementPatch, today: string): void {
  db.transaction((tx) => {
    const current = findMovement(tx, id);
    assertWritable(findGoal(tx, current.goalId));
    const next = cleanMovement(
      {
        kind: patch.kind ?? current.kind,
        amountCents: patch.amountCents ?? current.amountCents,
        occurredOn: patch.occurredOn ?? current.occurredOn,
        note: patch.note === undefined ? current.note : patch.note,
      },
      today,
    );
    const others = activeMovements(tx, current.goalId).filter((movement) => movement.id !== id).map(asLike);
    assertConsistent([...others, { id, kind: next.kind, amountCents: next.amountCents, occurredOn: next.occurredOn, createdAt: current.createdAt }]);
    tx.update(savingsMovements).set({ ...next, updatedAt: nowISO() }).where(eq(savingsMovements.id, id)).run();
  });
}

/** Annule un mouvement (suppression logique). Refusée (`negative`) si un retrait plus tardif en dépend. */
export function cancelMovement(id: string): void {
  db.transaction((tx) => {
    const current = findMovement(tx, id);
    assertWritable(findGoal(tx, current.goalId));
    assertConsistent(activeMovements(tx, current.goalId).filter((movement) => movement.id !== id).map(asLike));
    const now = nowISO();
    tx.update(savingsMovements).set({ deletedAt: now, updatedAt: now }).where(eq(savingsMovements.id, id)).run();
  });
}

/** Rétablit un mouvement annulé (« Annuler » de la notification). Revérifie l'historique. */
export function restoreMovement(id: string): void {
  db.transaction((tx) => {
    const current = tx.select().from(savingsMovements).where(eq(savingsMovements.id, id)).get();
    if (!current) throw new SavingsError('not-found');
    if (current.deletedAt === null) return;
    assertWritable(findGoal(tx, current.goalId));
    assertConsistent([...activeMovements(tx, current.goalId).map(asLike), asLike(current)]);
    tx.update(savingsMovements).set({ deletedAt: null, updatedAt: nowISO() }).where(eq(savingsMovements.id, id)).run();
  });
}

/** Plus grand retrait possible à `occurredOn` pour cet objectif (`excludeId` : le mouvement qu'on est en train de corriger). */
export function availableToWithdraw(goalId: string, occurredOn: string, excludeId?: string): number {
  const movements = db
    .select()
    .from(savingsMovements)
    .where(and(eq(savingsMovements.goalId, goalId), isNull(savingsMovements.deletedAt)))
    .all()
    .filter((movement) => movement.id !== excludeId)
    .map(asLike);
  return maxWithdrawalCents(movements, occurredOn);
}
