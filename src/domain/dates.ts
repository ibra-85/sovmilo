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

/** Date courte localisée, ex. « 12 mars » / « 12 мар. ». Renvoie la valeur brute si elle est invalide. */
export function formatShortDate(value: string, locale: AppLocale): string {
  const date = parseISODate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short' }).format(date);
}
