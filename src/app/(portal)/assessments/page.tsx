import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { assessmentsApi } from "@/features/assessments/api";
import { AssessmentsContent } from "@/features/assessments/components";
export default async function AssessmentsPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "ORG_ASSESSMENT_VIEW")) notFound();
  const initial = await assessmentsApi.list(1, 25);
  return (
    <AssessmentsContent
      heading={{
        title: "Organisation assessments",
        section: "Records",
        description: "WRO partner capacity scoring and due diligence",
      }}
      initial={initial}
      canRecommend={hasPermission(session.grants, "ORG_ASSESSMENT_EDIT", { pillarId: 5 })}
      canApprove={hasPermission(session.grants, "ORG_ASSESSMENT_APPROVE", { pillarId: 5 })}
      canAttach={
        hasPermission(session.grants, "DUE_DILIGENCE_MANAGE", { pillarId: 5 }) &&
        hasPermission(session.grants, "DOCUMENT_UPLOAD", { pillarId: 5 })
      }
      canDownload={hasPermission(session.grants, "DOCUMENT_DOWNLOAD", { pillarId: 5 })}
    />
  );
}
