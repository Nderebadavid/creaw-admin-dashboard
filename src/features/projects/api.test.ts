import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createProjectsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createProjectsApi(
    createApiClient(new MockApiTransport(handleMockRequest)),
    issueMockToken(userId)
  );

describe("projects API client", () => {
  it("lists projects with donor, pillar and grant figures, sorted by the API", async () => {
    const page = await apiFor(1).list({ pageSize: 100, sort: { by: "awarded", order: "desc" } });
    expect(page.items.length).toBe(getMockStore().project.length);
    const wee = page.items.find((row) => row.pillarId === 2)!;
    expect(wee).toMatchObject({
      pillar: expect.any(String),
      donor: expect.any(String),
      applications: expect.any(Number),
      awarded: expect.any(Number),
    });
    const awarded = page.items.map((row) => row.awarded ?? -1);
    expect(awarded).toEqual([...awarded].sort((a, b) => b - a));
  });

  it("loads a project's applications and reporting periods", async () => {
    const project = getMockStore().project.find((row) => row.pillar_id === 2)!;
    const detail = await apiFor(1).detail(project.id);
    expect(detail?.applications.length).toBeGreaterThan(0);
    expect(detail?.applications[0]).toMatchObject({ applicant: expect.any(String) });
    expect(await apiFor(1).detail(9999)).toBeNull();
  });

  it("creates and edits a project", async () => {
    const api = apiFor(1);
    const created = await api.create({
      pillarId: 2,
      name: "Amani grants",
      donorId: 1,
      startDate: "2026-03-01",
      endDate: "2026-09-30",
    });
    expect(created.resultCode).toBe(201);
    const id = created.data!.id;
    const edited = await api.update({
      id,
      pillarId: 2,
      name: "Amani grants",
      donorId: null,
      startDate: "2026-03-01",
      endDate: "2026-12-31",
      notes: "Extended",
    });
    expect(edited.resultCode).toBe(200);
    expect(getMockStore().project.find((row) => row.id === id)).toMatchObject({
      donor_id: null,
      end_date: "2026-12-31",
      notes: "Extended",
    });
  });

  it("offers the pillars and donors for the form", async () => {
    const options = await apiFor(1).options();
    expect(options.pillars.length).toBeGreaterThan(0);
    expect(options.donors.length).toBeGreaterThan(0);
  });
});
