import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission } from "@/lib/auth/permissions";
import { grantsApi } from "@/features/grants/api";
import { GrantsContent } from "@/features/grants/components";
export default async function GrantsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "GRANT_APPLICATION_VIEW")) notFound();
  const [initial, pillars] = await Promise.all([grantsApi.list({ page: 1, pageSize: 25 }), grantsApi.pillars()]);
  return <><PageHeading title="Grants" section="Records" description="WEE business grants and WRO sub-grants" /><GrantsContent initial={initial} pillars={pillars} canExport={hasModulePermission(session.grants, "REPORT_EXPORT_CSV")} /></>;
}
