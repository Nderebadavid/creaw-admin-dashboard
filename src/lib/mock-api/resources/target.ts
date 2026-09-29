import { type MockContext, type ResourceTarget } from "../context";
import { envelope, lookups, relatedTables, routeTables, rowsFor, scopes, visible } from "../core";
import { type ApiEnvelope } from "@/types/api";
import { type TableName } from "@/types/db";

/** Maps a generic resource route to its table and (optional) existing row, or an error envelope. */
export function resolveTarget(ctx: MockContext): ApiEnvelope<unknown> | ResourceTarget {
  const { request, store, query, parts } = ctx;
  const family = parts[0] === "admin" ? parts.slice(0, 2).join("/") : parts[0];
  const pillar =
    family === "pillars"
      ? store.pillar.find(
          (row) =>
            !row.is_deleted &&
            (row.code.toLowerCase() === parts[1].toLowerCase() || String(row.id) === parts[1])
        )
      : undefined;
  if (family === "pillars" && !pillar) return envelope(404);
  let table =
    family === "lookups"
      ? lookups.find((name) => name === parts[1])
      : family === "pillars"
        ? ("enrollment" as TableName)
        : routeTables[family];
  if (!table) return envelope(404);
  if (query.has("table")) {
    const selected = query.get("table") as TableName;
    if (!relatedTables[family]?.includes(selected)) return envelope(422);
    table = selected;
  }
  const idText =
    family === "lookups" || parts[0] === "admin"
      ? parts[2]
      : family === "pillars"
        ? (query.get("id") ?? undefined)
        : parts[1];
  if (idText !== undefined && (!/^\d+$/.test(idText) || Number(idText) < 1)) return envelope(404);
  const id = idText ? Number(idText) : undefined;
  const rows = rowsFor(store, table);
  const existing =
    id === undefined
      ? undefined
      : rows.find(
          (row) =>
            row.id === id &&
            (visible(row) ||
              table === "user_role" ||
              table === "role_permission" ||
              (family === "lookups" && request.method === "PATCH"))
        );
  if (id !== undefined && !existing) return envelope(404);
  if (pillar && existing && !scopes(store, table, existing).includes(pillar.id))
    return envelope(404);
  return { family, pillar, table, id, rows, existing };
}
