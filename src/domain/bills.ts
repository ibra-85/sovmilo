import { MAX_AMOUNT_CENTS } from './money';

/**
 * Factures et échéances : règles pures (aucune dépendance à la base ni à l'écran), testées.
 *
 * Modèle : une FACTURE (définition : nom, montant prévu, récurrence, date d'ancrage) produit des ÉCHÉANCES (une par date).
 * Chaque échéance a son propre état : à payer, ou payée (date et montant réellement payé). Payer une échéance ne touche jamais
 * les autres. Les factures ne sont PAS des opérations : rien ici ne crée de dépense ni ne touche au solde ou aux budgets.
 *
 * Dates : toujours des dates civiles `YYYY-MM-DD`, sans heure ni fuseau. Les écarts en jours se calculent en UTC sur le jour
 * civil (jamais sur des millisecondes locales), donc l'heure d'été / d'hiver et le fuseau ne peuvent rien décaler.
 * Montants : centimes entiers ; `null` = montant inconnu (jamais 0).
 */

export const BILL_RECURRENCES = ['none', 'monthly', 'yearly'] as const;
export type BillRecurrence = (typeof BILL_RECURRENCES)[number];

export function isBillRecurrence(value: unknown): value is BillRecurrence {
  return typeof value === 'string' && (BILL_RECURRENCES as readonly string[]).includes(value);
}

export const MAX_BILL_NAME_LENGTH = 80;
export const MAX_BILL_NOTE_LENGTH = 200;
export const MAX_BILL_AMOUNT_CENTS = MAX_AMOUNT_CENTS;

/**
 * Fenêtre « À payer bientôt » : une échéance non payée dont la date tombe dans les 7 prochains jours (aujourd'hui exclu, c'est
 * un statut à part). VALEUR DE PRÉSENTATION centralisée ici, pas une règle financière : elle ne change aucun total.
 */
export const SOON_WINDOW_DAYS = 7;

/**
 * Combien de mois À VENIR l'écran Factures permet de consulter (sélecteur de période). UNE seule valeur pour l'écran ET pour la
 * génération : un mois qu'on peut choisir a toujours ses échéances.
 */
export const CONSULTABLE_MONTHS_AHEAD = 6;

/** Les échéances futures sont créées jusqu'à la fin du dernier mois consultable (plus la prochaine, voir `plannedDueDates`). */
export const GENERATION_HORIZON_MONTHS = CONSULTABLE_MONTHS_AHEAD;

/**
 * Plafond de la génération À LA DEMANDE (`throughMonth`) : 5 ans. Garde-fou si un sélecteur de mois plus libre apparaît un jour ;
 * 60 échéances par facture mensuelle au plus, donc jamais de génération démesurée.
 */
export const MAX_GENERATION_MONTHS_AHEAD = 60;

/** À la création, une première échéance peut remonter jusqu'à un an en arrière (au-delà, c'est presque sûrement une faute de frappe). */
export const MAX_PAST_CREATION_DAYS = 366;

/** Garde-fou : aucune facture ne génère plus d'échéances que cela en une fois (50 ans de factures mensuelles = 600). */
const MAX_GENERATED_DATES = 1200;

// ---------------------------------------------------------------------------
// Dates civiles
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, length = 2) => String(n).padStart(length, '0');

interface DateParts {
  year: number;
  month: number; // 1 à 12
  day: number;
}

/** Nombre de jours du mois (février bissextile compris), en calcul pur : ne dépend pas du fuseau. */
export function daysInMonthOf(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Découpe `YYYY-MM-DD`. Null si le texte n'est pas une date qui existe (31 février, mois 13…) ou si l'année sort de 1900–2999. */
export function splitDate(value: string): DateParts | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1900 || year > 2999 || month < 1 || month > 12 || day < 1 || day > daysInMonthOf(year, month)) return null;
  return { year, month, day };
}

export function isValidDate(value: string): boolean {
  return splitDate(value) !== null;
}

function joinDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Numéro du jour civil (jours écoulés depuis 1970-01-01 UTC) : base des écarts en jours. */
function dayNumber(parts: DateParts): number {
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

/** Jours entre deux dates civiles (`to` − `from`) ; négatif si `to` est avant `from`. Lève une erreur si une date est invalide. */
export function daysBetween(from: string, to: string): number {
  const a = splitDate(from);
  const b = splitDate(to);
  if (!a || !b) throw new RangeError(`Date invalide : ${a ? to : from}`);
  return dayNumber(b) - dayNumber(a);
}

/** Dernier jour du mois `YYYY-MM`, ou `null` si ce n'est pas un mois valide. */
function endOfMonthKey(month: string): string | null {
  const parts = splitDate(`${month}-01`);
  return parts ? joinDate(parts.year, parts.month, daysInMonthOf(parts.year, parts.month)) : null;
}

/** Dernier jour du mois situé `months` mois après le mois de `value`. */
function endOfMonthAfter(value: string, months: number): string {
  const parts = splitDate(value);
  if (!parts) throw new RangeError(`Date invalide : ${value}`);
  const index = parts.year * 12 + (parts.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return joinDate(year, month, daysInMonthOf(year, month));
}

// ---------------------------------------------------------------------------
// Récurrence
// ---------------------------------------------------------------------------

/**
 * `k`-ième date (0 = la date d'ancrage) d'une facture. Le jour d'origine est TOUJOURS celui de l'ancre, pas celui de la date
 * précédente : un 31 janvier donne le 28 février (29 en année bissextile) puis REVIENT au 31 mars ; un 29 février annuel
 * donne le 28 février des années non bissextiles et le 29 des années bissextiles.
 */
export function dueDateAt(anchor: string, recurrence: BillRecurrence, k: number): string {
  const parts = splitDate(anchor);
  if (!parts) throw new RangeError(`Date d'ancrage invalide : ${anchor}`);
  if (!Number.isInteger(k) || k < 0) throw new RangeError(`Rang d'échéance invalide : ${k}`);
  if (recurrence === 'none') {
    if (k !== 0) throw new RangeError('Une facture ponctuelle n\'a qu\'une échéance');
    return anchor;
  }
  if (recurrence === 'yearly') {
    const year = parts.year + k;
    return joinDate(year, parts.month, Math.min(parts.day, daysInMonthOf(year, parts.month)));
  }
  const index = parts.year * 12 + (parts.month - 1) + k;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return joinDate(year, month, Math.min(parts.day, daysInMonthOf(year, month)));
}

/**
 * Dates de la série qui sont ≤ `through`, de l'ancre à `through` (une facture ponctuelle : sa seule date, si elle n'est pas
 * postérieure). Le nombre de dates est borné (`MAX_GENERATED_DATES`).
 */
export function dueDatesThrough(anchor: string, recurrence: BillRecurrence, through: string): string[] {
  const dates: string[] = [];
  for (let k = 0; k < MAX_GENERATED_DATES; k += 1) {
    const date = dueDateAt(anchor, recurrence, k);
    if (date > through) break; // `YYYY-MM-DD` se compare comme du texte
    dates.push(date);
    if (recurrence === 'none') break;
  }
  return dates;
}

export interface PlanInput {
  anchor: string;
  recurrence: BillRecurrence;
  /** Dernier jour où une échéance peut exister (récurrence arrêtée), ou `null` : la série continue. */
  stoppedOn: string | null;
  today: string;
  /**
   * Mois `YYYY-MM` que l'écran affiche : la génération va au moins jusqu'à sa fin (dans la limite de `MAX_GENERATION_MONTHS_AHEAD`).
   * Filet de sécurité en plus de l'horizon fixe ; un mois passé ou déjà couvert ne change rien.
   */
  throughMonth?: string;
}

/**
 * Échéances qui doivent exister pour une facture, aujourd'hui. Fonction PURE et déterministe : la base n'a qu'à insérer celles
 * qui manquent (une contrainte d'unicité interdit les doublons), d'où une génération idempotente.
 *  - ponctuelle : sa seule date ;
 *  - récurrente : toutes les dates de l'ancre jusqu'à la fin du dernier mois consultable (`GENERATION_HORIZON_MONTHS`, ou
 *    `throughMonth` s'il est plus loin) (ce qui inclut TOUTES les
 *    échéances passées, donc une facture oubliée depuis des mois reste visible comme impayée), et, s'il n'y en a aucune
 *    APRÈS aujourd'hui (facture annuelle, ou payée le jour même), la prochaine : il y a toujours une échéance à venir tant que la série continue ;
 *  - série arrêtée : rien après `stoppedOn`.
 */
export function plannedDueDates({ anchor, recurrence, stoppedOn, today, throughMonth }: PlanInput): string[] {
  if (recurrence === 'none') return [anchor];
  let horizon = endOfMonthAfter(today, GENERATION_HORIZON_MONTHS);
  const requested = throughMonth === undefined ? null : endOfMonthKey(throughMonth);
  if (requested !== null && requested > horizon) {
    const limit = endOfMonthAfter(today, MAX_GENERATION_MONTHS_AHEAD);
    horizon = requested < limit ? requested : limit;
  }
  const through = stoppedOn !== null && stoppedOn < horizon ? stoppedOn : horizon;
  const dates = dueDatesThrough(anchor, recurrence, through);
  const hasLater = dates.some((date) => date > today);
  if (!hasLater) {
    const next = dueDateAt(anchor, recurrence, dates.length);
    if (stoppedOn === null || next <= stoppedOn) dates.push(next);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Statuts
// ---------------------------------------------------------------------------

/** Ce dont les statuts et les totaux ont besoin d'une échéance. */
export interface OccurrenceLike {
  dueOn: string;
  /** Montant prévu (centimes), `null` = à renseigner. */
  amountCents: number | null;
  /** Date de paiement, `null` = pas payée. */
  paidOn: string | null;
  /** Montant réellement payé (centimes), `null` = non noté. */
  paidAmountCents: number | null;
}

export type BillStatus = 'paid' | 'overdue' | 'today' | 'soon' | 'upcoming';

/**
 * Statut d'une échéance. En retard = non payée ET échéance civile antérieure à aujourd'hui. Une échéance d'aujourd'hui est « à
 * payer aujourd'hui », jamais en retard. « Bientôt » = dans 1 à `SOON_WINDOW_DAYS` jours.
 */
export function billStatus(occurrence: Pick<OccurrenceLike, 'dueOn' | 'paidOn'>, today: string): BillStatus {
  if (occurrence.paidOn !== null) return 'paid';
  const days = daysBetween(today, occurrence.dueOn);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return days <= SOON_WINDOW_DAYS ? 'soon' : 'upcoming';
}

/** Jours de retard (≥ 1) d'une échéance non payée dont la date est passée ; 0 sinon. */
export function daysOverdue(occurrence: Pick<OccurrenceLike, 'dueOn' | 'paidOn'>, today: string): number {
  if (occurrence.paidOn !== null) return 0;
  return Math.max(0, -daysBetween(today, occurrence.dueOn));
}

/**
 * Montant à afficher : payée → montant réellement payé (peut différer du prévu), sinon le prévu. `null` = inconnu : l'écran
 * écrit « à renseigner » / « non noté », jamais « 0 € ».
 */
export function displayAmount(occurrence: OccurrenceLike): number | null {
  return occurrence.paidOn !== null ? occurrence.paidAmountCents : occurrence.amountCents;
}

// ---------------------------------------------------------------------------
// Répartition et totaux d'une période
// ---------------------------------------------------------------------------

export interface AmountTotal {
  count: number;
  /** Somme des seuls montants CONNUS (centimes). */
  knownCents: number;
  /** Nombre d'échéances sans montant. */
  unknownCount: number;
  /** Vrai si au moins un montant manque : le total est alors un minimum, à présenter comme tel. */
  partial: boolean;
}

function totalOf(occurrences: readonly OccurrenceLike[]): AmountTotal {
  let knownCents = 0;
  let unknownCount = 0;
  for (const occurrence of occurrences) {
    if (occurrence.amountCents === null) unknownCount += 1;
    else knownCents += occurrence.amountCents;
  }
  return { count: occurrences.length, knownCents, unknownCount, partial: unknownCount > 0 };
}

const byDueDate = (a: OccurrenceLike, b: OccurrenceLike) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0);

export interface BillsPartition<T extends OccurrenceLike> {
  /** TOUTES les échéances en retard, quelle que soit la période affichée (la plus ancienne d'abord). Ne disparaissent jamais en changeant de mois. */
  overdue: T[];
  /** Non payées de la période qui ne sont pas en retard (aujourd'hui ou plus tard), par date. */
  upcoming: T[];
  /** Payées dont l'échéance tombe dans la période, la plus récente d'abord. */
  paid: T[];
}

/** Répartit les échéances (déjà privées de celles supprimées) pour le mois `month` (`YYYY-MM`). Chaque échéance est dans UNE seule liste au plus. */
export function partitionBills<T extends OccurrenceLike>(occurrences: readonly T[], month: string, today: string): BillsPartition<T> {
  const overdue: T[] = [];
  const upcoming: T[] = [];
  const paid: T[] = [];
  for (const occurrence of occurrences) {
    if (occurrence.paidOn !== null) {
      if (occurrence.dueOn.startsWith(month)) paid.push(occurrence);
    } else if (occurrence.dueOn < today) {
      overdue.push(occurrence);
    } else if (occurrence.dueOn.startsWith(month)) {
      upcoming.push(occurrence);
    }
  }
  overdue.sort(byDueDate);
  upcoming.sort(byDueDate);
  paid.sort((a, b) => byDueDate(b, a));
  return { overdue, upcoming, paid };
}

export interface PeriodSummary {
  /** « Reste à payer » : TOUTES les échéances non payées de la période (celles déjà en retard comprises). */
  remaining: AmountTotal;
  /** Parmi elles, celles qui ne sont pas encore en retard. */
  upcomingCount: number;
  /** Parmi elles, celles en retard. */
  overdueInPeriodCount: number;
  /** Échéances en retard issues de périodes PRÉCÉDENTES : comptées à part, jamais ajoutées au reste à payer (aucun double compte). */
  carriedOver: AmountTotal;
  /** Échéances en retard au total (période affichée + périodes précédentes + périodes suivantes). */
  overdueCount: number;
}

/** Totaux du mois `month` (`YYYY-MM`). Une échéance n'est comptée qu'une fois : dans `remaining` (son mois) ou dans `carriedOver` (un mois antérieur et en retard). */
export function summarizePeriod(occurrences: readonly OccurrenceLike[], month: string, today: string): PeriodSummary {
  const inPeriod: OccurrenceLike[] = [];
  const carried: OccurrenceLike[] = [];
  let overdueCount = 0;
  for (const occurrence of occurrences) {
    if (occurrence.paidOn !== null) continue;
    const late = occurrence.dueOn < today;
    if (late) overdueCount += 1;
    const dueMonth = occurrence.dueOn.slice(0, 7);
    if (dueMonth === month) inPeriod.push(occurrence);
    else if (late && dueMonth < month) carried.push(occurrence);
  }
  const overdueInPeriodCount = inPeriod.filter((occurrence) => occurrence.dueOn < today).length;
  return {
    remaining: totalOf(inPeriod),
    upcomingCount: inPeriod.length - overdueInPeriodCount,
    overdueInPeriodCount,
    carriedOver: totalOf(carried),
    overdueCount,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Nom nettoyé : espaces superflus retirés. */
export function cleanBillName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export type BillNameProblem = 'empty' | 'too-long';

export function validateBillName(name: string): BillNameProblem | null {
  const cleaned = cleanBillName(name);
  if (cleaned === '') return 'empty';
  return cleaned.length > MAX_BILL_NAME_LENGTH ? 'too-long' : null;
}

/** Note nettoyée (`null` si vide). */
export function cleanBillNote(note: string | null | undefined): string | null {
  const cleaned = (note ?? '').trim();
  return cleaned === '' ? null : cleaned;
}

/** Un montant (prévu ou payé) : `null` = inconnu ; sinon un entier de centimes strictement positif, dans la limite. */
export function isValidBillAmount(cents: number | null): boolean {
  return cents === null || (Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_BILL_AMOUNT_CENTS);
}

export type PaymentProblem = 'date' | 'future' | 'amount';

/**
 * Paiement déclaré : une date qui existe, pas dans le futur (on déclare ce qui est fait), et un montant inconnu (`null`) ou valide.
 * Le montant payé peut différer du montant prévu.
 */
export function validatePayment(paidOn: string, amountCents: number | null, today: string): PaymentProblem | null {
  if (!isValidDate(paidOn)) return 'date';
  if (paidOn > today) return 'future';
  return isValidBillAmount(amountCents) ? null : 'amount';
}

export type DueDateProblem = 'invalid' | 'too-old';

/** Date de première échéance d'une NOUVELLE facture : une date qui existe, au plus un an dans le passé. */
export function validateNewDueDate(value: string, today: string): DueDateProblem | null {
  if (!isValidDate(value)) return 'invalid';
  return daysBetween(value, today) > MAX_PAST_CREATION_DAYS ? 'too-old' : null;
}
