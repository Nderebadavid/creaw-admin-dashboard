import { notFound } from "next/navigation";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { submissionsApi } from "@/features/submissions/api";
import { SubmissionsContent } from "@/features/submissions/components";

export default async function FieldSubmissionsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "FIELD_SUBMISSION_VIEW")) notFound();
  const rows = (await submissionsApi.listAll()).filter(
    (row) =>
      row.pillarId !== null &&
      hasPermission(session.grants, "FIELD_SUBMISSION_VIEW", { pillarId: row.pillarId })
  );
  const reviewableIds = rows
    .filter(
      (row) =>
        row.pillarId !== null &&
        hasPermission(session.grants, "FIELD_SUBMISSION_REVIEW", { pillarId: row.pillarId })
    )
    .map((row) => row.id);
  const exportableIds = rows
    .filter(
      (row) =>
        row.pillarId !== null &&
        hasPermission(session.grants, "REPORT_EXPORT_CSV", { pillarId: row.pillarId })
    )
    .map((row) => row.id);
  return (
    <SubmissionsContent
      heading={{
        title: "Field submissions",
        section: "Overview",
        description: "Data captured on the MERL mobile app, waiting for verification",
      }}
      rows={rows}
      reviewableIds={reviewableIds}
      canExport={hasModulePermission(session.grants, "REPORT_EXPORT_CSV")}
      exportableIds={exportableIds}
    />
  );
}
