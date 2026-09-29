import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

import { ApiClient } from "./client";
import { readSessionToken, withSessionApi } from "./session-api";

beforeEach(() => cookieStore.get.mockReset());

describe("session-bound feature APIs", () => {
  it("reads the session token from the portal cookie", async () => {
    cookieStore.get.mockImplementation((name: string) =>
      name === "creaw_session" ? { value: "token-1" } : undefined
    );
    expect(await readSessionToken()).toBe("token-1");
  });

  it("returns undefined when no session cookie is present", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await readSessionToken()).toBeUndefined();
  });

  it("builds a feature API with the portal client and session token", async () => {
    cookieStore.get.mockReturnValue({ value: "token-2" });
    const factory = vi.fn((client: ApiClient, token: string) => ({ client, token }));

    const api = await withSessionApi(factory);

    expect(api.token).toBe("token-2");
    expect(api.client).toBeInstanceOf(ApiClient);
  });

  it("refuses to build a feature API without a session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const factory = vi.fn();

    await expect(withSessionApi(factory)).rejects.toThrow("Sign in required");
    expect(factory).not.toHaveBeenCalled();
  });
});
