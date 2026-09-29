"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { auditedExportAction } from "@/components/portal/data-actions";
import { createParticipantsApi, type ParticipantQuery } from "./api";
import { participantRegistrationSchema, participantUpdateSchema } from "./schemas";

const result = (resultCode: number, message: string) => ({ resultCode, success: resultCode < 400, message, data: null });
async function api() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error("Sign in required");
  return createParticipantsApi(createPortalApiClient(), token);
}

export async function listParticipantsAction(query: ParticipantQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "PARTICIPANT_VIEW")) return { ...result(403, "Permission denied"), data: null };
  try { return { ...result(200, "OK"), data: await (await api()).list(query) }; }
  catch { return { ...result(422, "Could not load participants"), data: null }; }
}

export async function registerParticipantAction(input: unknown) {
  const session = await requireSession();
  const parsed = participantRegistrationSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check the participant details and try again");
  if (!hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: parsed.data.pillarId })) return result(403, "You cannot register into this pillar");
  try {
    const response = await (await api()).register(parsed.data);
    if (response.success) { revalidatePath("/participants"); revalidatePath("/dashboard"); }
    return result(response.resultCode, response.message);
  } catch { return result(500, "Registration failed. Please try again"); }
}

export async function updateParticipantAction(input: unknown) {
  const session = await requireSession();
  const parsed = participantUpdateSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check the participant details and try again");
  try {
    const client = await api();
    const participant = await client.get(parsed.data.id);
    if (!participant) return result(404, "Participant not found");
    if (!participant.pillarIds.some(pillarId => hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId }))) return result(403, "You cannot edit this participant");
    const response = await client.update(parsed.data);
    if (response.success) revalidatePath("/participants");
    return result(response.resultCode, response.message);
  } catch { return result(500, "Could not save this participant"); }
}

export async function revealParticipantAction(id: number, field: "id_number" | "phone_number" | "first_name" | "last_name") {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1 || !["id_number", "phone_number", "first_name", "last_name"].includes(field)) return { success: false as const, error: "Invalid field" };
  try {
    const client = await api();
    const participant = await client.get(id);
    if (!participant) return { success: false as const, error: "Participant not found" };
    if (!participant.pillarIds.some(pillarId => hasPermission(session.grants, "SENSITIVE_REVEAL", { pillarId }))) return { success: false as const, error: "Permission denied" };
    const response = await client.reveal(id, field);
    if (!response.success || !response.data) return { success: false as const, error: response.message };
    return { success: true as const, value: String(response.data[field] ?? "—") };
  } catch { return { success: false as const, error: "Could not reveal this field" }; }
}

export async function exportParticipantsAction(query: ParticipantQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "PARTICIPANT_VIEW") || !hasModulePermission(session.grants, "REPORT_EXPORT_CSV")) return { success: false as const, error: "Permission denied" };
  return auditedExportAction({ path: "/participants", routeTemplate: "/participants", query: { pillarId: query.pillarId, countyId: query.countyId, search: query.search } });
}
