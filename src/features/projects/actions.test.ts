import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ userId: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session-server", () => ({
  requireSession: async () => ({
    user: { id: state.userId },
    grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(state.userId),
  }),
}));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { deleteProjectAction, saveProjectAction, setProjectStatusAction } from "./actions";

beforeEach(() => {
  resetMockStore();
  asUser(1);
});
const asUser = (id: number) => {
  state.userId = id;
  state.token = issueMockToken(id);
};
const project = (pillarId: number) =>
  getMockStore().project.find((row) => row.pillar_id === pillarId)!;

describe("project Server Actions", () => {
  it("lets a pillar lead deactivate and reactivate their own project but not another pillar's", async () => {
    asUser(5); // Leads VAWG.
    const own = project(1);
    expect(
      (await setProjectStatusAction({ id: own.id, status: "INACTIVE", reason: "Ended" })).resultCode
    ).toBe(200);
    expect(getMockStore().project.find((row) => row.id === own.id)).toMatchObject({
      status: "INACTIVE",
      status_description: "Ended",
    });
    expect((await setProjectStatusAction({ id: own.id, status: "ACTIVE" })).resultCode).toBe(200);
    expect(getMockStore().project.find((row) => row.id === own.id)?.status_description).toBeNull();
    const other = project(2);
    expect([403, 404]).toContain(
      (await setProjectStatusAction({ id: other.id, status: "INACTIVE" })).resultCode
    );
    expect(getMockStore().project.find((row) => row.id === other.id)?.status).toBe("ACTIVE");
  });

  it("deletes only with the configuration permission, and only a project without applications", async () => {
    asUser(5);
    const created = getMockStore().project.length;
    const scratch = await (async () => {
      const result = await saveProjectAction({
        pillarId: 1,
        name: "Scratch",
        startDate: "2026-01-01",
        endDate: "2026-02-01",
      });
      expect(result.resultCode).toBe(201);
      return getMockStore().project.at(-1)!;
    })();
    expect(getMockStore().project.length).toBe(created + 1);
    expect((await deleteProjectAction({ id: scratch.id })).resultCode).toBe(403);
    asUser(1);
    expect((await deleteProjectAction({ id: scratch.id })).resultCode).toBe(200);
    const busy = getMockStore().project.find((row) =>
      getMockStore().grant_application.some((a) => a.project_id === row.id)
    )!;
    const refused = await deleteProjectAction({ id: busy.id });
    expect(refused.resultCode).toBe(422);
    expect(refused.message).toContain("Deactivate it instead");
  });

  it("rejects malformed input and a project that does not exist", async () => {
    expect((await setProjectStatusAction({ id: "x", status: "INACTIVE" })).resultCode).toBe(422);
    expect((await setProjectStatusAction({ id: 9999, status: "INACTIVE" })).resultCode).toBe(404);
    expect((await deleteProjectAction({ id: 0 })).resultCode).toBe(422);
    expect(
      (
        await saveProjectAction({
          pillarId: 2,
          name: "x",
          startDate: "2026-05-01",
          endDate: "2026-01-01",
        })
      ).message
    ).toContain("cannot end before");
  });
});
