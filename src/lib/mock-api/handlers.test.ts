import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import { handleMockRequest } from "./handlers";
import { getMockStore, issueMockToken, resetMockStore } from "./store";
import { createPortalApiClient } from "../api/portal-client";
import type { ApiRequest } from "../api/transport";
import { tableDefinitions } from "./schema";
import type { TableName } from "@/types/db";
const request = (overrides: Partial<ApiRequest<unknown>> = {}) => {
  const selectedToken = Object.hasOwn(overrides, "token") ? overrides.token : "mock-user-1";
  const fixtureUser = selectedToken?.match(/^mock-user-(\d+)$/);
  const token = fixtureUser ? issueMockToken(Number(fixtureUser[1])) : selectedToken;
  return handleMockRequest({ method: "GET", path: "/participants", routeTemplate: "/participants", correlationId: "test", ...overrides, token });
};
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
    await createPortalApiClient().request({ method: "GET", path: "/participants", routeTemplate: "/participants", token: issueMockToken(1) }, z.unknown());
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
    expect(await request({ path: "/auth/login", routeTemplate: "/auth/login", method: "POST", body: {username: "judy.mwangi", password: "creaw-demo"}, token: undefined })).toMatchObject({ resultCode: 200, data: {token: expect.stringMatching(/^[0-9a-f-]{36}$/i)} });
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
  it("authorizes referral creation against its source pillar, never its destination", async () => {
    const body = {enrollment_id:1,from_pillar_id:1,to_pillar_id:2,to_project_id:1,trigger_reason:"Follow-up"};
    const count = getMockStore().referral.length;
    const audits = getMockStore().audit_logs.length;
    expect(await request({token:"mock-user-3",path:"/referrals",routeTemplate:"/referrals",method:"POST",body})).toMatchObject({resultCode:403});
    expect(getMockStore().referral).toHaveLength(count);
    expect(getMockStore().audit_logs).toHaveLength(audits);
    expect(await request({token:"mock-user-5",path:"/referrals",routeTemplate:"/referrals",method:"POST",body})).toMatchObject({resultCode:201});
  });
  it("requires assessment approval rights for recommendation changes but permits ordinary edits", async () => {
    const target = {token:"mock-user-8",path:"/assessments/3",routeTemplate:"/assessments/:id" as const,method:"PATCH" as const};
    expect(await request({...target,body:{overall_recommendation:"award"}})).toMatchObject({resultCode:403});
    expect(getMockStore().organisation_assessment[2].overall_recommendation).toBeNull();
    expect(await request({...target,body:{section_comments:{governance:"Reviewed"}}})).toMatchObject({resultCode:200});
    expect(await request({...target,token:"mock-user-1",body:{overall_recommendation:"award"}})).toMatchObject({resultCode:200});
    expect(await request({...target,body:{overall_recommendation:null}})).toMatchObject({resultCode:403});
  });
  it("requires approval permission to create an assessment with a recommendation", async () => {
    const target = {token:"mock-user-8",path:"/assessments",routeTemplate:"/assessments" as const,method:"POST" as const};
    const body = {organisation_id:3,instrument_id:1,overall_recommendation:"award"};
    const count = getMockStore().organisation_assessment.length;
    const audits = getMockStore().audit_logs.length;
    expect(await request({...target,body})).toMatchObject({resultCode:403});
    expect(getMockStore().organisation_assessment).toHaveLength(count);
    expect(getMockStore().audit_logs).toHaveLength(audits);
    expect(await request({...target,body:{organisation_id:3,instrument_id:1}})).toMatchObject({resultCode:201,data:{overall_recommendation:null}});
    expect(await request({...target,body:{...body,overall_recommendation:null}})).toMatchObject({resultCode:201,data:{overall_recommendation:null}});
    expect(await request({...target,token:"mock-user-1",body})).toMatchObject({resultCode:201,data:{overall_recommendation:"award"}});
  });
  it("permits recommended assessment creation only within a scoped approver's pillar", async () => {
    const store = getMockStore();
    const approval = store.permission.find((row) => row.code === "ORG_ASSESSMENT_APPROVE")!;
    const edit = store.permission.find((row) => row.code === "ORG_ASSESSMENT_EDIT")!;
    store.role_permission.filter((row) => row.role_id === 3 && row.permission_id === edit.id).forEach((row) => { row.is_deleted = true; });
    store.role_permission.push({...store.role_permission[0],id:9999,role_id:3,permission_id:approval.id});
    const target = {path:"/assessments",routeTemplate:"/assessments" as const,method:"POST" as const,body:{organisation_id:3,instrument_id:1,overall_recommendation:"award"}};
    expect(await request({...target,token:"mock-user-3"})).toMatchObject({resultCode:403});
    expect(await request({...target,token:"mock-user-8"})).toMatchObject({resultCode:201,data:{overall_recommendation:"award"}});
  });
  it("supports pillar-owned detail, reveal, updates and soft deletion through query.id", async () => {
    const target = {token:"mock-user-5",path:"/pillars/vawg",routeTemplate:"/pillars/:pillar" as const,query:{table:"legal_case",id:1}};
    const detail = await request(target);
    expect(detail).toMatchObject({resultCode:200,data:{id:1,enrollment_id:1}});
    expect(JSON.stringify(detail.data)).not.toContain("Safety plan");
    expect(await request({...target,query:{...target.query,reveal:"outcome_notes"}})).toMatchObject({resultCode:200,data:{outcome_notes:"Safety plan and shelter referral discussed."}});
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("REVEAL");
    expect(await request({...target,method:"PATCH",body:{court_status:"ruled"}})).toMatchObject({resultCode:200});
    expect(getMockStore().legal_case[0].court_status).toBe("ruled");
    expect(await request({...target,method:"PATCH",body:{is_deleted:true}})).toMatchObject({resultCode:200});
    expect(getMockStore().legal_case[0].is_deleted).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("DELETE");
    expect(await request(target)).toMatchObject({resultCode:404});
  });
  it("constrains selected pillar rows to the path pillar and the caller's grants", async () => {
    const target = {path:"/pillars/wee",routeTemplate:"/pillars/:pillar" as const,query:{table:"legal_case",id:1}};
    expect(await request(target)).toMatchObject({resultCode:404});
    expect(await request({...target,method:"PATCH",body:{court_status:"closed"}})).toMatchObject({resultCode:404});
    expect(await request({...target,path:"/pillars/vawg",token:"mock-user-3"})).toMatchObject({resultCode:403});
    expect(await request({...target,path:"/pillars/vawg",query:{table:"legal_case",id:"invalid"}})).toMatchObject({resultCode:404});
    expect(await request({...target,path:"/pillars/vawg",method:"PATCH",body:{enrollment_id:2}})).toMatchObject({resultCode:403});
  });
  it("requires the named pillar scope even when an organisation is shared across pillars", async () => {
    const store = getMockStore();
    store.enrollment.push({...store.enrollment[12],id:999,organisation_id:1,pillar_id:2});
    const view = store.permission.find((row) => row.code === "ORGANISATION_VIEW")!;
    store.role_permission.push({...store.role_permission[0],id:9999,role_id:3,permission_id:view.id});
    expect(await request({token:"mock-user-8",path:"/pillars/wee",routeTemplate:"/pillars/:pillar",query:{table:"organisation",id:1}})).toMatchObject({resultCode:403});
    expect(await request({token:"mock-user-8",path:"/pillars/wros",routeTemplate:"/pillars/:pillar",query:{table:"organisation",id:1}})).toMatchObject({resultCode:200});
  });
  it("allows platform-wide registration to omit pillarId on a pillar route", async () => {
    expect(await request({path:"/pillars/wros",routeTemplate:"/pillars/:pillar",query:{table:"organisation"},method:"POST",body:{name:"Platform registration",legal_form:"ngo"}})).toMatchObject({resultCode:201});
  });
  it.each([["counselling_session","vawg"],["training_enrollment","skilling"],["activity_session","srhr"]])("addresses %s by ID on its pillar", async (table,pillar) => {
    expect(await request({path:`/pillars/${pillar}`,routeTemplate:"/pillars/:pillar",query:{table,id:1}})).toMatchObject({resultCode:200,data:{id:1}});
  });
  it("registers a scoped participant using non-persisted pillarId then creates its enrollment", async () => {
    const body = {first_name:"New",last_name:"Participant"};
    const count = getMockStore().participant.length;
    for (const query of [undefined,{pillarId:1}]) expect(await request({token:"mock-user-3",method:"POST",body,query})).toMatchObject({resultCode:403});
    expect(getMockStore().participant).toHaveLength(count);
    const enrollments = getMockStore().enrollment.length;
    const created = await request({token:"mock-user-3",method:"POST",body,query:{pillarId:2}});
    expect(created.resultCode).toBe(201);
    const id = (created.data as {id:number}).id;
    expect(getMockStore().participant.at(-1)).not.toHaveProperty("pillarId");
    expect(getMockStore().participant.at(-1)).not.toHaveProperty("pillar_id");
    expect(getMockStore().enrollment).toHaveLength(enrollments);
    expect(await request({token:"mock-user-3",method:"POST",query:{table:"enrollment"},body:{participant_id:id,pillar_id:2,entry_category:"Grant applicant"}})).toMatchObject({resultCode:201});
    expect(await request({token:"mock-user-3",path:`/participants/${id}`,routeTemplate:"/participants/:id"})).toMatchObject({resultCode:200});
  });
  it("registers a scoped organisation without persisting its authorization context", async () => {
    const store = getMockStore();
    const permission = store.permission.find((row) => row.code === "ORGANISATION_EDIT")!;
    store.role_permission.push({...store.role_permission[0],id:9999,role_id:3,permission_id:permission.id});
    const target = {token:"mock-user-8",path:"/assessments",routeTemplate:"/assessments" as const,method:"POST" as const,body:{name:"New WRO",legal_form:"ngo"}};
    expect(await request({...target,query:{table:"organisation"}})).toMatchObject({resultCode:403});
    const created = await request({...target,query:{table:"organisation",pillarId:5}});
    expect(created.resultCode).toBe(201);
    const id = (created.data as {id:number}).id;
    expect(store.organisation.at(-1)).not.toHaveProperty("pillarId");
    expect(await request({token:"mock-user-8",method:"POST",query:{table:"enrollment"},body:{organisation_id:id,pillar_id:5,entry_category:"Sub-grant applicant"}})).toMatchObject({resultCode:201});
  });
  it.each(["POST","PATCH"] as const)("detaches nested JSON request values before %s persistence", async (method) => {
    const comments = { governance:{findings:["Reviewed"]} };
    const path = method === "POST" ? "/assessments" : "/assessments/3";
    const body = method === "POST" ? {organisation_id:3,instrument_id:1,section_comments:comments} : {section_comments:comments};
    const result = await request({path,routeTemplate:method === "POST" ? "/assessments" : "/assessments/:id",method,body});
    expect(result.resultCode).toBe(method === "POST" ? 201 : 200);
    const id = (result.data as {id:number}).id;
    const auditCount = getMockStore().audit_logs.length;
    comments.governance.findings[0] = "Changed without an audited request";
    expect(getMockStore().organisation_assessment.find((row) => row.id === id)?.section_comments).toEqual({governance:{findings:["Reviewed"]}});
    expect(getMockStore().audit_logs).toHaveLength(auditCount);
  });
});
