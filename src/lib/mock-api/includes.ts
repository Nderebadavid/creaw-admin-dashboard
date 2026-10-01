import { allowed, permissionCodes, rowsFor, visible, type Row } from "./core";
import type { EffectiveGrant } from "../auth/permissions";
import type { MockStore, TableName } from "@/types/db";

// `include=` embeds a record's child collections in the same response, so a drawer
// or register needs one call instead of one per child table. `name:count` returns
// just the number. Children are filtered by the caller's own view permission and
// presented (masked and named) exactly as their own endpoint would return them.

interface IncludeSpec {
  table: TableName;
  children: (store: MockStore, row: Row) => Row[];
  /** Order of the embedded rows; defaults to id. */
  order?: (a: Row, b: Row) => number;
}

const childrenBy = (table: TableName, key: string, value: (row: Row) => unknown) => ({
  table,
  children: (store: MockStore, row: Row) =>
    rowsFor(store, table).filter((child) => child[key] === value(row)),
});
const documentsOf = (ownerType: TableName): IncludeSpec => ({
  table: "document",
  children: (store, row) =>
    rowsFor(store, "document").filter(
      (child) => child.owner_type === ownerType && child.owner_id === row.id
    ),
});
const awardIds = (store: MockStore, row: Row) =>
  store.grant_award.filter((award) => award.application_id === row.id).map((award) => award.id);

export const INCLUDES: Partial<Record<TableName, Record<string, IncludeSpec>>> = {
  pipeline_definition: {
    stages: {
      ...childrenBy("stage_definition", "pipeline_id", (row) => row.id),
      order: (a, b) => Number(a.step_no) - Number(b.step_no),
    },
  },
  activity_session: {
    attendees: childrenBy("activity_attendance", "session_id", (row) => row.id),
    documents: documentsOf("activity_session"),
  },
  legal_case: {
    documents: documentsOf("legal_case"),
    counselling: {
      ...childrenBy("counselling_session", "enrollment_id", (row) => row.enrollment_id),
      order: (a, b) => Number(a.session_no) - Number(b.session_no),
    },
  },
  enrollment: {
    counselling: {
      ...childrenBy("counselling_session", "enrollment_id", (row) => row.id),
      order: (a, b) => Number(a.session_no) - Number(b.session_no),
    },
    legal_cases: childrenBy("legal_case", "enrollment_id", (row) => row.id),
    training: childrenBy("training_enrollment", "enrollment_id", (row) => row.id),
  },
  grant_application: {
    awards: childrenBy("grant_award", "application_id", (row) => row.id),
    disbursements: {
      table: "grant_disbursement",
      children: (store, row) =>
        rowsFor(store, "grant_disbursement").filter((child) =>
          awardIds(store, row).includes(Number(child.grant_id))
        ),
    },
    reports: {
      table: "grant_report",
      children: (store, row) =>
        rowsFor(store, "grant_report").filter((child) =>
          awardIds(store, row).includes(Number(child.grant_award_id))
        ),
    },
    documents: documentsOf("grant_application"),
  },
  organisation_assessment: {
    scores: childrenBy("organisation_assessment_score", "assessment_id", (row) => row.id),
    checks: childrenBy("assessment_document_check", "assessment_id", (row) => row.id),
    documents: documentsOf("organisation_assessment"),
  },
  participant: {
    enrollments: childrenBy("enrollment", "participant_id", (row) => row.id),
  },
  participant_stage_event: { documents: documentsOf("participant_stage_event") },
  role: { permissions: childrenBy("role_permission", "role_id", (row) => row.id) },
  user: { roles: childrenBy("user_role", "user_id", (row) => row.id) },
};

export interface IncludeRequest {
  name: string;
  count: boolean;
}

/** Parses `include=a,b:count`; null when it names something the table does not offer. */
export function parseIncludes(table: TableName, text: string | null): IncludeRequest[] | null {
  if (!text) return [];
  const requests = text.split(",").map((part) => {
    const [name, mode] = part.trim().split(":");
    return { name, count: mode === "count", valid: mode === undefined || mode === "count" };
  });
  if (requests.some((item) => !item.valid || !INCLUDES[table]?.[item.name])) return null;
  return requests.map(({ name, count }) => ({ name, count }));
}

/** The row with each requested child collection (or its count) embedded. */
export function withIncludes(
  store: MockStore,
  grants: EffectiveGrant[],
  table: TableName,
  row: Row,
  requests: IncludeRequest[],
  present: (table: TableName, row: Row) => Row
): Row {
  if (!requests.length) return row;
  const result: Row = { ...row };
  for (const { name, count } of requests) {
    const spec = INCLUDES[table]![name];
    const permission = permissionCodes[spec.table]?.[0] ?? "DASHBOARD_VIEW";
    const children = spec
      .children(store, row)
      .filter((child) => visible(child) && allowed(store, grants, permission, spec.table, child))
      .sort(spec.order ?? ((a, b) => a.id - b.id));
    if (count) result[`${name}_count`] = children.length;
    else result[name] = children.map((child) => present(spec.table, child));
  }
  return result;
}
