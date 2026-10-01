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
import { ids, loadSessionsWorkspace, loadVawgWorkspace, loadWroRegister } from "./loaders";
import { submissionsApi } from "@/features/submissions/api";
import { CaseRegister } from "@/features/vawg/components/case-register";
import { VawgHeadingActions } from "@/features/vawg/components/heading-actions";
import { VawgSummaryCards } from "@/features/vawg/components/summary-cards";
import { parsePeriod } from "@/features/sessions/model";
import { SessionSummaryCards } from "@/features/sessions/components/summary-cards";
import { SessionWorkspaceView } from "@/features/sessions/components/session-register";
import { LogSessionButton } from "@/features/sessions/components/session-dialogs";

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

/** The pillar, or null when the API refuses access (404 becomes a not-found page). */
function loadPillar(code: PillarCode) {
  return pillarsApi.get(code).catch((error) => {
    if (error instanceof PillarApiError && error.status === 404) notFound();
    if (error instanceof PillarApiError && error.status === 403) return null;
    throw error;
  });
}

export default async function PillarPage({
  params,
  searchParams,
}: {
  params: Promise<{ pillar: string }>;
  searchParams?: Promise<{ period?: string }>;
}) {
  const session = await requireSession();
  const code = pillarCodeSchema.safeParse((await params).pillar);
  if (!code.success) notFound();
  const period = parsePeriod((await searchParams)?.period);
  // The pillar id is fixed per code, so submissions load alongside the pillar.
  const [pillar, submissions, workspace, sessions] = await Promise.all([
    loadPillar(code.data),
    loadSubmissions(session.grants, ids[code.data]),
    loadVawgWorkspace(session.grants, code.data),
    loadSessionsWorkspace(session.grants, code.data, period, {
      id: session.user.id,
      name: session.user.name,
    }),
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
  const sessionsFailed = sessions === "failed";
  const sessionWorkspace = sessions !== "failed" ? sessions : undefined;
  const sessionPermissions = {
    log: can("ACTIVITY_SESSION_LOG"),
    attach: can("DOCUMENT_UPLOAD"),
    download: can("DOCUMENT_DOWNLOAD"),
    export: can("REPORT_EXPORT_CSV"),
  };
  // SRHR logs sessions through the workspace, never the raw-ID form, even when it failed to load.
  const domainActions =
    (pillar.code === "srhr" && sessions !== undefined) ||
    !canCreateDomain ||
    pillar.code === "wros" ? undefined : (
      <PillarDomainCreateButton code={pillar.code} />
    );
  return (
    <PillarContent
      workspace={
        sessionWorkspace ? (
          <SessionWorkspaceView workspace={sessionWorkspace} can={sessionPermissions} />
        ) : sessionsFailed ? (
          <AlertBanner tone="warning">
            The session register could not be loaded. Refresh the page to try again.
          </AlertBanner>
        ) : undefined
      }
      showDomainTable={!(pillar.code === "srhr" && (sessionWorkspace || sessionsFailed))}
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
        ) : sessionWorkspace ? (
          <SessionSummaryCards
            summary={sessionWorkspace.summary}
            color={pillar.color}
            tint={pillar.tint}
          />
        ) : undefined
      }
      headingActions={
        sessionWorkspace && sessionPermissions.log ? (
          <>
            {canCreate ? (
              <PillarCreateButton code={pillar.code} name={pillar.name} variant="outline" />
            ) : null}
            {pillar.code === "skilling" && canCreateDomain ? (
              <PillarDomainCreateButton code="skilling" />
            ) : null}
            <LogSessionButton workspace={sessionWorkspace} />
          </>
        ) : vawg ? (
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
      domainActions={domainActions}
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
