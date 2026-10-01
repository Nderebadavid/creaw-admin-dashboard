import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "./handlers";
import { getMockStore, issueMockToken, resetMockStore } from "./store";

beforeEach(() => resetMockStore());

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(
  userId: number,
  method: "GET" | "POST" | "PATCH",
  path: string,
  query: Record<string, string | number> = {},
  body?: unknown
): Promise<{ resultCode: number; data: Json }> {
  const routeTemplate = /^\/projects\/\d+$/.test(path) ? "/projects/:id" : path;
  return (await createApiClient(new MockApiTransport(handleMockRequest)).request(
    { token: issueMockToken(userId), method, path, routeTemplate, query, body } as never,
    { parse: (value: unknown) => value } as never
  )) as { resultCode: number; data: Json };
}

describe("projects", () => {
  it("lists projects with donor, dates and grant totals for a user who can see the pillar's grants", async () => {
    const list = await call(1, "GET", "/projects", { pageSize: 100 });
    expect(list.resultCode).toBe(200);
    const wee = list.data.items.find((row: Json) => row.pillar_id === 2);
    expect(wee).toMatchObject({
      status: "ACTIVE",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      donor_name: expect.any(String),
      applications_count: expect.any(Number),
      awards_count: expect.any(Number),
      awarded_total: expect.any(Number),
      disbursed_total: expect.any(Number),
    });
    expect(wee.applications_count).toBeGreaterThan(0);
  });

  it("matches the grant totals to the store", async () => {
    const store = getMockStore();
    const project = store.project.find((row) => row.pillar_id === 2)!;
    const applications = store.grant_application.filter((row) => row.project_id === project.id);
    const awards = store.grant_award.filter((row) =>
      applications.some((application) => application.id === row.application_id)
    );
    const detail = await call(1, "GET", `/projects/${project.id}`, {
      include: "applications,awards,reports",
    });
    expect(detail.data.applications).toHaveLength(applications.length);
    expect(detail.data.awards).toHaveLength(awards.length);
    expect(detail.data.awarded_total).toBe(
      awards.reduce((sum, row) => sum + row.amount_awarded, 0)
    );
    expect(detail.data.awards_count).toBe(awards.length);
  });

  it("shows only the figures the caller's grants allow, and only their pillars' projects", async () => {
    // Lilian (5) leads VAWG: she sees applications but holds no award permission.
    const lead = await call(5, "GET", "/projects", { pageSize: 100 });
    expect(lead.resultCode).toBe(200);
    expect(lead.data.items.every((row: Json) => row.pillar_id === 1)).toBe(true);
    expect(lead.data.items[0]).toMatchObject({
      applications_count: expect.any(Number),
      awarded_total: null,
      disbursed_total: null,
      reports_overdue: null,
    });
    // Cynthia (6) is a counsellor with dashboard access only.
    const staff = await call(6, "GET", "/projects", { pageSize: 100 });
    expect(staff.data.items[0]).toMatchObject({ applications_count: null, awards_count: null });
  });

  it("sorts and filters on the server, and counts overdue reports", async () => {
    const byName = await call(1, "GET", "/projects", { pageSize: 100, sort: "name:desc" });
    const names = byName.data.items.map((row: Json) => row.name);
    expect(names).toEqual([...names].sort((a: string, b: string) => b.localeCompare(a)));
    const wee = await call(1, "GET", "/projects", { pageSize: 100, pillar_id: 2 });
    expect(wee.data.items.every((row: Json) => row.pillar_id === 2)).toBe(true);
    const store = getMockStore();
    const award = store.grant_award[0];
    store.grant_report.push({
      ...store.grant_report[0],
      id: 9000,
      grant_award_id: award.id,
      due_date: "2020-01-01",
      submitted_date: null,
      is_deleted: false,
    });
    const application = store.grant_application.find((row) => row.id === award.application_id)!;
    const detail = await call(1, "GET", `/projects/${application.project_id}`);
    expect(detail.data.reports_overdue).toBeGreaterThan(0);
  });

  it("creates and edits a project, rejecting duplicates and an end before the start", async () => {
    const body = {
      pillar_id: 2,
      name: "Amani grants",
      donor_id: 1,
      start_date: "2026-03-01",
      end_date: "2026-09-30",
    };
    const created = await call(1, "POST", "/projects", {}, body);
    expect(created.resultCode).toBe(201);
    expect((await call(1, "POST", "/projects", {}, body)).resultCode).toBe(422);
    expect(
      (await call(1, "POST", "/projects", {}, { ...body, name: "Other", end_date: "2026-01-01" }))
        .resultCode
    ).toBe(422);
    const id = created.data.id;
    const edited = await call(
      1,
      "PATCH",
      `/projects/${id}`,
      {},
      { end_date: "2026-12-31", notes: "Extended" }
    );
    expect(edited.resultCode).toBe(200);
    expect(getMockStore().project.find((row) => row.id === id)).toMatchObject({
      end_date: "2026-12-31",
      notes: "Extended",
    });
  });

  it("lets a pillar lead manage their own pillar's projects, and nobody else's", async () => {
    const own = {
      pillar_id: 1,
      name: "Safe spaces",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
    };
    expect((await call(5, "POST", "/projects", {}, own)).resultCode).toBe(201);
    expect((await call(5, "POST", "/projects", {}, { ...own, pillar_id: 2 })).resultCode).toBe(403);
    expect((await call(6, "POST", "/projects", {}, { ...own, name: "Nope" })).resultCode).toBe(403);
  });
});
