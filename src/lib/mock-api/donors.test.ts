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
  const routeTemplate = path.replace(/\/\d+$/, "/:id");
  return (await createApiClient(new MockApiTransport(handleMockRequest)).request(
    { token: issueMockToken(userId), method, path, routeTemplate, query, body } as never,
    { parse: (value: unknown) => value } as never
  )) as { resultCode: number; data: Json };
}

describe("donors", () => {
  it("lists donors with their project counts and awarded money", async () => {
    const store = getMockStore();
    const list = await call(1, "GET", "/donors", { pageSize: 100 });
    expect(list.resultCode).toBe(200);
    const donor = list.data.items.find((row: Json) =>
      store.project.some((project) => project.donor_id === row.id)
    );
    const projects = store.project.filter((project) => project.donor_id === donor.id);
    expect(donor.projects_count).toBe(projects.length);
    expect(donor.active_projects_count).toBe(projects.filter((p) => p.status === "ACTIVE").length);
    expect(donor.awarded_total).toEqual(expect.any(Number));
  });

  it("counts only the projects in pillars the caller can see, and hides money without award access", async () => {
    const store = getMockStore();
    const donor = store.donor.find((row) =>
      store.project.some((project) => project.donor_id === row.id && project.pillar_id === 1)
    )!;
    const lead = (await call(5, "GET", `/donors/${donor.id}`, { include: "projects" })).data;
    const mine = store.project.filter((p) => p.donor_id === donor.id && p.pillar_id === 1);
    expect(lead.projects_count).toBe(mine.length);
    expect(lead.projects.every((row: Json) => row.pillar_id === 1)).toBe(true);
    // Lilian holds no award permission, so no money.
    expect(lead.awarded_total).toBeNull();
  });

  it("lets only lookup managers create, edit, deactivate and delete donors", async () => {
    expect((await call(5, "POST", "/donors", {}, { name: "Zeta Trust" })).resultCode).toBe(403);
    const created = await call(1, "POST", "/donors", {}, { name: "Zeta Trust", notes: "New" });
    expect(created.resultCode).toBe(201);
    expect((await call(1, "POST", "/donors", {}, { name: "Zeta Trust" })).resultCode).toBe(422);
    const id = created.data.id;
    expect(
      (
        await call(
          1,
          "PATCH",
          `/donors/${id}`,
          {},
          { notes: "Updated", status: "INACTIVE", status_description: "Paused" }
        )
      ).resultCode
    ).toBe(200);
    expect(getMockStore().donor.find((row) => row.id === id)).toMatchObject({
      notes: "Updated",
      status: "INACTIVE",
    });
    expect((await call(5, "PATCH", `/donors/${id}`, {}, { is_deleted: true })).resultCode).toBe(
      403
    );
    expect((await call(1, "PATCH", `/donors/${id}`, {}, { is_deleted: true })).resultCode).toBe(
      200
    );
    expect(
      (await call(1, "GET", "/donors", { pageSize: 100 })).data.items.some(
        (row: Json) => row.id === id
      )
    ).toBe(false);
  });

  it("refuses to delete a donor that still has projects", async () => {
    const store = getMockStore();
    const donor = store.donor.find((row) => store.project.some((p) => p.donor_id === row.id))!;
    const refused = await call(1, "PATCH", `/donors/${donor.id}`, {}, { is_deleted: true });
    expect(refused.resultCode).toBe(422);
    expect(store.donor.find((row) => row.id === donor.id)?.is_deleted).toBe(false);
  });

  it("does not offer an inactive donor to new projects", async () => {
    const donor = getMockStore().donor[0];
    await call(1, "PATCH", `/donors/${donor.id}`, {}, { status: "INACTIVE" });
    const created = await call(
      1,
      "POST",
      "/projects",
      {},
      { pillar_id: 2, name: "Nope", donor_id: donor.id }
    );
    expect(created.resultCode).toBe(422);
  });
});
