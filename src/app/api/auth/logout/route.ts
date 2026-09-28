import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Proxies to vsla-identity-service's POST /auth/logout, then clears the local
// session cookie regardless of the upstream result -- the user should never
// get stuck "logged in" locally just because the identity service call failed.
export async function POST() {
  const baseUrl = process.env.IDENTITY_SERVICE_BASE_URL;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token && baseUrl) {
    try {
      await fetch(`${baseUrl}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch (err) {
      console.error("[api/auth/logout] failed to reach identity service:", err);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
