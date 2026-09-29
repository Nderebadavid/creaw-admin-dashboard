import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));

import { getSession, requireSession } from "./session-server";
import { resetMockStore } from "../mock-api/store";

beforeEach(() => { resetMockStore(); cookieStore.get.mockReset(); });

describe("session resolution", () => {
  it("returns null without a cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  it("resolves the signed-in user and grants through /auth/me", async () => {
    cookieStore.get.mockReturnValue({ value: "mock-user-1" });
    const session = await getSession();
    expect(session?.user).toMatchObject({ name: "Judy Mwangi" });
    expect(session?.user.email).toContain(".org");
    expect(session?.grants.length).toBeGreaterThan(0);
    expect(JSON.stringify(session)).not.toContain("password_hash");
  });

  it("redirects when the token is invalid", async () => {
    cookieStore.get.mockReturnValue({ value: "invalid-token" });
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });
});
