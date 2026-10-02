import "server-only";
import { z } from "zod";
import { postAuth } from "./auth-request";
import { REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_META_COOKIE_NAME } from "./session";
import { parseApiTime } from "./token-time";

/** Refresh this long before the access token runs out, so a request never starts on a dying token. */
export const REFRESH_AHEAD_MS = 60_000;

const tokenPairData = z.object({
  token: z.string().min(1),
  expireAt: z.string(),
  refreshToken: z.string().min(1),
  refreshExpireAt: z.string(),
});

/** The token pair the API returns on sign-in and refresh, with expiry as epoch milliseconds. */
export interface TokenPair {
  token: string;
  expiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

/** The token pair in an envelope's `data`, or null when it is off-contract. */
export function parseTokenPair(data: unknown): TokenPair | null {
  const parsed = tokenPairData.safeParse(data);
  if (!parsed.success) return null;
  const expiresAt = parseApiTime(parsed.data.expireAt);
  const refreshExpiresAt = parseApiTime(parsed.data.refreshExpireAt);
  if (expiresAt === null || refreshExpiresAt === null) return null;
  return {
    token: parsed.data.token,
    expiresAt,
    refreshToken: parsed.data.refreshToken,
    refreshExpiresAt,
  };
}

/** What the session meta cookie holds. */
export interface SessionMeta {
  expiresAt: number;
  remember: boolean;
}

const sessionMeta = z.object({ expiresAt: z.number(), remember: z.boolean() });

export function readSessionMeta(value: string | undefined): SessionMeta | null {
  if (!value) return null;
  try {
    return sessionMeta.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge?: number;
}

/** The part of `cookies()` and `NextResponse.cookies` that writes cookies. */
export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
}

export const protectedCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/**
 * Stores a token pair. A remembered session outlives the browser until the refresh token
 * expires; otherwise every cookie ends with the browser session. The access cookie never
 * outlives its token, so a missing access cookie means "refresh first".
 */
export function writeSessionCookies(
  cookies: CookieWriter,
  pair: TokenPair,
  remember: boolean,
  now = Date.now()
) {
  const lasting = (until: number) =>
    remember ? { maxAge: Math.max(0, Math.floor((until - now) / 1000)) } : {};
  cookies.set(SESSION_COOKIE_NAME, pair.token, { ...protectedCookie, ...lasting(pair.expiresAt) });
  cookies.set(REFRESH_COOKIE_NAME, pair.refreshToken, {
    ...protectedCookie,
    ...lasting(pair.refreshExpiresAt),
  });
  const meta: SessionMeta = { expiresAt: pair.expiresAt, remember };
  cookies.set(SESSION_META_COOKIE_NAME, JSON.stringify(meta), {
    ...protectedCookie,
    ...lasting(pair.refreshExpiresAt),
  });
}

export function clearSessionCookies(cookies: CookieWriter) {
  cookies.delete(SESSION_COOKIE_NAME);
  cookies.delete(REFRESH_COOKIE_NAME);
  cookies.delete(SESSION_META_COOKIE_NAME);
}

/** The access token is missing, or expires within `REFRESH_AHEAD_MS`. */
export function needsRefresh(
  accessToken: string | undefined,
  meta: SessionMeta | null,
  now = Date.now()
): boolean {
  return !accessToken || (meta !== null && meta.expiresAt - now <= REFRESH_AHEAD_MS);
}

export type RefreshOutcome =
  | { status: "refreshed"; pair: TokenPair }
  /** The refresh token is no longer valid: the user must sign in again. */
  | { status: "rejected" }
  /** The API could not be reached or failed; the session may still be good. */
  | { status: "unavailable" };

/** Exchanges a refresh token for a new pair through `POST /auth/refresh`. */
export async function refreshSession(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const response = await postAuth("/auth/refresh", { refreshToken });
    if (response.success) {
      const pair = parseTokenPair(response.data);
      return pair ? { status: "refreshed", pair } : { status: "rejected" };
    }
    return response.resultCode >= 500 ? { status: "unavailable" } : { status: "rejected" };
  } catch {
    return { status: "unavailable" };
  }
}
