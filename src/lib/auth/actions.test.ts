import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// A working cookie jar, so the challenge set by one action is read by the next.
const jar = new Map<string, string>();
const cookieStore = {
  get: vi.fn((name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined)),
  set: vi.fn<(name: string, value: string, options?: object) => void>(
    (name, value) => void jar.set(name, value)
  ),
  delete: vi.fn((name: string) => void jar.delete(name)),
};
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

import { loginAction, logoutAction, resendOtpAction, verifyOtpAction } from "./actions";
import { requestPasswordResetAction, resetPasswordAction } from "./password-actions";
import { resetMockStore } from "../mock-api/store";
import { createPortalApiClient } from "../api/portal-client";
import { createEnvelopeSchema } from "../api/contracts";
import { z } from "zod";

const OTP = "246810";

beforeEach(() => {
  resetMockStore();
  jar.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubLiveResponse(status: number, body: unknown) {
  vi.stubEnv("PORTAL_API_MODE", "live");
  vi.stubEnv("PORTAL_API_BASE_URL", "https://example.test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

async function signIn(remember = true): Promise<string> {
  await loginAction("judy.mwangi", "creaw-demo", remember);
  expect(await verifyOtpAction(OTP)).toMatchObject({ success: true });
  return jar.get("creaw_session")!;
}

const me = (token: string) =>
  createPortalApiClient().request(
    { method: "GET", path: "/auth/me", routeTemplate: "/auth/me", token },
    createEnvelopeSchema(z.unknown())
  );

describe("password step", () => {
  it("holds the challenge in a protected cookie and creates no session", async () => {
    const result = await loginAction("judy.mwangi", "creaw-demo", true);
    expect(result).toEqual({
      success: true,
      challenge: { maskedPhone: "07•• ••• 344", maskedEmail: "ju•••••@creaw.org" },
    });
    expect(cookieStore.set).toHaveBeenCalledExactlyOnceWith(
      "creaw_login_challenge",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 })
    );
    expect(jar.has("creaw_session")).toBe(false);
    const { id } = JSON.parse(jar.get("creaw_login_challenge")!);
    expect(JSON.stringify(result)).not.toContain(id);
  });

  it("returns the API's failure and flags a locked account", async () => {
    expect(await loginAction("judy.mwangi", "wrong", false)).toEqual({
      success: false,
      error: "Incorrect email or password. 4 attempts left before the account is locked.",
    });
    for (let attempt = 0; attempt < 3; attempt++) await loginAction("judy.mwangi", "wrong", false);
    expect(await loginAction("judy.mwangi", "wrong", false)).toMatchObject({
      success: false,
      locked: true,
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("rejects blank credentials without calling the API", async () => {
    expect(await loginAction("  ", "creaw-demo")).toMatchObject({ success: false });
    expect(await loginAction("judy.mwangi", "")).toMatchObject({ success: false });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("shows the API's invalid-credential message in live mode", async () => {
    stubLiveResponse(403, {
      resultCode: 403,
      success: false,
      message: "Invalid credentials",
      data: null,
    });
    expect(await loginAction("judy.mwangi", "wrong", false)).toEqual({
      success: false,
      error: "Invalid credentials",
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("refuses a live API that skips the verification step", async () => {
    stubLiveResponse(200, {
      resultCode: 200,
      success: true,
      message: "OK",
      data: { token: "session-without-second-step" },
    });
    expect(await loginAction("judy.mwangi", "creaw-demo", true)).toEqual({
      success: false,
      error: "Sign in failed. Please try again.",
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("keeps the service-unreachable message for a network failure", async () => {
    vi.stubEnv("PORTAL_API_MODE", "live");
    vi.stubEnv("PORTAL_API_BASE_URL", "https://example.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await loginAction("judy.mwangi", "creaw-demo", false)).toEqual({
      success: false,
      error: "Could not reach the authentication service. Please try again.",
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});

describe("verification step", () => {
  it("stores the token pair in protected cookies and returns no token", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T08:00:00Z"));
    await loginAction("judy.mwangi", "creaw-demo", true);
    const result = await verifyOtpAction(OTP);
    expect(result).toEqual({
      success: true,
      user: { firstName: "Judy", initials: "JM", role: "System Administrator" },
    });
    const protectedFor = (maxAge: number) =>
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge });
    expect(cookieStore.set).toHaveBeenCalledWith(
      "creaw_session",
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
      protectedFor(30 * 60)
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "creaw_refresh",
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
      protectedFor(7 * 24 * 60 * 60)
    );
    expect(JSON.parse(jar.get("creaw_session_meta")!)).toEqual({
      expiresAt: Date.parse("2026-09-30T08:30:00Z"),
      remember: true,
    });
    expect(JSON.stringify(result)).not.toContain(jar.get("creaw_session"));
    expect(JSON.stringify(result)).not.toContain(jar.get("creaw_refresh"));
    expect(jar.has("creaw_login_challenge")).toBe(false);
    expect((await me(jar.get("creaw_session")!)).resultCode).toBe(200);
  });

  it("makes browser-session cookies when the user does not stay signed in", async () => {
    await signIn(false);
    for (const [name, , options] of cookieStore.set.mock.calls)
      if (name !== "creaw_login_challenge") expect(options).not.toHaveProperty("maxAge");
  });

  it("reads a live token pair with the API's zone-less timestamps", async () => {
    await loginAction("judy.mwangi", "creaw-demo", true);
    vi.stubEnv("PORTAL_API_MODE", "live");
    vi.stubEnv("PORTAL_API_BASE_URL", "https://example.test");
    const envelope = (data: unknown, message = "OK") =>
      new Response(JSON.stringify({ resultCode: 200, success: true, message, data }));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          envelope(
            {
              token: "1DZ0bhqd6An9XTlUWj4FouNIxXn2eTQUPZ8ja49m-QQ",
              expireAt: "2026-09-26 17:37:27",
              refreshToken: "d38rpKxC6YUhfX7spl1eTzYZJCmc3QczezpQJwnJ7q8",
              refreshExpireAt: "2026-10-03 17:07:27",
            },
            "Login successful"
          )
        )
        .mockResolvedValueOnce(
          envelope({
            user: { id: 1, first_name: "Judy", last_name: "Mwangi", email: null },
            grants: [],
            roles: [],
          })
        )
    );
    expect(await verifyOtpAction(OTP)).toMatchObject({ success: true });
    expect(jar.get("creaw_session")).toBe("1DZ0bhqd6An9XTlUWj4FouNIxXn2eTQUPZ8ja49m-QQ");
    expect(jar.get("creaw_refresh")).toBe("d38rpKxC6YUhfX7spl1eTzYZJCmc3QczezpQJwnJ7q8");
    expect(JSON.parse(jar.get("creaw_session_meta")!).expiresAt).toBe(
      Date.parse("2026-09-26T14:37:27Z")
    );
  });

  it("refuses a token pair without readable expiry", async () => {
    await loginAction("judy.mwangi", "creaw-demo", true);
    stubLiveResponse(200, {
      resultCode: 200,
      success: true,
      message: "Login successful",
      data: { token: "t", expireAt: "soon", refreshToken: "r", refreshExpireAt: "later" },
    });
    expect(await verifyOtpAction(OTP)).toEqual({
      success: false,
      error: "Sign in failed. Please try again.",
    });
    expect(jar.has("creaw_session")).toBe(false);
  });

  it("keeps the challenge after a wrong code and creates no session", async () => {
    await loginAction("judy.mwangi", "creaw-demo", true);
    expect(await verifyOtpAction("000000")).toEqual({
      success: false,
      error: "That code isn’t right. Check the latest SMS and try again.",
    });
    expect(jar.has("creaw_session")).toBe(false);
    expect(await verifyOtpAction(OTP)).toMatchObject({ success: true });
  });

  it("sends the user back to sign in once the challenge is gone", async () => {
    expect(await verifyOtpAction(OTP)).toMatchObject({ success: false, expired: true });
    await loginAction("judy.mwangi", "creaw-demo", true);
    for (let attempt = 0; attempt < 4; attempt++) await verifyOtpAction("000000");
    expect(await verifyOtpAction("000000")).toMatchObject({ success: false, expired: true });
    expect(jar.has("creaw_login_challenge")).toBe(false);
    expect(jar.has("creaw_session")).toBe(false);
  });

  it("rejects anything but six digits", async () => {
    await loginAction("judy.mwangi", "creaw-demo", true);
    expect(await verifyOtpAction("24681")).toEqual({
      success: false,
      error: "Enter the 6-digit code.",
    });
    expect(await verifyOtpAction(246810 as unknown as string)).toMatchObject({ success: false });
  });

  it("resends a code only while a challenge is open", async () => {
    expect(await resendOtpAction()).toMatchObject({ success: false, expired: true });
    await loginAction("judy.mwangi", "creaw-demo", true);
    expect(await resendOtpAction()).toEqual({ success: true });
    expect(await verifyOtpAction(OTP)).toMatchObject({ success: true });
  });
});

describe("logout", () => {
  it("revokes both tokens and removes every session cookie", async () => {
    const token = await signIn();
    const refreshToken = jar.get("creaw_refresh")!;
    await logoutAction();
    for (const name of ["creaw_session", "creaw_refresh", "creaw_session_meta"])
      expect(cookieStore.delete).toHaveBeenCalledWith(name);
    expect((await me(token)).resultCode).toBe(401);
    const refreshed = await createPortalApiClient().request(
      {
        method: "POST",
        path: "/auth/refresh",
        routeTemplate: "/auth/refresh",
        body: { refreshToken },
      },
      createEnvelopeSchema(z.unknown())
    );
    expect(refreshed.resultCode).toBe(401);
  });

  it("allows a fresh login after revoking a previous token", async () => {
    const oldToken = await signIn();
    await logoutAction();
    const newToken = await signIn();
    expect(newToken).not.toBe(oldToken);
    expect((await me(newToken)).resultCode).toBe(200);
  });
});

describe("password reset", () => {
  it("returns the mock's preview link and replaces the password", async () => {
    const sent = await requestPasswordResetAction("judy.mwangi@creaw.org");
    expect(sent).toEqual({ success: true, previewToken: expect.any(String) });
    expect(await resetPasswordAction(sent.previewToken!, "Str0ng!Passw0rd")).toEqual({
      success: true,
    });
    expect(await loginAction("judy.mwangi", "creaw-demo")).toMatchObject({ success: false });
    expect(await loginAction("judy.mwangi", "Str0ng!Passw0rd")).toMatchObject({ success: true });
  });

  it("never forwards a reset token outside mock mode", async () => {
    stubLiveResponse(200, {
      resultCode: 200,
      success: true,
      message: "OK",
      data: { previewToken: "leaked" },
    });
    expect(await requestPasswordResetAction("judy.mwangi@creaw.org")).toEqual({ success: true });
  });

  it("rejects an invalid email and a weak password before calling the API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await requestPasswordResetAction("judy.mwangi")).toEqual({
      success: false,
      error: "Enter a valid work email address.",
    });
    expect(await resetPasswordAction("any-token", "short")).toEqual({
      success: false,
      error: "Choose a password that meets every requirement.",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports an expired or reused link", async () => {
    expect(await resetPasswordAction(crypto.randomUUID(), "Str0ng!Passw0rd")).toEqual({
      success: false,
      error: "This reset link has expired or was already used. Request a new one.",
    });
  });
});
