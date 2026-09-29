import { afterEach, describe, expect, it, vi } from "vitest";

const { requireSession } = vi.hoisted(() => ({ requireSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session-server", () => ({ requireSession }));

import { membersStore } from "@/lib/mock-db/members";
import { createMember, fetchMembers, updateMember } from "./actions";

const calls = [
  ["fetchMembers", () => fetchMembers(), "list"],
  ["createMember", () => createMember({ first_name: "Test", last_name: "User" }), "insert"],
  ["updateMember", () => updateMember("m-1", { first_name: "Changed" }), "update"],
] as const;

afterEach(() => { vi.restoreAllMocks(); requireSession.mockReset(); });

describe("member action authorization", () => {
  it.each(calls)("%s rejects an absent session before store access", async (_name, invoke, storeMethod) => {
    requireSession.mockRejectedValue(new Error("Unauthenticated"));
    const storeSpy = vi.spyOn(membersStore, storeMethod);
    await expect(invoke()).rejects.toThrow("Unauthenticated");
    expect(requireSession).toHaveBeenCalledOnce();
    expect(storeSpy).not.toHaveBeenCalled();
  });

  it.each(calls)("%s denies a pillar-scoped USER_MANAGE grant before store access", async (_name, invoke, storeMethod) => {
    requireSession.mockResolvedValue({ grants: [{ permissionCode: "USER_MANAGE", pillarId: 2 }] });
    const storeSpy = vi.spyOn(membersStore, storeMethod);
    await expect(invoke()).rejects.toThrow("Forbidden");
    expect(storeSpy).not.toHaveBeenCalled();
  });

  it.each(calls)("%s allows a platform-wide USER_MANAGE grant", async (_name, invoke, storeMethod) => {
    requireSession.mockResolvedValue({ grants: [{ permissionCode: "USER_MANAGE", pillarId: null }] });
    const storeSpy = vi.spyOn(membersStore, storeMethod);
    expect((await invoke()).success).toBe(true);
    expect(storeSpy).toHaveBeenCalledOnce();
  });
});
