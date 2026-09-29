import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ userId: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session-server", () => ({ requireSession: async () => ({ user: { id: state.userId }, grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(state.userId) }) }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { advanceGrantAction, logGrantReportAction } from "./actions";

beforeEach(() => { resetMockStore(); state.userId = 1; state.token = issueMockToken(1); });
const asUser = (id: number) => { state.userId = id; state.token = issueMockToken(id); };

describe("grant Server Actions", () => {
  it("rechecks prior sign-off actor even when the officer has review permission", async () => {
    asUser(4); // Seeded preparer for application 3.
    expect((await advanceGrantAction({ id: 3, status: "REVIEWED" })).resultCode).toBe(403);
    expect(getMockStore().grant_application[2].status).toBe("PREPARED");
  });

  it("allows a scoped grant-report manager without award-view permission to log a period", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    const roleId = store.user_role.find(row => row.user_id === 13)!.role_id;
    for (const code of ["GRANT_APPLICATION_VIEW", "GRANT_REPORT_MANAGE"]) {
      const permission = store.permission.find(row => row.code === code)!;
      store.role_permission.push({ ...store.role_permission[0], id: 1000 + permission.id, role_id: roleId, permission_id: permission.id });
    }
    asUser(13);
    const response = await logGrantReportAction({ applicationId: 1, periodStart: "2026-10-01", periodEnd: "2026-12-31", dueDate: "2027-01-15" });
    expect(response.resultCode).toBe(201);
    expect(store.grant_report.at(-1)?.grant_award_id).toBe(1);
  });
});
