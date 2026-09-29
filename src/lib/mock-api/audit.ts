import { type ApiRequest } from "../api/transport";
import { isSensitiveField } from "../sensitive-fields";
import { type Row } from "./core";
import { makeRow } from "./rows";
import { type MockStore, type TableName } from "@/types/db";

// Audit-log helpers: redaction of sensitive values in stored and returned
// audit rows, and the writer used by every mutation.
export const secretMetadataKey =
  /(?:password|token|secret|credential|authorization|cookie|email|phone|contact|id_number|first_name|middle_name|last_name|salary|amount|notes?|payload|file_url|address|date_of_birth)/i;
export const safeAuditStringKey =
  /^(?:status|stage_event_status|code|module|action|source|entity_type|type|kind|role_code|permission_code)$/i;
export function redactAuditValue(table: string | null, value: unknown, field?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(table, item));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        secretMetadataKey.test(key) || (table && isSensitiveField(table, key))
          ? "[REDACTED]"
          : redactAuditValue(table, item, key),
      ])
    );
  if (typeof value === "string" && (!field || !safeAuditStringKey.test(field))) return "[REDACTED]";
  return value;
}
export function redactAuditText(table: string | null, text: string | null): string | null {
  if (!text) return text;
  try {
    return JSON.stringify(redactAuditValue(table, JSON.parse(text)));
  } catch {
    return "[REDACTED]";
  }
}
export function safeAuditRow(store: MockStore, row: MockStore["audit_logs"][number]) {
  const actor = store.user.find((user) => user.id === row.performed_by && !user.is_deleted);
  return {
    ...row,
    performed_by_name: actor ? `${actor.first_name} ${actor.last_name}` : null,
    input_payload: redactAuditText(row.entity_type, row.input_payload),
    previous_state: redactAuditText(row.entity_type, row.previous_state),
    new_state: redactAuditText(row.entity_type, row.new_state),
  };
}
export function auditWrite(
  store: MockStore,
  request: ApiRequest<unknown>,
  userId: number,
  table: TableName,
  before: Row | null,
  after: Row,
  action?: string
) {
  const now = new Date().toISOString();
  store.audit_logs.push(
    makeRow(
      "audit_logs",
      {
        entity_type: table,
        entity_id: after.id,
        action: action ?? (after.is_deleted ? "DELETE" : before ? "UPDATE" : "CREATE"),
        source: "HTTP",
        performed_by: userId,
        performed_at: now,
        endpoint: request.routeTemplate,
        input_payload: redactAuditText(table, JSON.stringify(request.body ?? {})),
        previous_state: before ? redactAuditText(table, JSON.stringify(before)) : null,
        new_state: redactAuditText(table, JSON.stringify(after)),
      },
      Math.max(0, ...store.audit_logs.map((row) => row.id)) + 1,
      now
    )
  );
}
