import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { grantsApi } from "@/features/grants/api";
import { GrantDetailContent } from "@/features/grants/components";
export default async function GrantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "GRANT_APPLICATION_VIEW")) notFound();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const detail = await grantsApi.get(Number(id));
  if (
    !detail ||
    !hasPermission(session.grants, "GRANT_APPLICATION_VIEW", { pillarId: detail.pillarId })
  )
    notFound();
  const code = detail.nextStatus
    ? {
        PREPARED: "GRANT_APPLICATION_PREPARE",
        REVIEWED: "GRANT_APPLICATION_REVIEW",
        APPROVED: "GRANT_APPLICATION_APPROVE",
      }[detail.nextStatus]
    : "";
  const distinctActor =
    detail.nextStatus === "REVIEWED"
      ? detail.signoffs.preparedBy !== session.user.id
      : detail.nextStatus === "APPROVED"
        ? ![detail.signoffs.preparedBy, detail.signoffs.reviewedBy].includes(session.user.id)
        : true;
  return (
    <GrantDetailContent
      heading={{
        title: "Grant application",
        section: "Records",
        description: `${detail.applicant} · ${detail.project}`,
      }}
      detail={detail}
      canAdvance={Boolean(
        code && distinctActor && hasPermission(session.grants, code, { pillarId: detail.pillarId })
      )}
      canSendBack={
        detail.previousStatus !== null &&
        hasPermission(
          session.grants,
          {
            PREPARED: "GRANT_APPLICATION_PREPARE",
            REVIEWED: "GRANT_APPLICATION_REVIEW",
            APPROVED: "GRANT_APPLICATION_APPROVE",
          }[detail.status as "PREPARED" | "REVIEWED" | "APPROVED"] ?? "",
          { pillarId: detail.pillarId }
        )
      }
      canDisburse={hasPermission(session.grants, "GRANT_DISBURSEMENT_RECORD", {
        pillarId: detail.pillarId,
      })}
      canDownload={hasPermission(session.grants, "DOCUMENT_DOWNLOAD", {
        pillarId: detail.pillarId,
      })}
      canLogReport={hasPermission(session.grants, "GRANT_REPORT_MANAGE", {
        pillarId: detail.pillarId,
      })}
    />
  );
}
