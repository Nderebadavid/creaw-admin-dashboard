import { hasPermission, type EffectiveGrant } from "@/lib/auth/permissions";
import { type PillarCode } from "@/features/pillars/schemas";
import { assessmentsApi } from "@/features/assessments/api";
import { wrosApi } from "@/features/wros/api";
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
  currentUserId?: number
) {
  const pillarId = ids.vawg;
  const allowed =
    code === "vawg" &&
    hasPermission(grants, "CASE_VIEW", { pillarId }) &&
    hasPermission(grants, "PARTICIPANT_VIEW", { pillarId });
  if (!allowed) return undefined;
  return vawgApi
    .workspace({
      canViewCounselling: hasPermission(grants, "COUNSELLING_VIEW", { pillarId }),
      canLogCounselling: hasPermission(grants, "COUNSELLING_LOG", { pillarId }),
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
  user: { id: number; name: string }
) {
  if (!isSessionPillar(code)) return undefined;
  if (!hasPermission(grants, "ACTIVITY_SESSION_VIEW", { pillarId: SESSION_PILLAR_IDS[code] }))
    return undefined;
  const canLog = hasPermission(grants, "ACTIVITY_SESSION_LOG", {
    pillarId: SESSION_PILLAR_IDS[code],
  });
  return sessionsApi
    .workspace(code, period, { canLog, currentUser: user })
    .catch(() => "failed" as const);
}

/**
 * The Skilling trainee workspace, none for other pillars and users without trainee
 * access there, or "failed" when it can't load (the page then degrades).
 */
export async function loadTrainingWorkspace(grants: readonly EffectiveGrant[], code: PillarCode) {
  const scope = { pillarId: TRAINING_PILLAR_ID };
  if (code !== "skilling" || !hasPermission(grants, "TRAINING_ENROLLMENT_VIEW", scope))
    return undefined;
  const canEdit = hasPermission(grants, "TRAINING_ENROLLMENT_EDIT", scope);
  return trainingApi.workspace({ canEdit }).catch(() => "failed" as const);
}

/** The WRO partner register with the options its dialogs need, trimmed to the user's grants. */
export async function loadWroRegister(grants: readonly EffectiveGrant[], pillarId: number) {
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
