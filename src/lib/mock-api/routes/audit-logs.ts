import { hasPermission } from "../../auth/permissions";
import { safeAuditRow } from "../audit";
import { type MockContext } from "../context";
import { envelope } from "../core";
import { makeRow } from "../rows";
import { type ApiEnvelope } from "@/types/api";

/** `GET /audit-logs`: filtered, redacted audit trail. */
export function handleAuditLogs(ctx: MockContext): ApiEnvelope<unknown> | undefined {
  const { request, store, url, query, userId, grants } = ctx;
  if (url.pathname === "/audit-logs") {
    if (!hasPermission(grants, "AUDIT_LOG_VIEW")) return envelope(403);
    if (
      request.method !== "GET" ||
      [...query.keys()].some(
        (key) =>
          ![
            "id",
            "targetId",
            "page",
            "pageSize",
            "search",
            "source",
            "module",
            "action",
            "performed_by",
            "from",
            "to",
            "format",
            "sortBy",
            "sortOrder",
          ].includes(key)
      )
    )
      return envelope(422);
    const readInt = (key: string, defaultValue?: number) =>
      query.has(key) ? Number(query.get(key)) : defaultValue;
    const id = readInt("id"),
      targetId = readInt("targetId"),
      page = readInt("page", 1)!,
      pageSize = readInt("pageSize", 25)!,
      actorId = readInt("performed_by");
    if (
      [id, targetId, page, pageSize, actorId].some(
        (value) => value !== undefined && (!Number.isSafeInteger(value) || value < 1)
      ) ||
      pageSize > 100 ||
      (id && query.size !== 1)
    )
      return envelope(422);
    if (
      (query.has("source") && !["HTTP", "KAFKA"].includes(query.get("source")!)) ||
      (query.has("from") && !/^\d{4}-\d{2}-\d{2}$/.test(query.get("from")!)) ||
      (query.has("to") && !/^\d{4}-\d{2}-\d{2}$/.test(query.get("to")!)) ||
      (query.has("from") && query.has("to") && query.get("from")! > query.get("to")!) ||
      (query.has("sortBy") && !["id", "performed_at"].includes(query.get("sortBy")!)) ||
      (query.has("sortOrder") && !["asc", "desc"].includes(query.get("sortOrder")!))
    )
      return envelope(422);
    if (id) {
      const row = store.audit_logs.find((item) => item.id === id);
      return row ? envelope(200, safeAuditRow(store, row)) : envelope(404);
    }
    const search = query.get("search")?.toLowerCase();
    const filtered = store.audit_logs
      .map((row) => safeAuditRow(store, row))
      .filter(
        (row) =>
          (!query.get("source") || row.source === query.get("source")) &&
          (!query.get("module") || row.entity_type === query.get("module")) &&
          (targetId === undefined || row.entity_id === targetId) &&
          (!query.get("action") || row.action === query.get("action")) &&
          (actorId === undefined || row.performed_by === actorId) &&
          (!query.get("from") || row.performed_at.slice(0, 10) >= query.get("from")!) &&
          (!query.get("to") || row.performed_at.slice(0, 10) <= query.get("to")!) &&
          (!search ||
            `${row.entity_type ?? ""} ${row.entity_id ?? ""} ${row.action} ${row.performed_by_name ?? ""} ${row.endpoint ?? ""} ${row.event_name ?? ""}`
              .toLowerCase()
              .includes(search))
      )
      .sort(
        (a, b) =>
          (query.get("sortBy") === "id"
            ? a.id - b.id
            : a.performed_at.localeCompare(b.performed_at) || a.id - b.id) *
          (query.get("sortOrder") === "asc" ? 1 : -1)
      );
    if (query.has("format")) {
      if (query.get("format") !== "csv" || !hasPermission(grants, "REPORT_EXPORT_CSV"))
        return envelope(403);
      const columns = [
        "id",
        "entity_type",
        "entity_id",
        "action",
        "source",
        "performed_by",
        "performed_by_name",
        "performed_at",
        "endpoint",
        "event_name",
        "input_payload",
        "previous_state",
        "new_state",
      ] as const;
      const cell = (value: unknown) => {
        const text = String(value ?? "");
        return '"' + (/^[=+\-@\t\r\n]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"';
      };
      const content = [
        columns.join(","),
        ...filtered.map((row) => columns.map((column) => cell(row[column])).join(",")),
      ].join("\r\n");
      const now = new Date().toISOString();
      store.audit_logs.push(
        makeRow(
          "audit_logs",
          {
            entity_type: "audit_logs",
            action: "EXPORT",
            source: "HTTP",
            performed_by: userId,
            performed_at: now,
            endpoint: request.routeTemplate,
            input_payload: JSON.stringify({
              filters: Object.fromEntries([...query].filter(([key]) => key !== "format")),
              totalItems: filtered.length,
            }),
          },
          Math.max(0, ...store.audit_logs.map((row) => row.id)) + 1,
          now
        )
      );
      return envelope(200, { filename: "audit-log.csv", content, totalItems: filtered.length });
    }
    return envelope(200, {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    });
  }
  return undefined;
}
