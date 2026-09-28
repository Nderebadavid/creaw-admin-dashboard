// Client-side entry points for auth. Both call same-origin Next.js route
// handlers (src/app/api/auth/*) that proxy to vsla-identity-service -- the
// base URL and session token never reach the browser directly; the token
// lives in an httpOnly cookie set by the login route.
//
// See vsla-identity-service/docs/api-testing/README.md for the upstream
// contract (POST /auth/login, POST /auth/logout).

export interface AuthResult {
  success: boolean;
  error?: string;
  requirePasswordChange?: boolean;
}

async function postJson(url: string, body?: unknown): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { success: false, error: "Could not reach the server. Please try again." };
  }

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    return {
      success: false,
      error: data?.message ?? "Something went wrong. Please try again.",
    };
  }

  return { success: true, requirePasswordChange: data.requirePasswordChange };
}

export async function login(username: string, password: string): Promise<AuthResult> {
  return postJson("/api/auth/login", { username, password });
}

export async function logout(): Promise<AuthResult> {
  return postJson("/api/auth/logout");
}
