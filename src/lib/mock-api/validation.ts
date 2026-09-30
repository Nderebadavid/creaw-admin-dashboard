import { rowsFor, type Row, visible } from "./core";
import { tableDefinitions } from "./schema";
import { uniqueKeys } from "./unique-keys";
import { type MockStore, type TableName } from "@/types/db";

// Schema-level validation of a candidate row before it is stored.
export function validate(store: MockStore, table: TableName, row: Row, previous?: Row): boolean {
  const definition = tableDefinitions[table];
  if (Object.keys(row).some((key) => !Object.hasOwn(definition, key))) return false;
  for (const [key, column] of Object.entries(definition)) {
    const value = row[key];
    if (value === null && column.nullable) continue;
    if (value === undefined || value === null) return false;
    if (column.kind !== "json" && typeof value !== column.kind) return false;
    if (
      typeof value === "number" &&
      (!Number.isFinite(value) ||
        (column.integer && !Number.isInteger(value)) ||
        (column.unsigned && value < 0))
    )
      return false;
    if (
      typeof value === "string" &&
      ((column.maxLength && value.length > column.maxLength) ||
        (!column.nullable && value.trim() === "" && !["notes", "password_hash"].includes(key)))
    )
      return false;
    if (column.values && !column.values.includes(String(value))) return false;
    if (
      column.date &&
      (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}/.test(value) ||
        Number.isNaN(Date.parse(value)))
    )
      return false;
    // A foreign key must point at a live parent, except that an update may keep
    // an unchanged link to a parent deactivated since (e.g. a removed stage on
    // an old submission) so historical records stay editable.
    if (
      column.references &&
      !rowsFor(store, column.references).some(
        (parent) =>
          parent.id === value &&
          (previous?.[key] === value ||
            (visible(parent) && !["INACTIVE", "DISABLED"].includes(String(parent.status))))
      )
    )
      return false;
  }
  if (
    (table === "enrollment" || table === "grant_application") &&
    Boolean(row.participant_id) === Boolean(row.organisation_id)
  )
    return false;
  if (
    table === "activity_session" &&
    Boolean(row.facilitator_user_id) === Boolean(row.facilitator_provider_id)
  )
    return false;
  if (table === "document") {
    if (
      typeof row.owner_type !== "string" ||
      !Object.hasOwn(tableDefinitions, row.owner_type) ||
      row.owner_type === "document"
    )
      return false;
    if (
      !rowsFor(store, row.owner_type as TableName).some(
        (owner) => owner.id === row.owner_id && visible(owner)
      )
    )
      return false;
  }
  if (table === "referral") {
    const enrollment = store.enrollment.find((item) => item.id === row.enrollment_id);
    if (
      enrollment?.pillar_id !== row.from_pillar_id ||
      Boolean(row.to_project_id) === Boolean(row.to_partner_institution_id)
    )
      return false;
    if (
      row.to_project_id &&
      store.project.find((item) => item.id === row.to_project_id)?.pillar_id !== row.to_pillar_id
    )
      return false;
  }
  if (table === "participant_stage_event") {
    const enrollment = store.enrollment.find((item) => item.id === row.enrollment_id);
    const stage = store.stage_definition.find((item) => item.id === row.stage_definition_id);
    if (
      store.pipeline_definition.find((item) => item.id === stage?.pipeline_id)?.pillar_id !==
      enrollment?.pillar_id
    )
      return false;
  }
  for (const keys of uniqueKeys[table] ?? []) {
    if (keys.some((key) => row[key] === null)) continue;
    if (
      rowsFor(store, table).some(
        (other) =>
          other.id !== row.id &&
          keys.every((key) =>
            typeof row[key] === "string"
              ? String(other[key]).toLowerCase() === String(row[key]).toLowerCase()
              : other[key] === row[key]
          )
      )
    )
      return false;
  }
  return true;
}
