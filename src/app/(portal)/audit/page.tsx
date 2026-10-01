import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { auditApi } from "@/features/audit/api";
import { AuditContent } from "@/features/audit/components";
import { auditQuerySchema } from "@/features/audit/schemas";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; targetId?: string; userId?: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.grants, "AUDIT_LOG_VIEW")) notFound();
  const params = await searchParams;
  const parsed = auditQuerySchema.safeParse({
    page: 1,
    pageSize: 25,
    module: params.module || undefined,
    targetId: params.targetId ? Number(params.targetId) : undefined,
    // Set by the account menu's "My activity" link.
    userId: params.userId ? Number(params.userId) : undefined,
  });
  if (!parsed.success) notFound();
  const initial = await auditApi.list(parsed.data);
  return (
    <AuditContent
      heading={{
        title: "Audit log",
        section: "Reporting",
        description: "Every create, edit, upload and export — portal and mobile",
      }}
      initial={initial}
      initialQuery={parsed.data}
      canExport={hasPermission(session.grants, "REPORT_EXPORT_CSV")}
    />
  );
}
