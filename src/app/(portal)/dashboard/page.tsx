import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { pillarLookBySlug } from "@/components/portal/pillars";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { dashboardApi } from "@/features/dashboard/api";
import { DashboardContent } from "@/features/dashboard/components";
import { DashboardLocationFilter } from "@/features/dashboard/sections/chart-filters";
import { cleanLocation } from "@/lib/api/location";
import { periodFromParams } from "@/lib/dashboard-period";

type Param = string | string[] | undefined;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: Param;
    to?: Param;
    pillar?: Param;
    funnel?: Param;
    countyId?: Param;
    subCountyId?: Param;
    wardId?: Param;
  }>;
}) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW")) notFound();
  const params = await searchParams;
  // The header's period picker writes `from` and `to`; the current quarter so far by default.
  const period = periodFromParams(params.from, params.to);
  const location = cleanLocation({
    countyId: Number(params.countyId),
    subCountyId: Number(params.subCountyId),
    wardId: Number(params.wardId),
  });
  const slug = (value: Param) =>
    typeof value === "string" ? pillarLookBySlug(value)?.slug : undefined;
  const chartPillar = slug(params.pillar);
  const overview = await dashboardApi.getOverview(
    period,
    chartPillar,
    slug(params.funnel),
    location
  );
  return (
    <>
      <PageHeading title="MERL overview" section="Overview" actions={<DashboardLocationFilter />} />
      <DashboardContent
        overview={overview}
        chartPillar={chartPillar}
        canViewSubmissions={hasModulePermission(session.grants, "FIELD_SUBMISSION_VIEW")}
        canViewParticipants={hasModulePermission(session.grants, "PARTICIPANT_VIEW")}
        // /audit needs a platform-wide grant, like the sidebar link.
        canViewAudit={hasPermission(session.grants, "AUDIT_LOG_VIEW")}
      />
    </>
  );
}
