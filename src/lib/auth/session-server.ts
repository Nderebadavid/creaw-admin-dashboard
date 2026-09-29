import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createPortalApiClient } from "@/lib/api/portal-client";
import {
  SESSION_COOKIE_NAME,
  toPortalSessionUser,
  type Session,
  type SessionUser,
} from "./session";

export type { SessionUser, Session };

const meSchema = z.object({
  resultCode: z.number(), success: z.boolean(), message: z.string(),
  data: z.union([z.object({
    user: z.object({ id: z.number(), first_name: z.string(), last_name: z.string(), email: z.string().nullable() }),
    grants: z.array(z.object({ permissionCode: z.string(), pillarId: z.number().nullable() })),
  }), z.null()]),
});

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const response = await createPortalApiClient().request({
      method: "GET", path: "/auth/me", routeTemplate: "/auth/me", token,
    }, meSchema);
    if (!response.success || !response.data) return null;
    const { user, grants } = response.data;
    return { user: toPortalSessionUser(user, grants), grants };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}
