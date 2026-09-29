import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

import { loginAction, logoutAction } from "./actions";
import { resetMockStore } from "../mock-api/store";
import { createPortalApiClient } from "../api/portal-client";
import { createEnvelopeSchema } from "../api/contracts";
import { z } from "zod";

beforeEach(() => { resetMockStore(); vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("auth actions", () => {
  it("sets only the opaque token in a protected cookie and returns no token", async () => {
    const result = await loginAction("judy.mwangi", "creaw-demo", true);
    expect(result).toEqual({ success: true });
    expect(cookieStore.set).toHaveBeenCalledWith("creaw_session", expect.stringMatching(/^[0-9a-f-]{36}$/i), expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 43200 }));
    expect(JSON.stringify(result)).not.toContain(cookieStore.set.mock.lastCall?.[1] as string);
  });

  it("returns a standard failure without setting a cookie", async () => {
    const result = await loginAction("judy.mwangi", "wrong", false);
    expect(result).toEqual({ success: false, error: "Permission denied" });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("shows the API's invalid-credential message in live mode", async () => {
    vi.stubEnv("PORTAL_API_MODE", "live");
    vi.stubEnv("PORTAL_API_BASE_URL", "https://example.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      resultCode: 403, success: false, message: "Invalid credentials", data: null,
    }), { status: 403 })));
    expect(await loginAction("judy.mwangi", "wrong", false)).toEqual({ success: false, error: "Invalid credentials" });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("keeps the service-unreachable message for a network failure", async () => {
    vi.stubEnv("PORTAL_API_MODE", "live");
    vi.stubEnv("PORTAL_API_BASE_URL", "https://example.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await loginAction("judy.mwangi", "creaw-demo", false)).toEqual({
      success: false, error: "Could not reach the authentication service. Please try again.",
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("revokes the token and removes the cookie on logout", async () => {
    await loginAction("judy.mwangi", "creaw-demo", true);
    const token = cookieStore.set.mock.lastCall?.[1] as string;
    cookieStore.get.mockReturnValue({ value: token });
    await logoutAction();
    expect(cookieStore.delete).toHaveBeenCalledWith("creaw_session");
    const response = await createPortalApiClient().request({ method: "GET", path: "/auth/me", routeTemplate: "/auth/me", token }, createEnvelopeSchema(z.unknown()));
    expect(response.resultCode).toBe(403);
  });

  it("allows a fresh login after revoking a previous token", async () => {
    await loginAction("judy.mwangi", "creaw-demo", true);
    const oldToken = cookieStore.set.mock.lastCall?.[1] as string;
    cookieStore.get.mockReturnValue({ value: oldToken });
    await logoutAction();
    expect(await loginAction("judy.mwangi", "creaw-demo", true)).toEqual({ success: true });
    const newToken = cookieStore.set.mock.lastCall?.[1] as string;
    expect(newToken).not.toBe(oldToken);
    const response = await createPortalApiClient().request({ method: "GET", path: "/auth/me", routeTemplate: "/auth/me", token: newToken }, createEnvelopeSchema(z.unknown()));
    expect(response.resultCode).toBe(200);
  });
});
