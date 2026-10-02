// The dashboard's reporting period: `from` and `to` (YYYY-MM-DD, inclusive). Without them
// the period is the current calendar quarter so far.

export interface Period {
  from: string;
  to: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/** The longest period the dashboard charts, in months. */
export const MAX_PERIOD_MONTHS = 36;

const isDay = (value: string) =>
  DAY.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
const dayOf = (epochMs: number) => new Date(epochMs).toISOString().slice(0, 10);
const epochOf = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** The period a query asks for; null when it is malformed, reversed or too long. */
export function parsePeriod(query: URLSearchParams, now = new Date()): Period | null {
  const from = query.get("from");
  const to = query.get("to");
  if (from === null && to === null) {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1)
    );
    return { from: dayOf(start.getTime()), to: dayOf(now.getTime()) };
  }
  if (!from || !to || !isDay(from) || !isDay(to) || from > to) return null;
  return monthsOf({ from, to }).length > MAX_PERIOD_MONTHS ? null : { from, to };
}

/** The period of the same length that ends the day before this one starts. */
export function previousPeriod({ from, to }: Period): Period {
  const days = (epochOf(to) - epochOf(from)) / DAY_MS + 1;
  const end = epochOf(from) - DAY_MS;
  return { from: dayOf(end - (days - 1) * DAY_MS), to: dayOf(end) };
}

/** Every calendar month the period touches, as YYYY-MM. */
export function monthsOf({ from, to }: Period): string[] {
  const months: string[] = [];
  let [year, month] = from.slice(0, 7).split("-").map(Number);
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= last || months.length > MAX_PERIOD_MONTHS) return months;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

/** True when a date or timestamp falls on a day inside the period. */
export const inPeriod = ({ from, to }: Period, value: string) => {
  const day = value.slice(0, 10);
  return day >= from && day <= to;
};
