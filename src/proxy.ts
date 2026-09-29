import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Routes reachable without a session. Everything else under the matcher
// below requires a CREAW session cookie.
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

// Proxy performs only the fast, optimistic cookie-presence check recommended
// by Next.js 16. Portal layouts and every Server Action authoritatively
// validate the token through /auth/me and re-check permissions.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except static assets and Next.js internals.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
