import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { auditApi } from "@/features/audit/api";
import { AuditContent } from "@/features/audit/components";

export default async function AuditPage() {
  const session = await requireSession();
  if (!hasPermission(session.grants, "AUDIT_LOG_VIEW")) notFound();
  const initial = await auditApi.list({ page: 1, pageSize: 25 });
  return <><PageHeading title="Audit log" section="Reporting" description="A trace of changes across the portal and integrations" /><AuditContent initial={initial} canExport={hasPermission(session.grants, "REPORT_EXPORT_CSV")} /></>;
}
