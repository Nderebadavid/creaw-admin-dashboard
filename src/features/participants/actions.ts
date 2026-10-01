"use server";
/**
 * Server Actions for participant registration, edits, audited reveals and export.
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
import { participantRegistrationSchema, participantUpdateSchema } from "./schemas";

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
        sort: ["participant", "county", "pillars", "stage", "registered", "status", "updated"],
      }
    );
    return {
      ...actionResult(200, "OK"),
      data: await (
        await api()
      ).list({
        ...clean,
        pillarId: Number.isInteger(query.pillarId) ? query.pillarId : undefined,
        countyId: Number.isInteger(query.countyId) ? query.countyId : undefined,
      }),
    };
  } catch {
    return { ...actionResult(422, "Could not load participants"), data: null };
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
    if (
      !participant.pillarIds.some((pillarId) =>
        hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId })
      )
    )
      return actionResult(403, "You cannot edit this participant");
    const response = await client.update(parsed.data);
    if (response.success) revalidatePath("/participants");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not save this participant");
  }
}

export async function revealParticipantAction(id: number, field: "id_number" | "phone_number") {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1 || !["id_number", "phone_number"].includes(field))
    return { success: false as const, error: "Invalid field" };
  try {
    const client = await api();
    const participant = await client.get(id);
    if (!participant) return { success: false as const, error: "Participant not found" };
    if (
      !participant.pillarIds.some((pillarId) =>
        hasPermission(session.grants, "SENSITIVE_REVEAL", { pillarId })
      )
    )
      return { success: false as const, error: "Permission denied" };
    const response = await client.reveal(id, field);
    if (!response.success || !response.data)
      return { success: false as const, error: response.message };
    return { success: true as const, value: String(response.data[field] ?? "—") };
  } catch {
    return { success: false as const, error: "Could not reveal this field" };
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
    query: { pillarId: query.pillarId, countyId: query.countyId, search: query.search },
  });
}
