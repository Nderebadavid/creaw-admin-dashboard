import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Routes reachable without a session. Everything else under the matcher
// below requires a valid vsla_session cookie.
const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") {
    url.searchParams.set("redirect", request.nextUrl.pathname);
  }
  const response = NextResponse.redirect(url);
  // Clears anything stale/invalid so the login page doesn't inherit it.
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

// Gates every non-public route on a live session. Confirms the cookie's
// token against vsla-identity-service's GET /auth/validate (Redis-backed on
// their end, so this reflects logout/revocation immediately, not just local
// cookie expiry) and forwards the returned identity headers downstream so
// Server Components can read the real signed-in user instead of a stub.
//
// NOTE: the docs say this endpoint is POST -- it isn't. A live GET/POST
// check against the dev environment (2026-09-13) showed POST returns 403
// with an `Allow: GET` header; only GET actually works.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(request);
  }

  const baseUrl = process.env.IDENTITY_SERVICE_BASE_URL;
  if (!baseUrl) {
    console.error("[proxy] IDENTITY_SERVICE_BASE_URL is not set");
    return redirectToLogin(request);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/auth/validate`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[proxy] failed to reach identity service:", err);
    // Can't confirm the session is still valid -- fail closed.
    return redirectToLogin(request);
  }

  if (!upstream.ok) {
    return redirectToLogin(request);
  }

  const requestHeaders = new Headers(request.headers);
  const userId = upstream.headers.get("x-user-id");
  const userRoles = upstream.headers.get("x-user-roles");
  const userGrants = upstream.headers.get("x-user-grants");
  if (userId) requestHeaders.set("x-user-id", userId);
  if (userRoles) requestHeaders.set("x-user-roles", userRoles);
  if (userGrants) requestHeaders.set("x-user-grants", userGrants);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Everything except API routes, static assets, and Next.js internals.
    // /api/auth/login and /api/auth/logout must stay reachable while logged
    // out, and there are no other API routes yet to protect.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
