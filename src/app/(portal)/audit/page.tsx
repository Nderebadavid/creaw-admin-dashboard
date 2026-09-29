import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { auditApi } from "@/features/audit/api";
import { AuditContent } from "@/features/audit/components";
import { auditQuerySchema } from "@/features/audit/schemas";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; targetId?: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.grants, "AUDIT_LOG_VIEW")) notFound();
  const params = await searchParams;
  const parsed = auditQuerySchema.safeParse({
    page: 1,
    pageSize: 25,
    module: params.module || undefined,
    targetId: params.targetId ? Number(params.targetId) : undefined,
  });
  if (!parsed.success) notFound();
  const initial = await auditApi.list(parsed.data);
  return (
    <>
      <PageHeading
        title="Audit log"
        section="Reporting"
        description="A trace of changes across the portal and integrations"
      />
      <AuditContent
        initial={initial}
        initialQuery={parsed.data}
        canExport={hasPermission(session.grants, "REPORT_EXPORT_CSV")}
      />
    </>
  );
}
