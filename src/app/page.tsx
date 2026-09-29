import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session-server";

// Proxy only checks cookie presence; resolve the session so a stale cookie
// lands on login instead of bouncing through the portal layout.
export default async function Home() {
  redirect((await getSession()) ? "/dashboard" : "/login");
}
