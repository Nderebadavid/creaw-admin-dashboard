"use server";
/**
 * Server Actions for participant registration, edits and export.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */

import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { auditedExportAction } from "@/components/portal/data-actions";
import { createParticipantsApi, type ParticipantQuery } from "./api";
import { cleanListQuery } from "@/lib/api/list";
import { cleanLocation } from "@/lib/api/location";
import {
  participantRegistrationSchema,
  participantUpdateSchema,
  PARTICIPANT_IDENTITY_KEYS,
} from "./schemas";

function api() {
  return withSessionApi(createParticipantsApi);
}

export async function listParticipantsAction(query: ParticipantQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "PARTICIPANT_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const clean = cleanListQuery(
      { page: query.page, pageSize: query.pageSize, search: query.search, sort: query.sort },
      {
        sort: [
          "participant",
          "county",
          "pillars",
          "stage",
          "registered",
          "status",
          "updated",
          "curriculum",
        ],
      }
    );
    return {
      ...actionResult(200, "OK"),
      data: await (
        await api()
      ).list({
        ...clean,
        pillarId: Number.isInteger(query.pillarId) ? query.pillarId : undefined,
        ...cleanLocation(query),
        behind: query.behind === true ? true : undefined,
        pwd: query.pwd === true ? true : undefined,
      }),
    };
  } catch {
    return { ...actionResult(422, "Could not load participants"), data: null };
  }
}

/** A participant's curriculum, loaded when the drawer opens; only for those who may view SRHR participants. */
export async function loadParticipantCurriculumAction(id: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1)
    return { ...actionResult(422, "Invalid participant"), data: null };
  if (!hasModulePermission(session.grants, "PARTICIPANT_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const detail = await (await api()).curriculum(id);
    return detail
      ? { ...actionResult(200, "OK"), data: detail }
      : { ...actionResult(404, "Participant not found"), data: null };
  } catch {
    return { ...actionResult(500, "Could not load the curriculum"), data: null };
  }
}

export async function registerParticipantAction(input: unknown) {
  const session = await requireSession();
  const parsed = participantRegistrationSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the participant details and try again");
  if (!hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: parsed.data.pillarId }))
    return actionResult(403, "You cannot register into this pillar");
  try {
    const response = await (await api()).register(parsed.data);
    if (response.success) {
      revalidatePath("/participants");
      revalidatePath("/dashboard");
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Registration failed. Please try again");
  }
}

export async function updateParticipantAction(input: unknown) {
  const session = await requireSession();
  const parsed = participantUpdateSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the participant details and try again");
  try {
    const client = await api();
    const participant = await client.get(parsed.data.id);
    if (!participant) return actionResult(404, "Participant not found");
    // Identity corrections need the record-manager permission; other edits need edit access.
    const correctsIdentity = PARTICIPANT_IDENTITY_KEYS.some(
      (key) => parsed.data[key] !== undefined
    );
    const needed = correctsIdentity ? "PARTICIPANT_RECORD_MANAGE" : "PARTICIPANT_EDIT";
    if (
      !participant.pillarIds.some((pillarId) => hasPermission(session.grants, needed, { pillarId }))
    )
      return actionResult(
        403,
        correctsIdentity
          ? "Your role cannot correct identity details for this participant"
          : "You cannot edit this participant"
      );
    const response = await client.update(parsed.data);
    if (response.success) revalidatePath("/participants");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not save this participant");
  }
}

export async function exportParticipantsAction(query: ParticipantQuery) {
  const session = await requireSession();
  if (
    !hasModulePermission(session.grants, "PARTICIPANT_VIEW") ||
    !hasModulePermission(session.grants, "REPORT_EXPORT_CSV")
  )
    return { success: false as const, error: "Permission denied" };
  return auditedExportAction({
    path: "/participants",
    routeTemplate: "/participants",
    query: {
      pillarId: Number.isInteger(query.pillarId) ? query.pillarId : undefined,
      ...cleanLocation(query),
      search: typeof query.search === "string" ? query.search.slice(0, 120) : undefined,
      ...(query.behind === true ? { curriculum_behind: "true" } : {}),
      ...(query.pwd === true ? { is_person_with_disability: "true" } : {}),
    },
  });
}
