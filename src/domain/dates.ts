import { INTL_LOCALES, type AppLocale } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const pad = (n: number, length = 2) => String(n).padStart(length, '0');

/**
 * Date locale au format `YYYY-MM-DD`.
 * Volontairement pas `toISOString()` : il renvoie la date UTC, donc la veille ou le lendemain
 * selon l'heure (ex. 00h30 à Paris = 23h30 la veille en UTC).
 */
export function toISODate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Mois d'une date au format `YYYY-MM`. */
export function monthKey(date: Date): string {
  return toISODate(date).slice(0, 7);
}

export function isMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

/** Convertit `YYYY-MM-DD` en Date locale (midi, pour éviter tout décalage lié à l'heure d'été). Null si invalide. */
export function parseISODate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day, 12);
  // `new Date(2025, 1, 31)` « déborde » sur mars : on refuse les dates qui n'existent pas.
  const exists = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return exists ? date : null;
}

/** Mois (`YYYY-MM`) auquel appartient une date `YYYY-MM-DD`. Null si la date est invalide. */
export function monthOfISODate(value: string): string | null {
  return parseISODate(value) ? value.slice(0, 7) : null;
}

/** Décale une date `YYYY-MM-DD` de `days` jours (négatif = passé). Null si la date de départ est invalide. */
export function shiftISODate(value: string, days: number): string | null {
  const date = parseISODate(value);
  if (!date) return null;
  date.setDate(date.getDate() + days); // `setDate` gère les fins de mois et d'année
  return toISODate(date);
}

/** Mois localisé avec majuscule initiale, ex. « Mars 2026 » / « Март 2026 г. ». Renvoie la valeur brute si le mois est invalide. */
export function formatMonthLabel(month: string, locale: AppLocale): string {
  if (!isMonthKey(month)) return month;
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1, 12);
  const label = new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toLocaleUpperCase(INTL_LOCALES[locale]) + label.slice(1);
}

/** Date longue localisée, ex. « mardi 17 mars 2026 ». Renvoie la valeur brute si elle est invalide. */
export function formatLongDate(value: string, locale: AppLocale): string {
  const date = parseISODate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Date courte localisée, ex. « 12 mars » / « 12 мар. ». Renvoie la valeur brute si elle est invalide. */
export function formatShortDate(value: string, locale: AppLocale): string {
  const date = parseISODate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short' }).format(date);
}

/** Jour et mois en toutes lettres, sans année, ex. « 5 mars » / « 5 марта ». Renvoie la valeur brute si la date est invalide. */
export function formatDayMonth(value: string, locale: AppLocale): string {
  const date = parseISODate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'long' }).format(date);
}

/** Date courte avec l'année, ex. « 12 nov. 2026 » / « 12 нояб. 2026 г. ». Renvoie la valeur brute si la date est invalide. */
export function formatDateWithYear(value: string, locale: AppLocale): string {
  const date = parseISODate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

/** Mois décalé de `delta` mois (négatif = passé) : `shiftMonth('2026-01', -1)` → `'2025-12'`. Lève une erreur si le mois est invalide. */
export function shiftMonth(month: string, delta: number): string {
  if (!isMonthKey(month)) throw new RangeError(`Mois invalide (format YYYY-MM attendu) : ${month}`);
  const index = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

/** Les `count` derniers mois jusqu'à `month` inclus, du plus récent au plus ancien. */
export function recentMonths(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, -i));
}

/** Nombre de jours d'un mois (28 à 31, février bissextile compris). */
export function daysInMonth(month: string): number {
  if (!isMonthKey(month)) throw new RangeError(`Mois invalide (format YYYY-MM attendu) : ${month}`);
  return new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
}

/** Nom du mois seul en minuscules, ex. « octobre » / « октябрь ». */
export function formatMonthName(month: string, locale: AppLocale): string {
  if (!isMonthKey(month)) return month;
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1, 12);
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: 'long' }).format(date);
}

/** Période d'un mois entier, ex. « 1er – 31 octobre 2026 » / « 1 – 31 октября 2026 г. ». */
export function formatMonthRange(month: string, locale: AppLocale): string {
  if (!isMonthKey(month)) return month;
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const last = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex, daysInMonth(month), 12),
  );
  // Le français écrit « 1er » ; les autres langues gardent le chiffre.
  return `${locale === 'fr' ? '1er' : '1'} – ${last}`;
}

/** Jour de la semaine en toutes lettres avec majuscule, ex. « Mercredi » / « Среда ». Valeur brute si la date est invalide. */
export function formatWeekday(value: string, locale: AppLocale): string {
  const date = parseISODate(value);
  if (!date) return value;
  const label = new Intl.DateTimeFormat(INTL_LOCALES[locale], { weekday: 'long' }).format(date);
  return label.charAt(0).toLocaleUpperCase(INTL_LOCALES[locale]) + label.slice(1);
}

/** Nom du mois abrégé, ex. « oct. » / « окт. » (étiquettes de graphique). */
export function formatMonthShort(month: string, locale: AppLocale): string {
  if (!isMonthKey(month)) return month;
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1, 12);
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: 'short' }).format(date);
}
