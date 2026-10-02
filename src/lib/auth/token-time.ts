// The auth API sends token expiry as "YYYY-MM-DD HH:mm:ss" with no offset. Those times
// are read in PORTAL_API_UTC_OFFSET (default East Africa Time, which has no daylight
// saving). Timestamps that carry their own offset or a trailing Z are read as written.

const OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;
const NAIVE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** The API clock's offset from UTC, in minutes. */
function apiOffsetMinutes(): number {
  const match = OFFSET_PATTERN.exec(process.env.PORTAL_API_UTC_OFFSET ?? "+03:00");
  if (!match) throw new Error("Invalid PORTAL_API_UTC_OFFSET; expected ±HH:MM");
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** Epoch milliseconds for an API timestamp, or null when it cannot be read. */
export function parseApiTime(value: string): number | null {
  if (NAIVE_PATTERN.test(value)) {
    const asUtc = Date.parse(`${value.replace(" ", "T")}Z`);
    return Number.isNaN(asUtc) ? null : asUtc - apiOffsetMinutes() * 60_000;
  }
  // Only full ISO-8601 date-times with an explicit zone; anything else is ambiguous.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value))
    return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Epoch milliseconds as the API writes them: "YYYY-MM-DD HH:mm:ss" on the API clock. */
export function formatApiTime(epochMs: number): string {
  return new Date(epochMs + apiOffsetMinutes() * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}
