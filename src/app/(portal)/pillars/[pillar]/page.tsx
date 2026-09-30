import { notFound } from "next/navigation";
import { AlertBanner } from "@/components/ui/alert-banner";
import { hasModulePermission, hasPermission, type EffectiveGrant } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { pillarsApi, PillarApiError } from "@/features/pillars/api";
import { PillarContent } from "@/features/pillars/components";
import {
  PillarCreateButton,
  PillarDomainCreateButton,
  PillarEditButton,
} from "@/features/pillars/record-controls";
import { pillarCodeSchema, type PillarCode } from "@/features/pillars/schemas";
import { submissionsApi } from "@/features/submissions/api";
import { assessmentsApi } from "@/features/assessments/api";
import { wrosApi } from "@/features/wros/api";
import { vawgApi } from "@/features/vawg/api";
import { CaseRegister } from "@/features/vawg/components/case-register";
import { VawgHeadingActions } from "@/features/vawg/components/heading-actions";
import { VawgSummaryCards } from "@/features/vawg/components/summary-cards";
import { OrganisationRegister } from "@/features/wros/components/organisation-register";

const ids: Record<PillarCode, number> = {
  vawg: 1,
  wee: 2,
  srhr: 3,
  leadership: 4,
  wros: 5,
  skilling: 6,
};

/** The permission that lets a user add records to each pillar's domain register. */
const domainPermission = {
  vawg: "CASE_EDIT",
  wee: "GRANT_APPLICATION_EDIT",
  srhr: "ACTIVITY_SESSION_LOG",
  skilling: "TRAINING_ENROLLMENT_EDIT",
  wros: "ORGANISATION_EDIT",
  leadership: "PILLAR_CONFIG_MANAGE",
} as const satisfies Record<PillarCode, string>;

/** This pillar's field submissions, or none when the user can't view them here. */
async function loadSubmissions(grants: readonly EffectiveGrant[], pillarId: number) {
  if (!hasPermission(grants, "FIELD_SUBMISSION_VIEW", { pillarId })) return [];
  const all = await submissionsApi.listAll().catch(() => []);
  return all.filter((row) => row.pillarId === pillarId);
}

/**
 * The VAWG case workspace, none for other pillars and users without case access there,
 * or "failed" when it can't load (the page then degrades instead of erroring).
 */
async function loadVawgWorkspace(grants: readonly EffectiveGrant[], code: PillarCode) {
  const pillarId = ids.vawg;
  const allowed =
    code === "vawg" &&
    hasPermission(grants, "CASE_VIEW", { pillarId }) &&
    hasPermission(grants, "PARTICIPANT_VIEW", { pillarId });
  if (!allowed) return undefined;
  return vawgApi.workspace().catch(() => "failed" as const);
}

/** The WRO partner register with the options its dialogs need, trimmed to the user's grants. */
async function loadWroRegister(grants: readonly EffectiveGrant[], pillarId: number) {
  const can = (code: string) => hasPermission(grants, code, { pillarId });
  const canRegister = can("ORGANISATION_EDIT") && can("PARTICIPANT_EDIT");
  const [organisations, wards, assessmentOptions] = await Promise.all([
    wrosApi.list(),
    canRegister ? wrosApi.wardOptions().catch(() => []) : [],
    can("ORG_ASSESSMENT_EDIT") ? assessmentsApi.options().catch(() => undefined) : undefined,
  ]);
  return (
    <OrganisationRegister
      organisations={organisations}
      wards={wards}
      assessmentOptions={assessmentOptions}
      canRegister={canRegister}
      canMove={can("ORGANISATION_EDIT") && can("FIELD_SUBMISSION_REVIEW")}
      canReveal={can("SENSITIVE_REVEAL")}
    />
  );
}

/** The pillar, or null when the API refuses access (404 becomes a not-found page). */
function loadPillar(code: PillarCode) {
  return pillarsApi.get(code).catch((error) => {
    if (error instanceof PillarApiError && error.status === 404) notFound();
    if (error instanceof PillarApiError && error.status === 403) return null;
    throw error;
  });
}

export default async function PillarPage({ params }: { params: Promise<{ pillar: string }> }) {
  const session = await requireSession();
  const code = pillarCodeSchema.safeParse((await params).pillar);
  if (!code.success) notFound();
  // The pillar id is fixed per code, so submissions load alongside the pillar.
  const [pillar, submissions, workspace] = await Promise.all([
    loadPillar(code.data),
    loadSubmissions(session.grants, ids[code.data]),
    loadVawgWorkspace(session.grants, code.data),
  ]);
  if (!pillar)
    return <AlertBanner tone="warning">You do not have access to this pillar.</AlertBanner>;
  const can = (permission: string) =>
    hasPermission(session.grants, permission, { pillarId: pillar.id });
  const availableCodes = (Object.keys(ids) as PillarCode[]).filter((key) =>
    hasPermission(session.grants, "DASHBOARD_VIEW", { pillarId: ids[key] })
  );
  const canEdit = can("PARTICIPANT_EDIT");
  const canCreate = canEdit && pillar.hasPipeline && pillar.code !== "wros";
  // Leadership has no domain register; WRO organisations also need participant edit.
  const canCreateDomain =
    pillar.code !== "leadership" &&
    can(domainPermission[pillar.code]) &&
    (pillar.code !== "wros" || canEdit);
  // WROs carry over the field app's organisation register, profile and pipeline.
  const register =
    pillar.code === "wros" ? await loadWroRegister(session.grants, pillar.id) : undefined;
  const vawgPermissions = {
    edit: can("CASE_EDIT"),
    attach: can("DOCUMENT_UPLOAD"),
    download: can("DOCUMENT_DOWNLOAD"),
    reveal: can("SENSITIVE_REVEAL"),
    export: can("REPORT_EXPORT_CSV"),
  };
  const vawgFailed = workspace === "failed" && pillar.code === "vawg";
  const vawg = workspace !== "failed" && workspace && pillar.code === "vawg";
  return (
    <PillarContent
      register={
        vawg ? (
          <CaseRegister workspace={workspace} can={vawgPermissions} />
        ) : vawgFailed ? (
          <AlertBanner tone="warning">
            The legal case register could not be loaded. Refresh the page to try again.
          </AlertBanner>
        ) : (
          register
        )
      }
      kpis={
        vawg ? (
          <VawgSummaryCards summary={workspace.summary} color={pillar.color} tint={pillar.tint} />
        ) : undefined
      }
      headingActions={
        vawg ? (
          <VawgHeadingActions
            workspace={workspace}
            canExport={vawgPermissions.export}
            canOpenCase={vawgPermissions.edit}
          >
            {canCreate ? (
              <PillarCreateButton code="vawg" name={pillar.name} variant="outline" />
            ) : null}
          </VawgHeadingActions>
        ) : undefined
      }
      heading={{
        title: pillar.fullName,
        section: "Pillars",
        description: vawg
          ? `${pillar.name} pillar · lead ${pillar.leadName ?? "not assigned"}`
          : `${pillar.name} pillar · programme overview`,
      }}
      pillar={pillar}
      canCreate={canCreate}
      canViewSubmissions={hasModulePermission(session.grants, "FIELD_SUBMISSION_VIEW")}
      actions={
        <PillarCreateButton
          code={pillar.code}
          name={pillar.name}
          variant={canCreateDomain ? "outline" : "default"}
        />
      }
      domainActions={
        canCreateDomain && pillar.code !== "wros" ? (
          <PillarDomainCreateButton code={pillar.code} />
        ) : undefined
      }
      rowActions={
        canEdit
          ? (row) => <PillarEditButton code={pillar.code} id={row.id} category={row.category} />
          : undefined
      }
      availableCodes={availableCodes}
      submissions={submissions}
    />
  );
}
