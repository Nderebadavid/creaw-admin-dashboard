import { hasPermission } from "../../auth/permissions";
import { type MockContext } from "../context";
import { envelope, rowsFor, visible, type Row } from "../core";

const titleType = (type: unknown) => {
  const text = String(type ?? "other");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Active staff and providers a session logger can pick as facilitator: names only. */
export function handleFacilitatorOptions(ctx: MockContext) {
  const { request, store, query, parts, grants } = ctx;
  if (
    request.method !== "GET" ||
    parts[0] !== "pillars" ||
    query.get("table") !== "facilitator_option"
  )
    return undefined;
  const pillar = store.pillar.find(
    (row) =>
      !row.is_deleted &&
      (row.code.toLowerCase() === parts[1]?.toLowerCase() || String(row.id) === parts[1])
  );
  if (!pillar) return envelope(404);
  if (!hasPermission(grants, "ACTIVITY_SESSION_LOG", { pillarId: pillar.id })) return envelope(403);
  const active = (row: Row) => visible(row) && row.status === "ACTIVE";
  const institutions = rowsFor(store, "partner_institution");
  const items = [
    ...rowsFor(store, "user")
      .filter(active)
      .map((user) => ({
        kind: "staff" as const,
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        detail: "CREAW staff",
      })),
    ...rowsFor(store, "external_provider")
      .filter(active)
      .map((provider) => {
        const institution = institutions.find(
          (row) => row.id === provider.affiliated_institution_id
        );
        return {
          kind: "provider" as const,
          id: provider.id,
          name: `${provider.first_name} ${provider.last_name}`,
          detail: institution
            ? `${titleType(provider.provider_type)} · ${institution.name}`
            : titleType(provider.provider_type),
        };
      }),
  ];
  return envelope(200, {
    items,
    page: 1,
    pageSize: items.length || 1,
    totalItems: items.length,
    totalPages: 1,
  });
}
