import { notFound } from "next/navigation";
import { AlertBanner } from "@/components/ui/alert-banner";
import { hasModulePermission, hasPermission, type EffectiveGrant } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session-server";
import { pillarsApi, PillarApiError, type PillarView } from "@/features/pillars/api";
import type { VawgSummary } from "@/features/vawg/model";
import { PillarContent } from "@/features/pillars/components";
import { PillarCreateButton, PillarDomainCreateButton } from "@/features/pillars/record-controls";
import { pillarCodeSchema, type PillarCode } from "@/features/pillars/schemas";
import {
  ids,
  loadSessionsWorkspace,
  loadTrainingWorkspace,
  loadVawgWorkspace,
  loadWroRegister,
} from "./loaders";
import { submissionsApi } from "@/features/submissions/api";
import { CaseRegister } from "@/features/vawg/components/case-register";
import { CounsellingRegister } from "@/features/vawg/components/counselling-register";
import { VawgHeadingActions } from "@/features/vawg/components/heading-actions";
import { VawgSummaryCards } from "@/features/vawg/components/summary-cards";
import { parsePeriod } from "@/features/sessions/model";
import { CurriculumProgressCard } from "@/features/participants/curriculum-card";
import { SessionSummaryCards } from "@/features/sessions/components/summary-cards";
import { SessionWorkspaceView } from "@/features/sessions/components/session-register";
import { LogSessionButton } from "@/features/sessions/components/session-dialogs";
import { TrainingSummaryCards } from "@/features/training/components/summary-cards";
import { TraineeRegister } from "@/features/training/components/trainee-register";
import { EnrolTraineeButton } from "@/features/training/components/trainee-dialogs";

/** The permission that lets a user add records to each pillar's domain register. */
const domainPermission = {
  vawg: "CASE_EDIT",
  wee: "GRANT_APPLICATION_EDIT",
  srhr: "ACTIVITY_SESSION_LOG",
  skilling: "TRAINING_ENROLLMENT_EDIT",
  wros: "ORGANISATION_EDIT",
  leadership: "PILLAR_CONFIG_MANAGE",
} as const satisfies Record<PillarCode, string>;

/** This pillar's newest field submissions, or none when the user can't view them here. */
async function loadSubmissions(grants: readonly EffectiveGrant[], pillarId: number) {
  if (!hasPermission(grants, "FIELD_SUBMISSION_VIEW", { pillarId })) return [];
  return submissionsApi
    .list({ pillarId, page: 1, pageSize: 3 })
    .then((list) => list.items)
    .catch(() => []);
}

/** The VAWG cards as the summary component shows them. */
function vawgSummary(cards: NonNullable<PillarView["cards"]["vawg"]>): VawgSummary {
  return {
    survivors: cards.survivors,
    openCases: cards.open_cases,
    sessions: cards.counselling_sessions ?? 0,
    sessionsThisQuarter: cards.counselling_this_quarter ?? 0,
    concluded: cards.concluded,
  };
}

/** The pillar, or null when the API refuses access (404 becomes a not-found page). */
function loadPillar(code: PillarCode, period: string) {
  return pillarsApi.get(code, { period }).catch((error) => {
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
  // The pillar's summary carries the cards its workspaces show, so they load after it.
  const pillar = await loadPillar(code.data, period);
  if (!pillar)
    return <AlertBanner tone="warning">You do not have access to this pillar.</AlertBanner>;
  const [submissions, workspace, sessions, training, register] = await Promise.all([
    loadSubmissions(session.grants, pillar.id),
    loadVawgWorkspace(session.grants, code.data, session.user.id, pillar.cards.vawg),
    loadSessionsWorkspace(
      session.grants,
      code.data,
      period,
      { id: session.user.id, name: session.user.name },
      pillar.cards.sessions
    ),
    loadTrainingWorkspace(session.grants, code.data, pillar.cards.trainees),
    // WROs carry over the field app's organisation register, profile and pipeline.
    code.data === "wros"
      ? loadWroRegister(session.grants, pillar.id, pillar.pipelineStages)
      : undefined,
  ]);
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
  const vawgPermissions = {
    edit: can("CASE_EDIT"),
    attach: can("DOCUMENT_UPLOAD"),
    download: can("DOCUMENT_DOWNLOAD"),
    reveal: can("SENSITIVE_REVEAL"),
    export: can("REPORT_EXPORT_CSV"),
    counsel: can("COUNSELLING_LOG"),
  };
  const counsellingPermissions = {
    log: can("COUNSELLING_LOG"),
    reveal: can("COUNSELLING_VIEW") && can("SENSITIVE_REVEAL"),
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
  const trainingWorkspace = training !== "failed" ? training : undefined;
  const trainingPermissions = {
    edit: can("TRAINING_ENROLLMENT_EDIT"),
    recommend: can("TRAINING_ENROLLMENT_EDIT") && can("REFERRAL_CREATE"),
    reveal: can("SENSITIVE_REVEAL"),
    export: can("REPORT_EXPORT_CSV"),
  };
  const enrolTrainee =
    trainingWorkspace && trainingPermissions.edit ? <EnrolTraineeButton /> : null;
  // SRHR logs sessions and Skilling enrols trainees through their workspaces, never the
  // raw-ID form, even when a workspace failed to load. WEE applications are filed from the
  // grants page, so its table offers no "New application".
  const domainActions =
    (pillar.code === "srhr" && sessions !== undefined) ||
    (pillar.code === "skilling" && training !== undefined) ||
    !canCreateDomain ||
    pillar.code === "wee" ||
    pillar.code === "wros" ? undefined : (
      <PillarDomainCreateButton code={pillar.code} />
    );
  const sessionsView = sessionWorkspace ? (
    <SessionWorkspaceView workspace={sessionWorkspace} can={sessionPermissions} />
  ) : sessionsFailed ? (
    <AlertBanner tone="warning">
      The session register could not be loaded. Refresh the page to try again.
    </AlertBanner>
  ) : undefined;
  const traineesView = trainingWorkspace ? (
    <TraineeRegister workspace={trainingWorkspace} can={trainingPermissions} />
  ) : training === "failed" ? (
    <AlertBanner tone="warning">
      The trainee register could not be loaded. Refresh the page to try again.
    </AlertBanner>
  ) : undefined;
  return (
    <PillarContent
      workspace={
        traineesView || sessionsView ? (
          <>
            {traineesView}
            {sessionsView}
          </>
        ) : undefined
      }
      showDomainTable={
        !(pillar.code === "srhr" && (sessionWorkspace || sessionsFailed)) &&
        !(pillar.code === "skilling" && training !== undefined)
      }
      register={
        vawg ? (
          <>
            <CaseRegister workspace={workspace} can={vawgPermissions} />
            {workspace.counselling && (
              <CounsellingRegister workspace={workspace} can={counsellingPermissions} />
            )}
          </>
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
          <VawgSummaryCards
            summary={vawgSummary(pillar.cards.vawg!)}
            color={pillar.color}
            tint={pillar.tint}
          />
        ) : trainingWorkspace ? (
          <TrainingSummaryCards
            summary={trainingWorkspace.summary}
            color={pillar.color}
            tint={pillar.tint}
          />
        ) : sessionWorkspace ? (
          <>
            <SessionSummaryCards
              summary={sessionWorkspace.summary}
              color={pillar.color}
              tint={pillar.tint}
            />
            {pillar.cards.curriculum && (
              <CurriculumProgressCard
                card={pillar.cards.curriculum}
                color={pillar.color}
                tint={pillar.tint}
              />
            )}
          </>
        ) : undefined
      }
      headingActions={
        sessionWorkspace && sessionPermissions.log ? (
          <>
            {enrolTrainee}
            <LogSessionButton
              pillar={sessionWorkspace.pillar}
              currentUser={sessionWorkspace.currentUser}
            />
          </>
        ) : enrolTrainee ? (
          <>{enrolTrainee}</>
        ) : vawg ? (
          <VawgHeadingActions
            currentUserId={session.user.id}
            canExport={vawgPermissions.export}
            canOpenCase={vawgPermissions.edit}
            canLogCounselling={counsellingPermissions.log}
          ></VawgHeadingActions>
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
      canEditRecords={canEdit}
      availableCodes={availableCodes}
      submissions={submissions}
    />
  );
}
