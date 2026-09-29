import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ userId: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session-server", () => ({ requireSession: async () => ({ user: { id: state.userId }, grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(state.userId) }) }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { getEffectiveGrants } from "@/lib/auth/permissions";
import { createUserAction, updateUserAction, setUserRoleAction } from "./actions";

beforeEach(() => { resetMockStore(); state.userId = 1; state.token = issueMockToken(1); });
const asUser = (id: number) => { state.userId = id; state.token = issueMockToken(id); };

describe("staff administration Server Actions", () => {
  it("creates only render-safe staff data and soft-disables another account", async () => {
    const created = await createUserAction({ firstName: "Amina", lastName: "Test", username: "amina.test", email: "amina@example.org", phoneNumber: "0712345678" });
    expect(created.resultCode).toBe(201);
    expect(JSON.stringify(created)).not.toContain("amina@example.org");
    expect(JSON.stringify(created)).not.toContain("0712345678");
    const id = created.data!.id;
    expect((await updateUserAction({ id, firstName: "Amina", lastName: "Test", status: "DISABLED" })).resultCode).toBe(200);
    expect(getMockStore().user.find(row => row.id === id)?.status).toBe("DISABLED");
    expect(getMockStore().audit_logs.at(-1)?.entity_type).toBe("user");
  });

  it("rejects self lockout and unauthorized staff changes", async () => {
    expect((await updateUserAction({ id: 1, firstName: "Judy", lastName: "Mwangi", status: "DISABLED" })).resultCode).toBe(403);
    asUser(3);
    expect((await updateUserAction({ id: 4, firstName: "Altered", lastName: "User" })).resultCode).toBe(403);
  });

  it("assigns a scoped role, rejects broadening scope, and keeps administrator grant", async () => {
    const assigned = await setUserRoleAction({ userId: 4, roleId: 4, pillarId: 2, enabled: true });
    expect(assigned.resultCode).toBe(200);
    expect(getMockStore().user_role.some(row => row.user_id === 4 && row.role_id === 4 && row.pillar_id === 2 && !row.is_deleted)).toBe(true);
    asUser(3);
    expect((await setUserRoleAction({ userId: 4, roleId: 1, pillarId: null, enabled: true })).resultCode).toBe(403);
    asUser(1);
    expect((await setUserRoleAction({ userId: 1, roleId: 1, pillarId: null, enabled: false })).resultCode).toBe(403);
  });

  it("reactivates a revoked grant without creating a duplicate unique key", async () => {
    expect((await setUserRoleAction({ userId: 4, roleId: 4, pillarId: 2, enabled: false })).resultCode).toBe(200);
    const original = getMockStore().user_role.find(row => row.user_id === 4 && row.role_id === 4 && row.pillar_id === 2)!;
    expect(original.is_deleted).toBe(true);
    expect((await setUserRoleAction({ userId: 4, roleId: 4, pillarId: 2, enabled: true })).resultCode).toBe(200);
    expect(original.is_deleted).toBe(false);
    expect(getMockStore().user_role.filter(row => row.user_id === 4 && row.role_id === 4 && row.pillar_id === 2)).toHaveLength(1);
  });

  it("reactivates an inactive nondeleted role grant and restores its effective permissions", async () => {
    const link = getMockStore().user_role.find(row => row.user_id === 4 && row.role_id === 4 && row.pillar_id === 2)!;
    link.status = "INACTIVE";
    expect(getEffectiveGrants(4).some(grant => grant.permissionCode === "CASE_CLOSE" && grant.pillarId === 2)).toBe(false);
    const response = await setUserRoleAction({ userId: 4, roleId: 4, pillarId: 2, enabled: true });
    expect(response.resultCode).toBe(200);
    expect(link.status).toBe("ACTIVE");
    expect(getEffectiveGrants(4).some(grant => grant.permissionCode === "CASE_CLOSE" && grant.pillarId === 2)).toBe(true);
  });
});
