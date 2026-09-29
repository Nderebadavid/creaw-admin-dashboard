import { requireSession } from "@/lib/auth/session-server";
import { PortalShell } from "@/components/portal/portal-shell";
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <PortalShell session={session}>{children}</PortalShell>;
}
