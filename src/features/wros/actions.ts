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
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { cleanListQuery, type ListQuery } from "@/lib/api/list";
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

/** One page of partner organisations for the register; the API filters, searches and sorts. */
export async function listOrganisationsAction(query: ListQuery) {
  const session = await requireSession();
  if (!hasPermission(session.grants, "ORGANISATION_VIEW", scope))
    return { success: false, message: "You cannot view organisations.", data: null };
  try {
    return {
      success: true,
      message: "OK",
      data: await (
        await withSessionApi(createWrosApi)
      ).list(
        cleanListQuery(query, {
          sort: [
            "organisation",
            "legalForm",
            "location",
            "stage",
            "registered",
            "dueDiligence",
            "record",
            "updated",
          ],
          filters: ["is_contracted", "in_due_diligence"],
        })
      ),
    };
  } catch {
    return { success: false, message: "Could not load the organisations.", data: null };
  }
}

/** When an organisation reached each pipeline stage, for its drawer. */
export async function loadOrganisationDetailAction(organisationId: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(organisationId) || organisationId < 1)
    return { success: false, message: "Invalid organisation.", data: null };
  if (!hasPermission(session.grants, "ORGANISATION_VIEW", scope))
    return { success: false, message: "You cannot view organisations.", data: null };
  try {
    const detail = await (await withSessionApi(createWrosApi)).detail(organisationId);
    return detail
      ? { success: true, message: "OK", data: detail }
      : { success: false, message: "Organisation not found.", data: null };
  } catch {
    return { success: false, message: "Could not load the organisation.", data: null };
  }
}

/** The wards the registration dialog offers, loaded when it opens. */
export async function loadOrganisationOptionsAction() {
  const session = await requireSession();
  if (
    !hasPermission(session.grants, "ORGANISATION_EDIT", scope) ||
    !hasPermission(session.grants, "PARTICIPANT_EDIT", scope)
  )
    return { success: false, message: "You cannot register organisations.", data: null };
  try {
    return {
      success: true,
      message: "OK",
      data: await (await withSessionApi(createWrosApi)).formOptions(),
    };
  } catch {
    return { success: false, message: "Could not load the options.", data: null };
  }
}
