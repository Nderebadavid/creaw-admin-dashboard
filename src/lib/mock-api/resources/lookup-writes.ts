import { hasPermission } from "../../auth/permissions";
import { type ResourceContext } from "../context";
import { addsGrantsBeyondActor, envelope, rowsFor, type Row, visible } from "../core";
import { type ApiEnvelope } from "@/types/api";
import { type TableName } from "@/types/db";

/** Lookup-table write rules: writable columns, parent immutability and case-insensitive name uniqueness. */
export function checkLookupWrite(
  ctx: ResourceContext,
  body: Row
): ApiEnvelope<unknown> | undefined {
  if (ctx.family !== "lookups") return undefined;
  const { request, store, grants, table, rows, existing } = ctx;
  if (!hasPermission(grants, "LOOKUP_MANAGE")) return envelope(403);
  const writable: Partial<Record<TableName, string[]>> = {
    pillar: ["code", "name", "focus_description", "lead_user_id"],
    county: ["name"],
    sub_county: ["name", "county_id"],
    ward: ["name", "sub_county_id"],
    donor: ["name", "notes"],
    business_sector: ["name"],
    case_type: ["name", "pillar_id", "requires_p3_prc_forms", "default_route"],
    partner_institution: ["name", "institution_type", "county_id", "contact_details"],
    activity_type_definition: ["name", "pillar_id", "description"],
  };
  const keys = Object.keys(body),
    allowedKeys = writable[table] ?? [];
  if (
    !keys.length ||
    keys.some(
      (key) =>
        !allowedKeys.includes(key) &&
        !(request.method === "PATCH" && ["status", "is_deleted"].includes(key))
    )
  )
    return envelope(422);
  if (request.method === "PATCH" && existing) {
    if (table === "pillar" && "code" in body && body.code !== existing.code)
      return envelope(
        422,
        null,
        "Pillar code cannot change because it identifies routes and grants"
      );
    const relation =
      table === "sub_county"
        ? "county_id"
        : table === "ward"
          ? "sub_county_id"
          : table === "activity_type_definition" || table === "case_type"
            ? "pillar_id"
            : undefined;
    if (relation && relation in body && body[relation] !== existing[relation])
      return envelope(422, null, "Parent cannot be changed");
    if ("status" in body || "is_deleted" in body) {
      if (
        keys.some((key) => !["status", "is_deleted"].includes(key)) ||
        typeof body.is_deleted !== "boolean" ||
        !["ACTIVE", "INACTIVE"].includes(String(body.status)) ||
        (body.status === "ACTIVE") !== (body.is_deleted === false)
      )
        return envelope(422);
      if (body.status === "ACTIVE") {
        const relation =
          table === "sub_county"
            ? (["county", existing.county_id] as const)
            : table === "ward"
              ? (["sub_county", existing.sub_county_id] as const)
              : null;
        if (
          relation &&
          !rowsFor(store, relation[0]).some(
            (row) => row.id === relation[1] && visible(row) && row.status === "ACTIVE"
          )
        )
          return envelope(422, null, "Parent is inactive");
        if (table === "pillar" && (existing.is_deleted || existing.status !== "ACTIVE")) {
          const hypothetical = {
            ...store,
            pillar: store.pillar.map((row) =>
              row.id === existing.id ? { ...row, status: "ACTIVE", is_deleted: false } : row
            ),
          };
          if (
            store.user_role.some(
              (link) =>
                link.pillar_id === existing.id &&
                addsGrantsBeyondActor(store, hypothetical, link.user_id, grants)
            )
          )
            return envelope(403, null, "Pillar activation would restore grants beyond your access");
        }
      } else {
        if (
          (table === "county" &&
            store.sub_county.some(
              (row) => row.county_id === existing.id && !row.is_deleted && row.status === "ACTIVE"
            )) ||
          (table === "sub_county" &&
            store.ward.some(
              (row) =>
                row.sub_county_id === existing.id && !row.is_deleted && row.status === "ACTIVE"
            ))
        )
          return envelope(422, null, "Deactivate active geographic children first");
      }
    }
  }
  if (typeof body.name === "string") {
    const parentKey =
      table === "sub_county"
        ? "county_id"
        : table === "ward"
          ? "sub_county_id"
          : table === "activity_type_definition"
            ? "pillar_id"
            : null;
    const parentId = parentKey ? (body[parentKey] ?? existing?.[parentKey]) : null;
    if (
      rows.some(
        (row) =>
          row.id !== existing?.id &&
          row.name &&
          String(row.name).toLowerCase() === String(body.name).trim().toLowerCase() &&
          (!parentKey || row[parentKey] === parentId)
      )
    )
      return envelope(422, null, "Lookup name already exists");
  }
  return undefined;
}
