import { rowsFor, type Row } from "./core";
import { tableDefinitions } from "./schema";
import type { MockStore, TableName } from "@/types/db";

// Reference names: every row carries the display name of each record it links to,
// as `<link>_name` beside `<link>_id`, so clients never download a table just to
// show names. Names come from the linked row even when it is retired, so history
// stays readable. Contacts and other fields of the linked row are never copied.

const personTables: TableName[] = ["participant", "user", "external_provider"];

const personName = (row: Row) =>
  [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ") || null;

/** The display name of one row of a table, or null when the table has no name. */
export function displayName(store: MockStore, table: TableName, id: unknown): string | null {
  if (id === null || id === undefined) return null;
  const row = rowsFor(store, table).find((item) => item.id === id);
  if (!row) return null;
  if (personTables.includes(table)) return personName(row);
  if (table === "enrollment")
    return row.participant_id
      ? displayName(store, "participant", row.participant_id)
      : displayName(store, "organisation", row.organisation_id);
  return typeof row.name === "string" ? row.name : null;
}

const nameable = (table: TableName) =>
  personTables.includes(table) ||
  table === "enrollment" ||
  Object.hasOwn(tableDefinitions[table], "name");

/** `<link>_name` columns a table's rows carry, one per nameable foreign key. */
export function referenceNameColumns(table: TableName): string[] {
  const columns = Object.entries(tableDefinitions[table])
    .filter(
      ([column, definition]) =>
        definition.references && column.endsWith("_id") && nameable(definition.references)
    )
    .map(([column]) => column.replace(/_id$/, "_name"));
  // Records hung off an enrollment also name the person or organisation enrolled.
  if (Object.hasOwn(tableDefinitions[table], "enrollment_id"))
    columns.push("participant_id", "participant_name", "organisation_id", "organisation_name");
  return [...new Set(columns)];
}

/** The reference names for one row; existing keys on the row are left alone. */
export function withReferenceNames(store: MockStore, table: TableName, row: Row): Row {
  const extra: Row = { id: row.id };
  for (const [column, definition] of Object.entries(tableDefinitions[table])) {
    if (!definition.references || !column.endsWith("_id") || !nameable(definition.references))
      continue;
    const key = column.replace(/_id$/, "_name");
    if (!(key in row)) extra[key] = displayName(store, definition.references, row[column]);
  }
  if ("enrollment_id" in row) {
    const enrollment = store.enrollment.find((item) => item.id === row.enrollment_id);
    const participantId = enrollment?.participant_id ?? null;
    const organisationId = enrollment?.organisation_id ?? null;
    if (!("participant_id" in row)) extra.participant_id = participantId;
    if (!("participant_name" in row))
      extra.participant_name = displayName(store, "participant", participantId);
    if (!("organisation_id" in row)) extra.organisation_id = organisationId;
    if (!("organisation_name" in row))
      extra.organisation_name = displayName(store, "organisation", organisationId);
  }
  return { ...extra, ...row };
}
