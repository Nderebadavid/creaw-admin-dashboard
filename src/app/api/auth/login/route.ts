import { NextResponse } from "next/server";
import {
  cookieMaxAgeSeconds,
  SESSION_COOKIE_NAME,
  unwrapEnvelope,
  type AuthResponsePayload,
  type IdentityServiceEnvelope,
} from "@/lib/auth/session";

// Proxies to vsla-identity-service's POST /auth/login (docs/api-testing/README.md
// in that repo). Keeps IDENTITY_SERVICE_BASE_URL and the session token off the
// client entirely -- the token is set as an httpOnly cookie, never returned in
// the JSON body.
export async function POST(request: Request) {
  const baseUrl = process.env.IDENTITY_SERVICE_BASE_URL;
  if (!baseUrl) {
    console.error("IDENTITY_SERVICE_BASE_URL is not set");
    return NextResponse.json(
      { success: false, message: "Login is not configured on the server." },
      { status: 500 }
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body." },
      { status: 400 }
    );
  }

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return NextResponse.json(
      { success: false, message: "Username and password are required." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[api/auth/login] failed to reach identity service:", err);
    return NextResponse.json(
      { success: false, message: "Could not reach the authentication service." },
      { status: 502 }
    );
  }

  let data: IdentityServiceEnvelope<AuthResponsePayload> | null = null;
  try {
    data = await upstream.json();
  } catch {
    // Non-JSON response from upstream -- fall through, `data` stays null.
  }

  const payload = unwrapEnvelope(data);

  if (!upstream.ok || !data?.success || !payload) {
    return NextResponse.json(
      {
        success: false,
        message: data?.message ?? "Login failed. Please check your credentials.",
      },
      { status: upstream.status >= 400 ? upstream.status : 401 }
    );
  }

  const { token, expireAt, requirePasswordChange } = payload;

  const response = NextResponse.json({
    success: true,
    requirePasswordChange: requirePasswordChange ?? false,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookieMaxAgeSeconds(expireAt),
  });

  return response;
}
