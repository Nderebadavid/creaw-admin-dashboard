/** Inclusive range of `YYYY-MM-DD` calendar days. */
export interface DateRange {
  from: string;
  to: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The longest period the dashboard charts: 36 months. */
export const MAX_PERIOD_DAYS = 3 * 366;

/** Local calendar day as `YYYY-MM-DD` (toISOString would shift to UTC). */
export function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The current quarter so far, e.g. 1 Jul → today. */
export function defaultRange(today: Date): DateRange {
  const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
  return { from: isoDay(quarterStart), to: isoDay(today) };
}

/**
 * The dashboard's period from its `from` and `to` URL parameters, or the current quarter
 * so far when they are missing, malformed, reversed or longer than the API charts.
 */
export function periodFromParams(from: unknown, to: unknown, today = new Date()): DateRange {
  if (typeof from !== "string" || typeof to !== "string") return defaultRange(today);
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5 + 1;
  return DAY.test(from) && DAY.test(to) && span >= 1 && span <= MAX_PERIOD_DAYS
    ? { from, to }
    : defaultRange(today);
}
