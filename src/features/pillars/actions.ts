"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { createPillarRecordSchema, updatePillarRecordSchema, type PillarCode } from "./schemas";
import { createPillarsApi } from "./api";

export async function createPillarRecordAction(code: PillarCode, participantId: number, entryCategory: string): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();
  const input = createPillarRecordSchema.safeParse({ code, participantId, entryCategory });
  if (!input.success) return { success: false, message: "Enter a participant ID and programme category." };
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { success: false, message: "Sign in required." };
  const api = createPillarsApi(createPortalApiClient(), token);
  try {
    const pillar = await api.get(input.data.code);
    if (!hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: pillar.id })) return { success: false, message: "You cannot add records in this pillar." };
    if (pillar.code === "leadership" && !pillar.hasPipeline) return { success: false, message: "Configure a Leadership pipeline before adding records." };
    const result = await api.createEnrollment(pillar.code, { pillarId: pillar.id, participantId: input.data.participantId, entryCategory: input.data.entryCategory });
    if (!result.success) return { success: false, message: result.message };
    revalidatePath(`/pillars/${pillar.code}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Pillar record created." };
  } catch { return { success: false, message: "Could not create the pillar record." }; }
}

export async function updatePillarRecordAction(code: PillarCode, id: number, entryCategory: string): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();
  const input = updatePillarRecordSchema.safeParse({ code, id, entryCategory });
  if (!input.success) return { success: false, message: "Invalid pillar record." };
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { success: false, message: "Sign in required." };
  const api = createPillarsApi(createPortalApiClient(), token);
  try {
    const pillar = await api.get(input.data.code);
    if (!hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: pillar.id })) return { success: false, message: "You cannot edit records in this pillar." };
    if (!pillar.records.some(record => record.id === input.data.id)) return { success: false, message: "Record not found in this pillar." };
    const result = await api.updateEnrollment(pillar.code, input.data.id, input.data.entryCategory);
    if (!result.success) return { success: false, message: result.message };
    revalidatePath(`/pillars/${pillar.code}`);
    return { success: true, message: "Pillar record updated." };
  } catch { return { success: false, message: "Could not update the pillar record." }; }
}
