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

/**
 * When a record last changed: "Just now", "5 minutes ago", "3 hours ago" or "2 days ago"
 * for the last week, then the date. `now` is injectable so the text is testable.
 */
export function formatUpdated(value: string, now: Date = new Date()): string {
  const time = Date.parse(dateOnly.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(time)) return "—";
  const seconds = Math.floor((now.getTime() - time) / 1000);
  // Dates in the future (clock drift between servers) read as the date, not "-2 hours ago".
  if (seconds < 0) return formatDate(value);
  const unit = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"} ago`;
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return unit(Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return unit(Math.floor(seconds / 3600), "hour");
  if (seconds < 7 * 86_400) return unit(Math.floor(seconds / 86_400), "day");
  return formatDate(value);
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
