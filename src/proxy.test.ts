import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "./proxy";

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows a cookie-bearing request without making a network call", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const request = new NextRequest("http://localhost/dashboard", {
      headers: { cookie: "creaw_session=mock-user-1" },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redirects a protected request without a cookie to login", () => {
    const response = proxy(new NextRequest("http://localhost/referrals"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?redirect=%2Freferrals",
    );
  });

  it("keeps login public", () => {
    const response = proxy(new NextRequest("http://localhost/login"));

    expect(response.status).toBe(200);
  });

  it("exempts the two supplied public images while protecting portal routes", () => {
    for (const url of ["/creaw-logo.png", "/login-wvl.png"]) {
      expect(unstable_doesMiddlewareMatch({config, nextConfig:{}, url})).toBe(false);
    }
    expect(unstable_doesMiddlewareMatch({config, nextConfig:{}, url:"/dashboard"})).toBe(true);
    expect(unstable_doesMiddlewareMatch({config, nextConfig:{}, url:"/participants"})).toBe(true);
  });
});
