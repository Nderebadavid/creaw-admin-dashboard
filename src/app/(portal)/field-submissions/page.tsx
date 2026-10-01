import { notFound } from "next/navigation";
import { hasModulePermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { submissionsApi } from "@/features/submissions/api";
import { SubmissionsContent } from "@/features/submissions/components";

/** Pillar ids whose grants include a permission; module-wide grants cover every pillar. */
const pillarsWith = (
  grants: readonly { permissionCode: string; pillarId: number | null }[],
  code: string
) => {
  const own = grants.filter((grant) => grant.permissionCode === code);
  return own.some((grant) => grant.pillarId === null)
    ? [1, 2, 3, 4, 5, 6]
    : own.map((grant) => grant.pillarId).filter((id): id is number => id !== null);
};

export default async function FieldSubmissionsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "FIELD_SUBMISSION_VIEW")) notFound();
  const initial = await submissionsApi.list({ page: 1, pageSize: 12 });
  return (
    <SubmissionsContent
      heading={{
        title: "Field submissions",
        section: "Overview",
        description: "Data captured on the MERL mobile app, waiting for verification",
      }}
      initial={initial}
      reviewablePillarIds={pillarsWith(session.grants, "FIELD_SUBMISSION_REVIEW")}
      canExport={hasModulePermission(session.grants, "REPORT_EXPORT_CSV")}
      exportablePillarIds={pillarsWith(session.grants, "REPORT_EXPORT_CSV")}
    />
  );
}
