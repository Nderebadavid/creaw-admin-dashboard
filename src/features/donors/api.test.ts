import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createDonorsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createDonorsApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));

describe("donors API client", () => {
  it("lists donors with project counts and sorts on the server", async () => {
    const page = await apiFor(1).list({ pageSize: 100, sort: { by: "projects", order: "desc" } });
    expect(page.items.length).toBe(getMockStore().donor.length);
    const counts = page.items.map((row) => row.projects ?? -1);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(page.items[0]).toMatchObject({
      projects: expect.any(Number),
      awarded: expect.any(Number),
    });
  });

  it("loads a donor's projects", async () => {
    const store = getMockStore();
    const donor = store.donor.find((row) => store.project.some((p) => p.donor_id === row.id))!;
    const detail = await apiFor(1).detail(donor.id);
    expect(detail?.projects.length).toBe(
      store.project.filter((p) => p.donor_id === donor.id).length
    );
    expect(detail?.projects[0]).toMatchObject({ pillar: expect.any(String) });
    expect(await apiFor(1).detail(9999)).toBeNull();
  });

  it("adds, edits, deactivates and deletes a donor", async () => {
    const api = apiFor(1);
    const created = await api.create({ name: "Zeta Trust", notes: "New" });
    expect(created.resultCode).toBe(201);
    const id = created.data!.id;
    expect(
      (
        await api.update({
          id,
          name: "Zeta Trust UK",
          notes: null,
          status: "INACTIVE",
          statusDescription: "Paused",
        })
      ).resultCode
    ).toBe(200);
    expect(getMockStore().donor.find((row) => row.id === id)).toMatchObject({
      name: "Zeta Trust UK",
      status: "INACTIVE",
      status_description: "Paused",
    });
    expect((await api.setStatus(id, "ACTIVE")).resultCode).toBe(200);
    expect(getMockStore().donor.find((row) => row.id === id)?.status_description).toBeNull();
    expect((await api.remove(id)).resultCode).toBe(200);
    expect(await api.get(id)).toBeNull();
  });

  it("refuses to delete a donor that still has projects", async () => {
    const store = getMockStore();
    const donor = store.donor.find((row) => store.project.some((p) => p.donor_id === row.id))!;
    expect((await apiFor(1).remove(donor.id)).resultCode).toBe(422);
  });
});
