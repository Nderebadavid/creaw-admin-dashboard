"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { SESSION_COOKIE_NAME } from "./session";

export interface AuthActionResult {
  success: boolean;
  error?: string;
}
const authEnvelope = z.object({
  resultCode: z.number(),
  success: z.boolean(),
  message: z.string(),
  data: z.unknown(),
});

export async function loginAction(
  username: string,
  password: string,
  remember = true
): Promise<AuthActionResult> {
  if (
    typeof username !== "string" ||
    !username.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return { success: false, error: "Enter your email or username and password." };
  }
  try {
    const response = await createPortalApiClient().request(
      {
        method: "POST",
        path: "/auth/login",
        routeTemplate: "/auth/login",
        body: { username: username.trim(), password },
      },
      authEnvelope
    );
    if (!response.success) return { success: false, error: response.message };
    const data = z.object({ token: z.string().min(1) }).safeParse(response.data);
    if (!data.success) return { success: false, error: "Sign in failed. Please try again." };
    (await cookies()).set(SESSION_COOKIE_NAME, data.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(remember ? { maxAge: 60 * 60 * 12 } : {}),
    });
    return { success: true };
  } catch {
    return {
      success: false,
      error: "Could not reach the authentication service. Please try again.",
    };
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      await createPortalApiClient().request(
        {
          method: "POST",
          path: "/auth/logout",
          routeTemplate: "/auth/logout",
          token,
        },
        authEnvelope
      );
    } catch {
      // A failed upstream logout must not leave the browser signed in.
    }
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
