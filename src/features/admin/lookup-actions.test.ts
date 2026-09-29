import { beforeEach, describe, expect, it, vi } from "vitest";
const actor = vi.hoisted(() => ({ id: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: actor.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session-server", () => ({ requireSession: async () => ({ user: { id: actor.id }, grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(actor.id) }) }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { createLookupAction, exportLookupAction, setLookupActiveAction, updateLookupAction } from "./lookup-actions";
import { createAdminApi } from "./api";
import { createPortalApiClient } from "@/lib/api/portal-client";

beforeEach(() => { resetMockStore(); actor.id = 1; actor.token = issueMockToken(1); });

describe("lookup administration", () => {
  it("rejects unknown table routes and case-insensitive duplicate names", async () => {
    expect((await handleMockRequest({ method: "GET", path: "/lookups/user", routeTemplate: "/lookups/:table", token: actor.token, correlationId: "test" })).resultCode).toBe(404);
    const donor = getMockStore().donor[0];
    expect((await createLookupAction({ table: "donor", values: { name: donor.name.toUpperCase() } })).resultCode).toBe(422);
    expect((await createLookupAction({ table: "user", values: { name: "No" } })).resultCode).toBe(404);
  });

  it("scopes geographic children to their parent and preserves soft removed rows", async () => {
    const [countyA, countyB] = getMockStore().county;
    const created = await createLookupAction({ table: "sub_county", values: { name: "New district", county_id: countyA.id } });
    expect(created.resultCode).toBe(201);
    const id = created.data!.id;
    expect((await createLookupAction({ table: "sub_county", values: { name: "New district", county_id: countyB.id } })).resultCode).toBe(201);
    const api = createAdminApi(createPortalApiClient(), actor.token);
    const children = await api.lookupList("sub_county", { parentId: countyA.id });
    expect(children.items.some(row => row.id === id)).toBe(true);
    expect(children.items.every(row => row.county_id === countyA.id)).toBe(true);
    expect((await setLookupActiveAction({ table: "sub_county", id, active: false })).resultCode).toBe(200);
    expect(getMockStore().sub_county.find(row => row.id === id)).toMatchObject({ is_deleted: true, status: "INACTIVE" });
    expect((await setLookupActiveAction({ table: "sub_county", id, active: true })).resultCode).toBe(200);
    expect(getMockStore().sub_county.filter(row => row.id === id)).toHaveLength(1);
  });

  it("rejects cross-parent edits and scoped admin grants", async () => {
    const ward = getMockStore().ward[0];
    expect((await updateLookupAction({ table: "ward", id: ward.id, values: { name: "Renamed", sub_county_id: getMockStore().sub_county[1].id } })).resultCode).toBe(422);
    actor.id = 3; actor.token = issueMockToken(3);
    expect((await createLookupAction({ table: "donor", values: { name: "Forged" } })).resultCode).toBe(403);
  });

  it("does not deactivate a parent with active geographic children", async () => {
    const county = getMockStore().county.find(row => getMockStore().sub_county.some(child => child.county_id === row.id && !child.is_deleted))!;
    expect((await setLookupActiveAction({ table: "county", id: county.id, active: false })).resultCode).toBe(422);
    expect(county.is_deleted).toBe(false);
  });

  it("does not restore dormant grants beyond the lookup manager's own grants", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    store.role.push({ ...store.role[2], id: 100, code: "LOOKUP_OPERATOR", is_system_role: false });
    store.role_permission.push({ ...store.role_permission[0], id: 10000, role_id: 100, permission_id: store.permission.find(row => row.code === "LOOKUP_MANAGE")!.id });
    store.user_role.push({ ...store.user_role[0], id: 10000, role_id: 100, user_id: 13, pillar_id: null });
    const pillar = store.pillar.find(row => row.id === 4)!;
    pillar.is_deleted = true; pillar.status = "INACTIVE";
    store.user_role.push({ ...store.user_role[0], id: 10001, role_id: 1, user_id: 4, pillar_id: 4 });
    actor.id = 13; actor.token = issueMockToken(13);
    expect((await setLookupActiveAction({ table: "pillar", id: pillar.id, active: true })).resultCode).toBe(403);
    expect(pillar.is_deleted).toBe(true);
  });

  it("supports a precise audit history link for a lookup row", async () => {
    const created = await createLookupAction({ table: "donor", values: { name: "History example" } });
    const response = await handleMockRequest({ method: "GET", path: "/audit-logs", routeTemplate: "/audit-logs", token: actor.token, correlationId: "history", query: { module: "donor", targetId: created.data!.id } });
    expect(response.resultCode).toBe(200);
    expect((response.data as { items: { entity_type: string; entity_id: number }[] }).items).toEqual(expect.arrayContaining([expect.objectContaining({ entity_type: "donor", entity_id: created.data!.id })]));
  });

  it("keeps pillar route codes stable when an entry is edited", async () => {
    const pillar = getMockStore().pillar[0];
    expect((await updateLookupAction({ table: "pillar", id: pillar.id, values: { code: "CHANGED" } })).resultCode).toBe(422);
    expect(pillar.code).toBe("VAWG");
  });

  it("preserves unchanged inactive lookup references but rejects new assignments", async () => {
    const store = getMockStore();
    const legalCase = store.legal_case[0];
    const historical = legalCase.case_type_id;
    const replacement = store.case_type.find(row => row.id !== historical)!;
    expect((await setLookupActiveAction({ table: "case_type", id: historical, active: false })).resultCode).toBe(200);
    const path = "/pillars/vawg";
    const request = (body: Record<string, unknown>) => handleMockRequest({ method: "PATCH", path, routeTemplate: "/pillars/:pillar", token: actor.token, correlationId: "historical-lookup", query: { table: "legal_case", id: legalCase.id }, body });
    expect((await request({ outcome_notes: "Reviewed after deactivation" })).resultCode).toBe(200);
    expect((await request({ case_type_id: replacement.id })).resultCode).toBe(200);
    expect((await request({ case_type_id: historical })).resultCode).toBe(422);
  });

  it("exports only selected rows at the current geographic level and audits the export", async () => {
    const store = getMockStore();
    const first = store.sub_county[0];
    const second = store.sub_county.find(row => row.county_id !== first.county_id)!;
    const exportResult = await exportLookupAction({ table: "sub_county", parentId: first.county_id, ids: [first.id, second.id] });
    expect(exportResult.success).toBe(true);
    if (!exportResult.success) return;
    expect(exportResult.content).toContain(`"${first.name}"`);
    expect(exportResult.content).not.toContain(`"${second.name}"`);
    expect(store.audit_logs.at(-1)).toMatchObject({ action: "EXPORT", entity_type: "sub_county" });
    const filtered = await exportLookupAction({ table: "donor", ids: [store.donor[0].id] });
    expect(filtered.success).toBe(true);
    if (filtered.success) expect(filtered.content).not.toContain(store.donor[1]?.name ?? "impossible value");
  });

  it("requires both lookup management and CSV export grants", async () => {
    actor.id = 3; actor.token = issueMockToken(3);
    expect((await exportLookupAction({ table: "donor", ids: [] })).success).toBe(false);
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    store.role.push({ ...store.role[2], id: 111, code: "LOOKUP_ONLY", is_system_role: false });
    store.role_permission.push({ ...store.role_permission[0], id: 11111, role_id: 111, permission_id: store.permission.find(row => row.code === "LOOKUP_MANAGE")!.id });
    store.user_role.push({ ...store.user_role[0], id: 11111, role_id: 111, user_id: 13, pillar_id: null });
    actor.id = 13; actor.token = issueMockToken(13);
    expect((await exportLookupAction({ table: "donor", ids: [] })).success).toBe(false);
    const direct = await handleMockRequest({ method: "GET", path: "/lookups/donor", routeTemplate: "/lookups/:table", token: actor.token, correlationId: "export-bypass", query: { format: "csv", includeDeleted: true, ids: String(store.donor[0].id) } });
    expect(direct.resultCode).toBe(403);
  });
});
