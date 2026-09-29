import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getEffectiveGrants, hasPermission, hasModulePermission } from "./permissions";
import { getMockStore, resetMockStore } from "../mock-api/store";

beforeEach(() => resetMockStore());
describe("effective grants", () => {
  it("honours pillar scope and platform-wide grants", () => {
    const grants = [{ permissionCode: "REFERRAL_ACCEPT", pillarId: 2 }];
    expect(hasPermission(grants, "REFERRAL_ACCEPT", { pillarId: 2 })).toBe(true);
    expect(hasPermission(grants, "REFERRAL_ACCEPT", { pillarId: 3 })).toBe(false);
    expect(hasPermission(grants, "REFERRAL_ACCEPT")).toBe(false);
    expect(hasPermission([{ permissionCode: "REFERRAL_ACCEPT", pillarId: null }], "REFERRAL_ACCEPT", { pillarId: 3 })).toBe(true);
  });
  it("opens a module for a scoped grant without broadening record access", () => {
    const grants = [{ permissionCode: "FIELD_SUBMISSION_VIEW", pillarId: 2 }];
    expect(hasModulePermission(grants, "FIELD_SUBMISSION_VIEW")).toBe(true);
    expect(hasPermission(grants, "FIELD_SUBMISSION_VIEW", { pillarId: 1 })).toBe(false);
  });
  it("walks active user_role, role, role_permission and permission rows, not names", () => {
    const store = getMockStore();
    expect(getEffectiveGrants(1).length).toBeGreaterThan(0);
    store.role[0].name = "Unrecognised role label";
    expect(getEffectiveGrants(1).length).toBeGreaterThan(0);
    store.role[0].is_deleted = true;
    expect(getEffectiveGrants(1)).toEqual([]);
  });
  it("excludes disabled accounts and revoked links", () => {
    getMockStore().user[0].status = "INACTIVE";
    expect(getEffectiveGrants(1)).toEqual([]);
    resetMockStore();
    getMockStore().user_role.filter((row) => row.user_id === 1).forEach((row) => { row.is_deleted = true; });
    expect(getEffectiveGrants(1)).toEqual([]);
  });
});
