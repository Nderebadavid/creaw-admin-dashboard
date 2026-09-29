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
