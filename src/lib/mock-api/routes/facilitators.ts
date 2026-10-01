import { hasPermission } from "../../auth/permissions";
import { type MockContext } from "../context";
import { envelope, rowsFor, visible, type Row } from "../core";
import { isStaffCounsellor } from "../resources/counselling-writes";

const titleType = (type: unknown) => {
  const text = String(type ?? "other");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * People a pillar form can pick, names only: active staff and providers a session
 * logger can choose as facilitator (`facilitator_option`), active trainer providers
 * for a trainee placement (`trainer_option`), or active staff and external
 * counsellors for a counselling session (`counsellor_option`).
 */
export function handleFacilitatorOptions(ctx: MockContext) {
  const { request, store, query, parts, grants } = ctx;
  const view = query.get("table");
  if (
    request.method !== "GET" ||
    parts[0] !== "pillars" ||
    (view !== "facilitator_option" && view !== "trainer_option" && view !== "counsellor_option")
  )
    return undefined;
  const pillar = store.pillar.find(
    (row) =>
      !row.is_deleted &&
      (row.code.toLowerCase() === parts[1]?.toLowerCase() || String(row.id) === parts[1])
  );
  if (!pillar) return envelope(404);
  const permission = {
    facilitator_option: "ACTIVITY_SESSION_LOG",
    trainer_option: "TRAINING_ENROLLMENT_EDIT",
    counsellor_option: "COUNSELLING_LOG",
  }[view];
  const counsellorsOnly = view === "counsellor_option";
  if (!hasPermission(grants, permission, { pillarId: pillar.id })) return envelope(403);
  const active = (row: Row) => visible(row) && row.status === "ACTIVE";
  const trainersOnly = view === "trainer_option";
  const institutions = rowsFor(store, "partner_institution");
  const items = [
    ...rowsFor(store, "user")
      .filter(
        (row) =>
          !trainersOnly && active(row) && (!counsellorsOnly || isStaffCounsellor(store, row.id))
      )
      .map((user) => ({
        kind: "staff" as const,
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        detail: "CREAW staff",
      })),
    ...rowsFor(store, "external_provider")
      .filter(
        (row) =>
          active(row) &&
          (!trainersOnly || row.provider_type === "trainer") &&
          (!counsellorsOnly || row.provider_type === "counsellor")
      )
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
