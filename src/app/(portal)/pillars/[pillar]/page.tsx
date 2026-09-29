import { notFound } from "next/navigation";
import { PageHeading } from "@/components/portal/page-heading";
import { AlertBanner } from "@/components/ui/alert-banner";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { pillarsApi, PillarApiError } from "@/features/pillars/api";
import { PillarContent } from "@/features/pillars/components";
import { PillarCreateButton, PillarDomainCreateButton, PillarEditButton } from "@/features/pillars/record-controls";
import { pillarCodeSchema, type PillarCode } from "@/features/pillars/schemas";
import { submissionsApi } from "@/features/submissions/api";

const ids: Record<PillarCode, number> = { vawg: 1, wee: 2, srhr: 3, leadership: 4, wros: 5, skilling: 6 };

export default async function PillarPage({ params }: { params: Promise<{ pillar: string }> }) {
  const session = await requireSession();
  const code = pillarCodeSchema.safeParse((await params).pillar);
  if (!code.success) notFound();
  const pillar = await pillarsApi.get(code.data).catch(error => {
    if (error instanceof PillarApiError && error.status === 404) notFound();
    if (error instanceof PillarApiError && error.status === 403) return null;
    throw error;
  });
  if (!pillar) return <AlertBanner tone="warning">You do not have access to this pillar.</AlertBanner>;
  const availableCodes = (Object.keys(ids) as PillarCode[]).filter(key => hasPermission(session.grants, "DASHBOARD_VIEW", { pillarId: ids[key] }));
  const canEdit = hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: pillar.id });
  const canCreate = canEdit && pillar.hasPipeline && pillar.code !== "wros";
  const domainPermission = ({ vawg: "CASE_EDIT", wee: "GRANT_APPLICATION_EDIT", srhr: "ACTIVITY_SESSION_LOG", skilling: "TRAINING_ENROLLMENT_EDIT", wros: "ORGANISATION_EDIT", leadership: "PILLAR_CONFIG_MANAGE" } as const)[pillar.code];
  const canCreateDomain = pillar.code !== "leadership" && hasPermission(session.grants, domainPermission, { pillarId: pillar.id }) &&
    (pillar.code !== "wros" || hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: pillar.id }));
  const submissions = hasPermission(session.grants, "FIELD_SUBMISSION_VIEW", { pillarId: pillar.id }) ? await submissionsApi.listAll().then(list => list.filter(row => row.pillarId === pillar.id)).catch(() => []) : [];
  return <><PageHeading title={pillar.fullName} section="Pillars" description={`${pillar.name} pillar · programme overview`} /><PillarContent pillar={pillar} canCreate={canCreate} canViewSubmissions={hasModulePermission(session.grants, "FIELD_SUBMISSION_VIEW")} actions={<PillarCreateButton code={pillar.code} name={pillar.name} />} domainActions={canCreateDomain ? <PillarDomainCreateButton code={pillar.code} /> : undefined} rowActions={canEdit ? row => <PillarEditButton code={pillar.code} id={row.id} category={row.category} /> : undefined} availableCodes={availableCodes} submissions={submissions} /></>;
}
