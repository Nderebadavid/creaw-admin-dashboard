import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { reportingApi } from "@/features/reporting/api";
import { ReportingContent } from "@/features/reporting/components";
export default async function ReportingPage() {
  const session = await requireSession();
  if (
    !hasModulePermission(session.grants, "NARRATIVE_REPORT_MANAGE") &&
    !hasModulePermission(session.grants, "GRANT_REPORT_VIEW")
  )
    notFound();
  const [initial, catalog] = await Promise.all([
    reportingApi.list({ page: 1, pageSize: 25 }),
    reportingApi.catalog(),
  ]);
  const narrativePillars = catalog.pillars
    .filter((row) => hasPermission(session.grants, "NARRATIVE_REPORT_MANAGE", { pillarId: row.id }))
    .map((row) => row.id);
  const grantPillars = catalog.pillars
    .filter((row) => hasPermission(session.grants, "GRANT_REPORT_MANAGE", { pillarId: row.id }))
    .map((row) => row.id);
  return (
    <ReportingContent
      heading={{
        title: "Reporting calendar",
        section: "Reporting",
        description: "Donor and grant reports across pillars",
      }}
      initial={initial}
      catalog={catalog}
      canManage={narrativePillars.length > 0}
      canExport={hasModulePermission(session.grants, "REPORT_EXPORT_CSV")}
      narrativePillars={narrativePillars}
      grantPillars={grantPillars}
    />
  );
}
