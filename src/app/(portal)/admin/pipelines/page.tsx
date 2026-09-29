import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { createAdminApi } from "@/features/admin/api";
import { PipelineContent } from "@/features/admin/pipeline-components";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export default async function PipelinesPage() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "PILLAR_CONFIG_MANAGE")) notFound();
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) notFound();
  const api = createAdminApi(createPortalApiClient(), token);
  const [pillars, pipelinesPage] = await Promise.all([api.pipelinePillars(), api.pipelines()]);
  const pipelines = await Promise.all(pipelinesPage.items.map(async pipeline => ({ ...pipeline, stages: (await api.stages(pipeline.id)).items })));
  return <><PageHeading title="Pipeline & stage configuration" section="Admin" description="Configure each pillar’s participant pathway" /><PipelineContent pillars={pillars} pipelines={pipelines} canViewAudit={hasPermission(session.grants, "AUDIT_LOG_VIEW")} /></>;
}
