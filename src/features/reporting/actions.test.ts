import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createReportingApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) => createReportingApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("reporting workflows", () => {
  it("moves an overdue narrative report to submitted and audits it", async () => {
    const report = getMockStore().narrative_report.find(row => row.report_status === "overdue")!;
    const result = await apiFor(1).submit("narrative", report.id, "2026-09-29");
    expect(result.resultCode).toBe(200);
    expect(report.report_status).toBe("submitted");
    expect(report.submitted_date).toBe("2026-09-29");
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("UPDATE");
  });

  it("applies pillar and owner filters to both visible rows and export", async () => {
    const api = apiFor(1);
    const rows = await api.list({ pillarId: 2, ownerId: 3, status: "overdue" });
    expect(rows.items.every(row => row.pillarId === 2 && row.ownerId === 3 && row.status === "overdue")).toBe(true);
    const exportResult = await api.export({ pillarId: 2, ownerId: 3, status: "overdue" });
    expect(exportResult.success).toBe(true);
    expect(getMockStore().audit_logs.at(-1)?.action).toBe("EXPORT");
    expect(exportResult.data?.totalItems).toBe(rows.totalItems);
  });

  it("does not let a WEE-only lead submit a report from SRHR", async () => {
    const report = getMockStore().narrative_report.find(row => getMockStore().project.find(project => project.id === row.project_id)?.pillar_id === 3)!;
    expect((await apiFor(3).submit("narrative", report.id, "2026-09-29")).resultCode).toBe(403);
  });
  it("keeps pillar-name search in the export contract", async () => {
    const api = apiFor(1);
    const query = { search: "Women's Economic Empowerment" };
    const rows = await api.list(query);
    const exported = await api.export(query);
    expect(rows.totalItems).toBeGreaterThan(0);
    expect(exported.data?.totalItems).toBe(rows.totalItems);
  });
  it("shows newly added past deadlines as overdue", async () => {
    const api = apiFor(1);
    const created = await api.addDeadline({ projectId: 1, title: "Historic deadline", periodStart: "2025-01-01", periodEnd: "2025-03-31" });
    expect(created.success).toBe(true);
    expect((await api.list()).items.find(row => row.title === "Historic deadline")?.status).toBe("overdue");
  });
  it("resolves report owners from pillar leads without exposing contacts", async () => {
    const catalog = await apiFor(1).catalog();
    expect(catalog.owners).toContainEqual(expect.objectContaining({ id: 3, name: "Samuel Ndegwa" }));
    expect(JSON.stringify(catalog.owners)).not.toMatch(/phone|email|password/i);
  });
  it("shows and submits scoped grant reports without grant-application or dashboard grants", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    const roleId = store.user_role.find(row => row.user_id === 13)!.role_id;
    for (const code of ["GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE", "REPORT_EXPORT_CSV", "DOCUMENT_UPLOAD", "DOCUMENT_DOWNLOAD"]) {
      const permission = store.permission.find(row => row.code === code)!;
      store.role_permission.push({ ...store.role_permission[0], id: 1000 + permission.id, role_id: roleId, permission_id: permission.id });
    }
    const api = apiFor(13);
    const view = (await api.list()).items.find(row => row.type === "grant");
    expect(view).toMatchObject({ pillarId: 2, project: "Jasiri business grants" });
    expect((await api.export({ pillarId: 2 })).data?.totalItems).toBe((await api.list({ pillarId: 2 })).totalItems);
    expect((await api.submit("grant", view!.id, "2026-09-29", "mock://reports/1.pdf")).resultCode).toBe(200);
  });
  it("uses the same scoped WRO relationships for listing, filtering, and export", async () => {
    const api = apiFor(8);
    const rows = await api.list({ pillarId: 5 });
    expect(rows.totalItems).toBeGreaterThan(0);
    expect(rows.items.every(row => row.pillarId === 5 && row.pillar !== "Pillar" && row.project !== "Programme")).toBe(true);
    const exported = await api.export({ pillarId: 5 });
    expect(exported.data?.totalItems).toBe(rows.totalItems);
    const report = rows.items.find(row => row.type === "narrative")!;
    expect((await api.submit("narrative", report.id, "2026-09-29")).resultCode).toBe(200);
  });
});
