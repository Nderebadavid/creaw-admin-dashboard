import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { pillarLookBySlug } from "@/components/portal/pillars";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { dashboardApi } from "@/features/dashboard/api";
import { DashboardContent } from "@/features/dashboard/components";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string | string[];
    pillar?: string | string[];
    funnel?: string | string[];
  }>;
}) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW")) notFound();
  const { year: rawYear, pillar: rawPillar, funnel: rawFunnel } = await searchParams;
  // The chart offers this year and the six before it.
  const thisYear = new Date().getFullYear();
  const asked = typeof rawYear === "string" && /^20\d{2}$/.test(rawYear) ? Number(rawYear) : 0;
  const year = String(asked > thisYear - 7 && asked <= thisYear ? asked : thisYear);
  const chartPillar = typeof rawPillar === "string" ? pillarLookBySlug(rawPillar)?.slug : undefined;
  const funnelPillar =
    typeof rawFunnel === "string" ? pillarLookBySlug(rawFunnel)?.slug : undefined;
  const overview = await dashboardApi.getOverview(year, chartPillar, funnelPillar);
  return (
    <>
      <PageHeading title="MERL overview" section="Overview" />
      <DashboardContent
        overview={overview}
        year={year}
        chartPillar={chartPillar}
        canViewSubmissions={hasModulePermission(session.grants, "FIELD_SUBMISSION_VIEW")}
        canViewParticipants={hasModulePermission(session.grants, "PARTICIPANT_VIEW")}
        // /audit needs a platform-wide grant, like the sidebar link.
        canViewAudit={hasPermission(session.grants, "AUDIT_LOG_VIEW")}
      />
    </>
  );
}
