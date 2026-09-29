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
import { submitReportAction } from "./actions";

beforeEach(() => {
  resetMockStore();
  state.userId = 1;
  state.token = issueMockToken(1);
});
const asUser = (id: number) => {
  state.userId = id;
  state.token = issueMockToken(id);
};

describe("reporting Server Actions", () => {
  it("submits a scoped grant report without unrelated grant-application access", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    const roleId = store.user_role.find((row) => row.user_id === 13)!.role_id;
    for (const code of ["GRANT_REPORT_VIEW", "GRANT_REPORT_MANAGE", "DOCUMENT_UPLOAD"]) {
      const permission = store.permission.find((row) => row.code === code)!;
      store.role_permission.push({
        ...store.role_permission[0],
        id: 1000 + permission.id,
        role_id: roleId,
        permission_id: permission.id,
      });
    }
    asUser(13);
    expect(
      (
        await submitReportAction({
          type: "grant",
          id: 1,
          date: "2026-09-29",
          fileUrl: "mock://reports/1.pdf",
        })
      ).resultCode
    ).toBe(200);
    expect(store.grant_report[0].submitted_date).toBe("2026-09-29");
  });

  it("does not mutate an out-of-scope report", async () => {
    const before = getMockStore().grant_report[0].submitted_date;
    asUser(9); // SRHR lead; grant report belongs to WEE.
    expect(
      (
        await submitReportAction({
          type: "grant",
          id: 1,
          date: "2026-09-29",
          fileUrl: "mock://reports/1.pdf",
        })
      ).success
    ).toBe(false);
    expect(getMockStore().grant_report[0].submitted_date).toBe(before);
  });
});
