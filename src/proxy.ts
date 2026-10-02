import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_META_COOKIE_NAME,
} from "@/lib/auth/session";
import {
  clearSessionCookies,
  needsRefresh,
  readSessionMeta,
  refreshSession,
  writeSessionCookies,
} from "@/lib/auth/tokens";

// Routes reachable without a session. Everything else under the matcher
// below requires a CREAW session cookie.
const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Sends the user to sign in. Stale or rejected cookies are cleared so the login page
 * doesn't inherit them; `keepCookies` leaves a refresh token that may still be good.
 */
function redirectToLogin(request: NextRequest, { keepCookies = false } = {}): NextResponse {
  const url = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") {
    url.searchParams.set("redirect", request.nextUrl.pathname);
  }
  const response = NextResponse.redirect(url);
  if (!keepCookies) clearSessionCookies(response.cookies);
  return response;
}

// Proxy performs the fast, optimistic cookie check recommended by Next.js 16, and keeps
// the short-lived access token fresh: when it is missing or about to expire, it is renewed
// with the refresh token before the page or Server Action runs. Portal layouts and every
// Server Action still authoritatively validate the token through /auth/me.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const meta = readSessionMeta(request.cookies.get(SESSION_META_COOKIE_NAME)?.value);
  if (!refreshToken || !needsRefresh(token, meta)) {
    return token ? NextResponse.next() : redirectToLogin(request);
  }

  const outcome = await refreshSession(refreshToken);
  if (outcome.status === "rejected") return redirectToLogin(request);
  // An unreachable API leaves the current token to stand or fall on its own, and keeps
  // the refresh token for the next request to try again.
  if (outcome.status === "unavailable") {
    return token ? NextResponse.next() : redirectToLogin(request, { keepCookies: true });
  }

  // The request carries the new cookies on to the page or Server Action, and the
  // response stores them in the browser.
  const remember = meta?.remember ?? false;
  // Request cookies take a name and value only; writing them also rewrites the Cookie header.
  writeSessionCookies(
    {
      set: (name, value) => request.cookies.set(name, value),
      delete: (name) => request.cookies.delete(name),
    },
    outcome.pair,
    remember
  );
  const response = NextResponse.next({ request: { headers: new Headers(request.headers) } });
  writeSessionCookies(response.cookies, outcome.pair, remember);
  return response;
}

export const config = {
  matcher: [
    // The optimizer fetches the public logo source without a session cookie.
    "/((?!api|_next/static|_next/image|favicon.ico|creaw-logo\\.png$).*)",
  ],
};
