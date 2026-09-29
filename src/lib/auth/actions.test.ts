import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

import { loginAction, logoutAction } from "./actions";
import { resetMockStore } from "../mock-api/store";
import { createPortalApiClient } from "../api/portal-client";
import { createEnvelopeSchema } from "../api/contracts";
import { z } from "zod";

beforeEach(() => { resetMockStore(); vi.clearAllMocks(); });

describe("auth actions", () => {
  it("sets only the opaque token in a protected cookie and returns no token", async () => {
    const result = await loginAction("judy.mwangi", "creaw-demo", true);
    expect(result).toEqual({ success: true });
    expect(cookieStore.set).toHaveBeenCalledWith("creaw_session", "mock-user-1", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 43200 }));
    expect(JSON.stringify(result)).not.toContain("mock-user-1");
  });

  it("returns a standard failure without setting a cookie", async () => {
    const result = await loginAction("judy.mwangi", "wrong", false);
    expect(result).toEqual({ success: false, error: "Permission denied" });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("revokes the token and removes the cookie on logout", async () => {
    cookieStore.get.mockReturnValue({ value: "mock-user-1" });
    await logoutAction();
    expect(cookieStore.delete).toHaveBeenCalledWith("creaw_session");
    const response = await createPortalApiClient().request({ method: "GET", path: "/auth/me", routeTemplate: "/auth/me", token: "mock-user-1" }, createEnvelopeSchema(z.unknown()));
    expect(response.resultCode).toBe(403);
  });

  it("allows a fresh login after revoking a previous token", async () => {
    await loginAction("judy.mwangi", "creaw-demo", true);
    cookieStore.get.mockReturnValue({ value: "mock-user-1" });
    await logoutAction();
    expect(await loginAction("judy.mwangi", "creaw-demo", true)).toEqual({ success: true });
    const newToken = cookieStore.set.mock.lastCall?.[1] as string;
    expect(newToken).not.toBe("mock-user-1");
    const response = await createPortalApiClient().request({ method: "GET", path: "/auth/me", routeTemplate: "/auth/me", token: newToken }, createEnvelopeSchema(z.unknown()));
    expect(response.resultCode).toBe(200);
  });
});
