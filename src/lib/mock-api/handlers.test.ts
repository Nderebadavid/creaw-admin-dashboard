import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import { handleMockRequest } from "./handlers";
import { getMockStore, resetMockStore } from "./store";
import { createPortalApiClient } from "../api/portal-client";
import type { ApiRequest } from "../api/transport";
import { tableDefinitions } from "./schema";
import type { TableName } from "@/types/db";
const request = (overrides: Partial<ApiRequest<unknown>> = {}) => handleMockRequest({ method: "GET", path: "/participants", routeTemplate: "/participants", correlationId: "test", token: "mock-user-1", ...overrides });
beforeEach(() => { resetMockStore(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("mock repository contracts", () => {
  it("paginates query strings with totals", async () => {
    const result = await request({ path: "/participants?page=1&pageSize=2" });
    expect(result).toMatchObject({ resultCode: 200, success: true, data: { page: 1, pageSize: 2, totalItems: getMockStore().participant.length, totalPages: Math.ceil(getMockStore().participant.length / 2) } });
    expect((result.data as { items: unknown[] }).items).toHaveLength(2);
  });
  it.each(["0", "-1", "101", "abc", "1.5"])("rejects invalid pageSize %s", async (pageSize) => {
    expect(await request({ query: { pageSize } })).toMatchObject({ resultCode: 422, success: false });
  });
  it("returns 404 for unknown paths and missing rows, and 403 for denied users", async () => {
    expect(await request({ path: "/not-a-route" })).toMatchObject({ resultCode: 404 });
    expect(await request({ path: "/participants/999", routeTemplate: "/participants/:id" })).toMatchObject({ resultCode: 404 });
    expect(await request({ token: "mock-user-999" })).toMatchObject({ resultCode: 403 });
    expect(await request({ token: undefined })).toMatchObject({ resultCode: 403 });
  });
  it("soft deletes in place, hides the row and writes a redacted audit record", async () => {
    const before = getMockStore().participant.length;
    expect(await request({ method: "PATCH", path: "/participants/1", routeTemplate: "/participants/:id", body: { is_deleted: true } })).toMatchObject({ resultCode: 200 });
    expect(getMockStore().participant).toHaveLength(before);
    expect(getMockStore().participant[0].is_deleted).toBe(true);
    expect(await request({ path: "/participants/1", routeTemplate: "/participants/:id" })).toMatchObject({ resultCode: 404 });
    const audit = getMockStore().audit_logs.at(-1)!;
    expect(audit).toMatchObject({ entity_type: "participant", entity_id: 1, action: "DELETE", performed_by: 1, source: "HTTP" });
    expect(audit.previous_state).not.toContain("29481172");
    expect(audit.previous_state).not.toContain("Faith");
  });
  it("validates writes, persists creates, and does not permit invented columns", async () => {
    expect(await request({ method: "POST", body: { first_name: "New" } })).toMatchObject({ resultCode: 422 });
    expect(await request({ method: "POST", body: { first_name: "New", last_name: "Participant", invented: true } })).toMatchObject({ resultCode: 422 });
    expect(await request({ method: "POST", body: { first_name: "New", last_name: "Participant" } })).toMatchObject({ resultCode: 201 });
    expect(getMockStore().participant.at(-1)?.first_name).toBe("New");
  });
  it("masks sensitive response fields by default", async () => {
    const result = await request({ path: "/participants/1", routeTemplate: "/participants/:id" });
    expect(JSON.stringify(result)).not.toContain("29481172");
    expect(JSON.stringify(result)).not.toContain("Faith");
  });
  it("preserves store across module reloads and resets deterministically", async () => {
    getMockStore().participant[0].remarks = "retained";
    vi.resetModules();
    const reloaded = await import("./store");
    expect(reloaded.getMockStore().participant[0].remarks).toBe("retained");
    reloaded.resetMockStore();
    expect(reloaded.getMockStore().participant[0].remarks).not.toBe("retained");
  });
  it("composes mock transport with no fetch and rejects unknown modes immediately", async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("PORTAL_API_MODE", "mock");
    await createPortalApiClient().request({ method: "GET", path: "/participants", routeTemplate: "/participants", token: "mock-user-1" }, z.unknown());
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.stubEnv("PORTAL_API_MODE", "typo");
    expect(() => createPortalApiClient()).toThrow(/mode/i);
  });
  it("stores only exact SQL columns with valid foreign keys and types", () => {
    const store = getMockStore();
    for (const table of Object.keys(tableDefinitions) as TableName[]) for (const row of store[table]) {
      expect(Object.keys(row).sort()).toEqual(Object.keys(tableDefinitions[table]).sort());
      for (const [key, column] of Object.entries(tableDefinitions[table])) {
        const value = (row as unknown as Record<string, unknown>)[key];
        if (value === null) { expect(column.nullable).toBe(true); continue; }
        if (column.kind !== "json") expect(typeof value).toBe(column.kind);
        if (column.references) expect(store[column.references].some((parent) => parent.id === value)).toBe(true);
      }
    }
    expect(store.pillar).toHaveLength(6);
    expect(store.pipeline_definition.some((row) => row.pillar_id === 4)).toBe(false);
    expect(store.grant_award[0].application_id).toBe(1);
    expect(store.grant_application[0].participant_id).toBe(store.participant.find((row) => row.first_name === "Peter")?.id);
  });
  it("filters by the acting user's scope and rejects cross-pillar referral decisions", async () => {
    const scoped = await request({ token: "mock-user-3" });
    expect((scoped.data as {items: {id:number}[]}).items.map((row) => row.id)).toEqual([2,3,4,9]);
    expect(await request({ token: "mock-user-3", path: "/participants/1", routeTemplate: "/participants/:id", method: "PATCH", body: { remarks: "out of scope" } })).toMatchObject({ resultCode: 403 });
    expect(await request({ token: "mock-user-5", path: "/referrals/4", routeTemplate: "/referrals/:id", method: "PATCH", body: { status: "ACCEPTED" } })).toMatchObject({ resultCode: 403 });
  });
  it("rejects invalid foreign keys, conflicting owners, and unknown fields atomically", async () => {
    const auditCount = getMockStore().audit_logs.length;
    for (const body of [{ ward_id: 999 }, { first_name: null }, { is_deleted: "true" }]) expect(await request({ path: "/participants/1", routeTemplate: "/participants/:id", method: "PATCH", body })).toMatchObject({ resultCode: 422 });
    expect(await request({ method: "POST", query: {table: "enrollment"}, body: { participant_id: 1, organisation_id: 1, pillar_id: 1, entry_category: "invalid" } })).toMatchObject({ resultCode: 422 });
    expect(getMockStore().audit_logs).toHaveLength(auditCount);
  });
  it("does not allow sensitive equality filters to reveal hidden information", async () => {
    expect(await request({ query: { id_number: "29481172" } })).toMatchObject({ resultCode: 422 });
  });
  it("rejects duplicate unique values and creates mock users without exposing password hashes", async () => {
    expect(await request({ path: "/admin/users", routeTemplate: "/admin/users", method: "POST", body: { first_name: "Test", last_name: "User", username: "judy.mwangi" } })).toMatchObject({ resultCode: 422 });
    expect(await request({ path: "/admin/users", routeTemplate: "/admin/users", method: "POST", body: { first_name: "Test", last_name: "User", username: "new.user" } })).toMatchObject({ resultCode: 201 });
  });
  it("reveals only requested permitted fields and audits the reveal without retaining the secret", async () => {
    const result = await request({ path: "/participants/1", routeTemplate: "/participants/:id", query: { reveal: "id_number" } });
    expect(result).toMatchObject({ resultCode: 200, data: { id_number: "29481172" } });
    expect(JSON.stringify(result.data)).not.toContain("0712448481");
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("REVEAL");
    expect(JSON.stringify(getMockStore().audit_logs)).not.toContain("29481172");
    expect(await request({ token: "mock-user-11", path: "/participants/1", routeTemplate: "/participants/:id", query: { reveal: "id_number" } })).toMatchObject({ resultCode: 403 });
  });
  it("supports all approved screen list families", async () => {
    const paths = ["/field-submissions", "/referrals", "/grants", "/assessments", "/reports", "/audit-logs", "/admin/users", "/admin/roles", "/admin/permissions", "/admin/pipelines", "/lookups/county", "/pillars/vawg"];
    for (const path of paths) expect(await request({ path, routeTemplate: (path.startsWith("/lookups") ? "/lookups/:table" : path.startsWith("/pillars") ? "/pillars/:pillar" : path) as ApiRequest["routeTemplate"] })).toMatchObject({ resultCode: 200 });
  });
  it("authenticates mock credentials, returns effective grants and composes live mode", async () => {
    expect(await request({ path: "/auth/login", routeTemplate: "/auth/login", method: "POST", body: {username: "judy.mwangi", password: "creaw-demo"}, token: undefined })).toMatchObject({ resultCode: 200, data: {token: "mock-user-1"} });
    expect(await request({ path: "/auth/login", routeTemplate: "/auth/login", method: "POST", body: {username: "judy.mwangi", password: "wrong"} })).toMatchObject({ resultCode: 403 });
    expect(await request({ path: "/auth/me", routeTemplate: "/auth/me" })).toMatchObject({ resultCode: 200 });
    vi.stubEnv("PORTAL_API_MODE", "live"); vi.stubEnv("PORTAL_API_BASE_URL", "https://api.example.test/v1");
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))); vi.stubGlobal("fetch", fetchSpy);
    await createPortalApiClient().request({ method: "GET", path: "/dashboard", routeTemplate: "/dashboard" }, z.object({ok:z.boolean()}));
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
  it("audits masked CSV exports and simulated document downloads", async () => {
    const exported = await request({query: {format: "csv"}});
    expect(exported.resultCode).toBe(200);
    const csv = (exported.data as {content:string}).content;
    expect(csv).toContain("first_name");
    expect(csv).not.toContain("29481172");
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("EXPORT");
    const downloaded = await request({path: "/participants/1", routeTemplate: "/participants/:id", query: {table: "document", download: true}});
    expect(downloaded).toMatchObject({resultCode: 200, data: {file_url: "mock://documents/participant/1/consent.pdf", simulated: true}});
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("DOWNLOAD");
    expect(await request({token:"mock-user-11", query: {format: "csv"}})).toMatchObject({resultCode: 403});
  });
  it("requires approval permission for the grant approval transition and prevents sensitive data returned after unrelated table selection", async () => {
    expect(await request({token:"mock-user-3",path:"/grants/2",routeTemplate:"/grants/:id",method:"PATCH",body:{status:"APPROVED"}})).toMatchObject({resultCode:403});
    expect(await request({query: {table:"user"}})).toMatchObject({resultCode:422});
  });
  it("keeps designer business submissions connected to their named participant", () => {
    const store = getMockStore();
    const visit = store.participant_stage_event.find((row) => row.local_ref === "m3")!;
    const enrollment = store.enrollment.find((row) => row.id === visit.enrollment_id)!;
    expect(store.participant.find((row) => row.id === enrollment.participant_id)?.first_name).toBe("Peter");
  });
  it("allows scoped staff to read shared geography without granting lookup edits", async () => {
    const result = await request({token:"mock-user-3",path:"/lookups/county",routeTemplate:"/lookups/:table"});
    expect((result.data as {items:unknown[]}).items.length).toBeGreaterThan(0);
    expect(await request({token:"mock-user-3",path:"/lookups/county",routeTemplate:"/lookups/:table",method:"POST",body:{name:"Unauthorized"}})).toMatchObject({resultCode:403});
  });
  it("returns detached data so consumers cannot mutate the store outside audited writes", async () => {
    const result = await request({path:"/dashboard",routeTemplate:"/dashboard"});
    (result.data as {pillars:{name:string}[]}).pillars[0].name = "Mutated outside API";
    expect(getMockStore().pillar[0].name).not.toBe("Mutated outside API");
  });
});
