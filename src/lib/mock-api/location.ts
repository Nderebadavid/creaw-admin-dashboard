import type { MockStore, TableName } from "@/types/db";
import type { Row } from "./core";

// Location filters: `countyId`, `subCountyId` and `wardId` narrow a list (or the dashboard)
// to records whose person or organisation lives there. A record's place is the ward of
// the participant or organisation it belongs to, followed through its enrollment.

export const LOCATION_KEYS = ["countyId", "subCountyId", "wardId"] as const;
export type LocationFilter = Partial<Record<(typeof LOCATION_KEYS)[number], number>>;

/** Tables that carry an `enrollment_id` and so take the enrolled person's place. */
const ENROLLED: TableName[] = [
  "referral",
  "participant_stage_event",
  "legal_case",
  "counselling_session",
  "training_enrollment",
];

/** Tables a location filter applies to. */
export const LOCATED_TABLES: TableName[] = [
  "participant",
  "organisation",
  "enrollment",
  "grant_application",
  "organisation_assessment",
  ...ENROLLED,
];

const wardOfParticipant = (store: MockStore, id: unknown) =>
  store.participant.find((row) => row.id === id)?.ward_id ?? null;
const wardOfOrganisation = (store: MockStore, id: unknown) =>
  store.organisation.find((row) => row.id === id)?.ward_id ?? null;

function wardOfEnrollment(store: MockStore, id: unknown) {
  const enrollment = store.enrollment.find((row) => row.id === id);
  if (!enrollment) return null;
  return enrollment.participant_id !== null
    ? wardOfParticipant(store, enrollment.participant_id)
    : wardOfOrganisation(store, enrollment.organisation_id);
}

/** The ward a record is located in, or null when it is not recorded. */
export function wardOf(store: MockStore, table: TableName, row: Row): number | null {
  if (table === "participant" || table === "organisation")
    return (row.ward_id as number | null) ?? null;
  if (table === "enrollment") return wardOfEnrollment(store, row.id);
  if (table === "grant_application")
    return row.participant_id
      ? wardOfParticipant(store, row.participant_id)
      : wardOfOrganisation(store, row.organisation_id);
  if (table === "organisation_assessment") return wardOfOrganisation(store, row.organisation_id);
  if (ENROLLED.includes(table)) return wardOfEnrollment(store, row.enrollment_id);
  return null;
}

/**
 * Reads the location keys from a query: undefined when none is given, null when one is
 * malformed (not a positive integer).
 */
export function parseLocation(query: URLSearchParams): LocationFilter | null | undefined {
  const filter: LocationFilter = {};
  for (const key of LOCATION_KEYS) {
    if (!query.has(key)) continue;
    const value = Number(query.get(key));
    if (!Number.isSafeInteger(value) || value < 1) return null;
    filter[key] = value;
  }
  return Object.keys(filter).length ? filter : undefined;
}

/** A predicate for "this record is in the filtered area"; records with no ward never match. */
export function inLocation(store: MockStore, filter: LocationFilter | undefined) {
  if (!filter) return () => true;
  return (table: TableName, row: Row) => {
    const wardId = wardOf(store, table, row);
    if (wardId === null) return false;
    if (filter.wardId !== undefined && wardId !== filter.wardId) return false;
    const ward = store.ward.find((item) => item.id === wardId);
    if (filter.subCountyId !== undefined && ward?.sub_county_id !== filter.subCountyId)
      return false;
    if (filter.countyId !== undefined) {
      const subCounty = store.sub_county.find((item) => item.id === ward?.sub_county_id);
      if (subCounty?.county_id !== filter.countyId) return false;
    }
    return true;
  };
}
