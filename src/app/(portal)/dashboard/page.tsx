import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { hasModulePermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { dashboardApi } from "@/features/dashboard/api";
import { DashboardContent } from "@/features/dashboard/components";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "DASHBOARD_VIEW")) notFound();
  const rawYear = (await searchParams).year;
  const year = typeof rawYear === "string" && /^(2025|2026)$/.test(rawYear) ? rawYear : "2026";
  const overview = await dashboardApi.getOverview(year);
  return (
    <>
      <PageHeading
        title="MERL overview"
        section="Overview"
        description={`Welcome, ${session.user.firstName}. Your programme snapshot for Q3 ${year}.`}
      />
      <DashboardContent
        overview={overview}
        year={year}
        canViewSubmissions={hasModulePermission(session.grants, "FIELD_SUBMISSION_VIEW")}
      />
    </>
  );
}
