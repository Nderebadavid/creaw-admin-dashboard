import { hasPermission, type EffectiveGrant } from "@/lib/auth/permissions";
import { type PillarCode } from "@/features/pillars/schemas";
import type { PillarView } from "@/features/pillars/api";
import { wrosApi, type PipelineStageDef } from "@/features/wros/api";
import { vawgApi } from "@/features/vawg/api";
import { sessionsApi } from "@/features/sessions/api";
import { trainingApi } from "@/features/training/api";
import { TRAINING_PILLAR_ID } from "@/features/training/model";
import { isSessionPillar, SESSION_PILLAR_IDS, type SessionPeriod } from "@/features/sessions/model";
import { OrganisationRegister } from "@/features/wros/components/organisation-register";

/** The fixed pillar id for each pillar code. */
export const ids: Record<PillarCode, number> = {
  vawg: 1,
  wee: 2,
  srhr: 3,
  leadership: 4,
  wros: 5,
  skilling: 6,
};

/**
 * The VAWG case workspace, none for other pillars and users without case access there,
 * or "failed" when it can't load (the page then degrades instead of erroring).
 */
export async function loadVawgWorkspace(
  grants: readonly EffectiveGrant[],
  code: PillarCode,
  currentUserId: number | undefined,
  cards: PillarView["cards"]["vawg"]
) {
  const pillarId = ids.vawg;
  const allowed =
    code === "vawg" &&
    cards !== null &&
    hasPermission(grants, "CASE_VIEW", { pillarId }) &&
    hasPermission(grants, "PARTICIPANT_VIEW", { pillarId });
  if (!allowed) return undefined;
  return vawgApi
    .workspace({
      canViewCounselling: hasPermission(grants, "COUNSELLING_VIEW", { pillarId }),
      currentUserId,
    })
    .catch(() => "failed" as const);
}

/**
 * The pillar's group-session workspace, none for other pillars and users without
 * session access there, or "failed" when it can't load (the page then degrades).
 */
export async function loadSessionsWorkspace(
  grants: readonly EffectiveGrant[],
  code: PillarCode,
  period: SessionPeriod,
  user: { id: number; name: string },
  cards: PillarView["cards"]["sessions"]
) {
  if (!isSessionPillar(code) || cards === null) return undefined;
  if (!hasPermission(grants, "ACTIVITY_SESSION_VIEW", { pillarId: SESSION_PILLAR_IDS[code] }))
    return undefined;
  return sessionsApi.workspace(code, period, cards, user).catch(() => "failed" as const);
}

/**
 * The Skilling trainee workspace, none for other pillars and users without trainee
 * access there, or "failed" when it can't load (the page then degrades).
 */
export async function loadTrainingWorkspace(
  grants: readonly EffectiveGrant[],
  code: PillarCode,
  cards: PillarView["cards"]["trainees"]
) {
  const scope = { pillarId: TRAINING_PILLAR_ID };
  if (
    code !== "skilling" ||
    cards === null ||
    !hasPermission(grants, "TRAINING_ENROLLMENT_VIEW", scope)
  )
    return undefined;
  return trainingApi.workspace(cards).catch(() => "failed" as const);
}

/** The WRO partner register, page 1 of it, with the pipeline its stage column uses. */
export async function loadWroRegister(
  grants: readonly EffectiveGrant[],
  pillarId: number,
  stages: readonly PipelineStageDef[]
) {
  const can = (code: string) => hasPermission(grants, code, { pillarId });
  const canRegister = can("ORGANISATION_EDIT") && can("PARTICIPANT_EDIT");
  const initial = await wrosApi.list({ page: 1, pageSize: 25 }).catch(() => null);
  if (!initial) return undefined;
  return (
    <OrganisationRegister
      initial={initial}
      stages={stages}
      canAssess={can("ORG_ASSESSMENT_EDIT")}
      canRegister={canRegister}
      canMove={can("ORGANISATION_EDIT") && can("FIELD_SUBMISSION_REVIEW")}
      canReveal={can("SENSITIVE_REVEAL")}
    />
  );
}
