import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { submissionsApi } from "@/features/submissions/api";
import { SubmissionsContent } from "@/features/submissions/components";

export default async function FieldSubmissionsPage() {
  const session = await requireSession();
  if (!hasPermission(session.grants, "FIELD_SUBMISSION_VIEW")) notFound();
  const list = await submissionsApi.list({ pageSize: 100 });
  return <><PageHeading title="Field submissions" section="Overview" description="Data captured on the MERL mobile app, waiting for verification" /><SubmissionsContent rows={list.items} canReview={hasPermission(session.grants, "FIELD_SUBMISSION_REVIEW")} canExport={hasPermission(session.grants, "REPORT_EXPORT_CSV")} /></>;
}
