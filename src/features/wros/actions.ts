"use server";
/**
 * Server Actions for WRO partner organisations: registration and moving an
 * organisation along the sub-grant pipeline.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission in the WRO pillar, then calls the feature API. The API
 * enforces the same rules again and writes the audit entry.
 */
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { auditedRevealAction } from "@/components/portal/data-actions";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { createWrosApi, WRO_PILLAR_ID } from "./api";
import { organisationRegistrationSchema, stageMoveSchema } from "./schemas";

const scope = { pillarId: WRO_PILLAR_ID };
const refresh = () => {
  revalidatePath("/pillars/wros");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
};

export async function registerOrganisationAction(input: unknown) {
  const session = await requireSession();
  const parsed = organisationRegistrationSchema.safeParse(input);
  if (!parsed.success)
    return actionResult(422, "Check the organisation details and the data-sharing agreement");
  if (
    !hasPermission(session.grants, "ORGANISATION_EDIT", scope) ||
    !hasPermission(session.grants, "PARTICIPANT_EDIT", scope)
  )
    return actionResult(403, "You cannot register organisations in the WRO pillar");
  try {
    const response = await (await withSessionApi(createWrosApi)).register(parsed.data);
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not register the organisation");
  }
}

export async function moveOrganisationStageAction(input: unknown) {
  const session = await requireSession();
  const parsed = stageMoveSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the stage");
  if (
    !hasPermission(session.grants, "ORGANISATION_EDIT", scope) ||
    !hasPermission(session.grants, "FIELD_SUBMISSION_REVIEW", scope)
  )
    return actionResult(403, "You cannot move organisations along the pipeline");
  try {
    const response = await (await withSessionApi(createWrosApi)).moveToStage(parsed.data);
    if (response.success) refresh();
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not record the stage");
  }
}

/** Audited reveal of the organisation's bank-account status. */
export async function revealOrganisationBankAction(organisationId: number) {
  if (!Number.isSafeInteger(organisationId) || organisationId < 1)
    return { success: false as const, error: "Invalid organisation" };
  const result = await auditedRevealAction(
    {
      path: "/pillars/wros",
      routeTemplate: "/pillars/:pillar",
      query: { table: "organisation", id: organisationId },
    },
    "has_bank_account"
  );
  if (!result.success) return result;
  return {
    success: true as const,
    value: result.value === "true" ? "Yes" : result.value === "false" ? "No" : result.value,
  };
}
