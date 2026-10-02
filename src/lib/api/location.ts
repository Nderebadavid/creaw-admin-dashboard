/**
 * The location filter every people- and organisation-linked register shares: a county,
 * optionally narrowed to a sub-county and ward. The API takes the same keys as query
 * parameters and matches records through the ward of their participant or organisation.
 */
export interface LocationQuery {
  countyId?: number;
  subCountyId?: number;
  wardId?: number;
}

const LOCATION_KEYS = ["countyId", "subCountyId", "wardId"] as const;

const positiveId = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : undefined;

/** A location from the browser, kept only as positive integer ids. Server Action input is untrusted. */
export function cleanLocation(input: unknown): LocationQuery {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const clean: LocationQuery = {};
  for (const key of LOCATION_KEYS) {
    const id = positiveId(source[key]);
    if (id !== undefined) clean[key] = id;
  }
  return clean;
}

/** The location as API query parameters; unset levels are left out. */
export const locationParams = (query: LocationQuery): Record<string, number> =>
  cleanLocation(query) as Record<string, number>;

/** True when any level of the location is set. */
export const hasLocation = (query: LocationQuery) => Object.keys(cleanLocation(query)).length > 0;
