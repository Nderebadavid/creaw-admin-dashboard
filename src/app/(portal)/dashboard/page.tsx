import { requireSession } from "@/lib/auth/session-server";
import { PageHeading } from "@/components/portal/page-heading";
import { AlertBanner } from "@/components/ui/alert-banner";
export default async function DashboardPage() {
  const {user,grants} = await requireSession();
  return <><PageHeading title="MERL overview" section="Overview" description={`Welcome, ${user.firstName}.`} /><AlertBanner tone="info">{grants.some(grant => grant.permissionCode === "DASHBOARD_VIEW") ? "Your CREAW workspace is ready. Programme summaries will appear here." : "Your account has no dashboard access. Contact an administrator to review your permissions."}</AlertBanner></>;
}
