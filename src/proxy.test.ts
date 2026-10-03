import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// Next.js patches console with request storage that its server runtime provides and jsdom
// does not; the API logger writes to console while the proxy refreshes.
vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  Object.assign(globalThis, { AsyncLocalStorage });
});

import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { issueMockSession, resetMockStore, resolveMockToken } from "./lib/mock-api/store";
import { config, proxy } from "./proxy";

/** A portal request carrying the given session cookies. */
function requestWith(cookies: Record<string, string>, path = "/dashboard") {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
  return new NextRequest(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });
}

const meta = (expiresAt: number, remember = true) => JSON.stringify({ expiresAt, remember });

/** The cookies the proxy hands on to the page, as Next.js forwards them. */
function forwardedCookies(response: Response): string {
  return response.headers.get("x-middleware-request-cookie") ?? "";
}

describe("proxy", () => {
  beforeEach(() => resetMockStore());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lets a request with a live token through without refreshing", async () => {
    const pair = issueMockSession(1);
    const response = await proxy(
      requestWith({
        creaw_session: pair.token,
        creaw_refresh: pair.refreshToken,
        creaw_session_meta: meta(Date.now() + 10 * 60_000),
      })
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("creaw_session")).toBeUndefined();
  });

  it("redirects a protected request without a cookie to login", async () => {
    const response = await proxy(new NextRequest("http://localhost/referrals"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?redirect=%2Freferrals");
  });

  it("keeps login public", async () => {
    const response = await proxy(new NextRequest("http://localhost/login"));

    expect(response.status).toBe(200);
  });

  it("refreshes a missing access token and hands the new one to the page", async () => {
    const pair = issueMockSession(1);
    const response = await proxy(requestWith({ creaw_refresh: pair.refreshToken }));

    expect(response.status).toBe(200);
    const token = response.cookies.get("creaw_session")?.value;
    expect(token).toBeDefined();
    expect(token).not.toBe(pair.token);
    expect(resolveMockToken(token)).toBe(1);
    expect(response.cookies.get("creaw_refresh")?.value).not.toBe(pair.refreshToken);
    expect(forwardedCookies(response)).toContain(`creaw_session=${token}`);
  });

  it("refreshes a token that expires within a minute and keeps the remember choice", async () => {
    const pair = issueMockSession(1);
    const response = await proxy(
      requestWith({
        creaw_session: pair.token,
        creaw_refresh: pair.refreshToken,
        creaw_session_meta: meta(Date.now() + 30_000, false),
      })
    );

    const refreshed = response.cookies.get("creaw_session");
    expect(refreshed?.value).not.toBe(pair.token);
    expect(refreshed?.maxAge).toBeUndefined();
    expect(JSON.parse(response.cookies.get("creaw_session_meta")!.value).remember).toBe(false);
  });

  it("sends the user to login when the refresh token is rejected", async () => {
    const response = await proxy(
      requestWith({ creaw_session: "stale", creaw_refresh: "revoked", creaw_session_meta: meta(0) })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?redirect=%2Fdashboard");
    for (const name of ["creaw_session", "creaw_refresh", "creaw_session_meta"])
      expect(response.cookies.get(name)?.value).toBe("");
  });

  it.each([
    [429, "rate limited"],
    [408, "timed out"],
    [503, "down"],
  ])("never signs the user out when refresh is %s (%s)", async (status) => {
    vi.stubEnv("PORTAL_API_MODE", "live");
    vi.stubEnv("PORTAL_API_BASE_URL", "https://example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            resultCode: status,
            success: false,
            message: "Try later",
            data: null,
          }),
          { status }
        )
      )
    );
    const response = await proxy(
      requestWith({
        creaw_session: "still-good",
        creaw_refresh: "r",
        creaw_session_meta: meta(Date.now() + 30_000),
      })
    );

    expect(response.status).toBe(200);
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("keeps the refresh token when it cannot refresh an expired session", async () => {
    vi.stubEnv("PORTAL_API_MODE", "live");
    vi.stubEnv("PORTAL_API_BASE_URL", "https://example.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await proxy(requestWith({ creaw_refresh: "still-valid" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?redirect=%2Fdashboard");
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("keeps the current token when the auth service cannot be reached", async () => {
    vi.stubEnv("PORTAL_API_MODE", "live");
    vi.stubEnv("PORTAL_API_BASE_URL", "https://example.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await proxy(
      requestWith({
        creaw_session: "still-good",
        creaw_refresh: "r",
        creaw_session_meta: meta(Date.now() + 30_000),
      })
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get("creaw_session")).toBeUndefined();
  });

  it("exempts the public logo while protecting portal routes", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/creaw-logo.png" })).toBe(
      false
    );
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/dashboard" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/participants" })).toBe(
      true
    );
  });
});
