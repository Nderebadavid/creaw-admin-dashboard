import { requireSession } from "@/lib/auth/session-server";
import { PortalShell } from "@/components/portal/portal-shell";
import { loadNavigationStatus } from "@/components/portal/nav-status";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const status = await loadNavigationStatus(session.grants);
  return (
    <PortalShell session={session} status={status}>
      {children}
    </PortalShell>
  );
}
