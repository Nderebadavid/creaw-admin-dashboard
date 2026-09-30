const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats an ISO timestamp or `YYYY-MM-DD` date as e.g. "27 Sept 2026".
 * Date-only values are read as local midnight so they never shift a day.
 */
export function formatDate(value: string): string {
  return new Date(dateOnly.test(value) ? `${value}T00:00:00` : value).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Fixed short month names, so every runtime renders the same text ("Sep", never "Sept"). */
export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** e.g. "7 Sep", for compact date leaves and activity rows. */
export function formatDayMonth(value: string): string {
  const date = new Date(dateOnly.test(value) ? `${value}T00:00:00` : value);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** Up to two upper-case initials for an avatar, e.g. "Faith Wanjiku" → "FW". */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** "PENDING_REVIEW" → "Pending review", for showing API status codes. */
export function titleCase(code: string): string {
  const words = code.replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
