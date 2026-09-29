"use server";

import { revalidatePath } from "next/cache";
import { readSessionToken } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { createPortalApiClient } from "@/lib/api/portal-client";
import {
  createDomainSchema,
  createPillarRecordSchema,
  updatePillarRecordSchema,
  type PillarCode,
} from "./schemas";
import { createPillarsApi } from "./api";

export async function createPillarRecordAction(
  code: PillarCode,
  participantId: number,
  entryCategory: string
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();
  const input = createPillarRecordSchema.safeParse({ code, participantId, entryCategory });
  if (!input.success)
    return { success: false, message: "Enter a participant ID and programme category." };
  const token = await readSessionToken();
  if (!token) return { success: false, message: "Sign in required." };
  const api = createPillarsApi(createPortalApiClient(), token);
  try {
    const pillar = await api.get(input.data.code);
    if (!hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: pillar.id }))
      return { success: false, message: "You cannot add records in this pillar." };
    if (pillar.code === "leadership" && !pillar.hasPipeline)
      return { success: false, message: "Configure a Leadership pipeline before adding records." };
    const result = await api.createEnrollment(pillar.code, {
      pillarId: pillar.id,
      participantId: input.data.participantId,
      entryCategory: input.data.entryCategory,
    });
    if (!result.success) return { success: false, message: result.message };
    revalidatePath(`/pillars/${pillar.code}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Pillar record created." };
  } catch {
    return { success: false, message: "Could not create the pillar record." };
  }
}

export async function updatePillarRecordAction(
  code: PillarCode,
  id: number,
  entryCategory: string
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();
  const input = updatePillarRecordSchema.safeParse({ code, id, entryCategory });
  if (!input.success) return { success: false, message: "Invalid pillar record." };
  const token = await readSessionToken();
  if (!token) return { success: false, message: "Sign in required." };
  const api = createPillarsApi(createPortalApiClient(), token);
  try {
    const pillar = await api.get(input.data.code);
    if (!hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: pillar.id }))
      return { success: false, message: "You cannot edit records in this pillar." };
    if (!pillar.records.some((record) => record.id === input.data.id))
      return { success: false, message: "Record not found in this pillar." };
    const result = await api.updateEnrollment(pillar.code, input.data.id, input.data.entryCategory);
    if (!result.success) return { success: false, message: result.message };
    revalidatePath(`/pillars/${pillar.code}`);
    return { success: true, message: "Pillar record updated." };
  } catch {
    return { success: false, message: "Could not update the pillar record." };
  }
}

export async function createPillarDomainAction(
  code: PillarCode,
  values: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();
  const input = createDomainSchema.safeParse({ ...values, code });
  if (!input.success)
    return { success: false, message: "Complete the required fields with valid values." };
  const token = await readSessionToken();
  if (!token) return { success: false, message: "Sign in required." };
  const api = createPillarsApi(createPortalApiClient(), token);
  try {
    const pillar = await api.get(code);
    const permission = (
      {
        vawg: "CASE_EDIT",
        wee: "GRANT_APPLICATION_EDIT",
        srhr: "ACTIVITY_SESSION_LOG",
        skilling: "TRAINING_ENROLLMENT_EDIT",
        wros: "ORGANISATION_EDIT",
      } as const
    )[input.data.code];
    if (!hasPermission(session.grants, permission, { pillarId: pillar.id }))
      return { success: false, message: "You cannot add records in this pillar." };
    let result;
    switch (input.data.code) {
      case "vawg": {
        const enrollmentId = input.data.enrollmentId;
        if (!pillar.records.some((row) => row.id === enrollmentId))
          return { success: false, message: "Enrollment not found in this pillar." };
        result = await api.createDomainRecord(code, "legal_case", {
          enrollment_id: input.data.enrollmentId,
          case_type_id: input.data.caseTypeId,
          opened_date: input.data.openedDate,
        });
        break;
      }
      case "wee": {
        if (!hasPermission(session.grants, "GRANT_APPLICATION_PREPARE", { pillarId: pillar.id }))
          return { success: false, message: "Grant application prepare permission required." };
        const participantId = input.data.participantId;
        if (!pillar.records.some((row) => row.title === `Participant #${participantId}`))
          return { success: false, message: "Participant not enrolled in this pillar." };
        result = await api.createDomainRecord(code, "grant_application", {
          project_id: input.data.projectId,
          participant_id: input.data.participantId,
          requested_amount: input.data.requestedAmount,
          grant_type: input.data.grantType,
          status: "PREPARED",
        });
        break;
      }
      case "srhr":
        result = await api.createDomainRecord(code, "activity_session", {
          pillar_id: pillar.id,
          activity_type_id: input.data.activityTypeId,
          session_date: input.data.sessionDate,
          topic: input.data.topic,
          venue: input.data.venue,
          facilitator_user_id: session.user.id,
        });
        break;
      case "skilling": {
        const enrollmentId = input.data.enrollmentId;
        if (!pillar.records.some((row) => row.id === enrollmentId))
          return { success: false, message: "Enrollment not found in this pillar." };
        result = await api.createDomainRecord(code, "training_enrollment", {
          enrollment_id: input.data.enrollmentId,
          pathway: input.data.pathway,
          course_name: input.data.courseName,
          start_date: input.data.startDate,
        });
        break;
      }
      case "wros": {
        if (!hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: pillar.id }))
          return { success: false, message: "Organisation enrollment permission required." };
        const organisation = await api.createDomainRecord(
          code,
          "organisation",
          { name: input.data.name, legal_form: input.data.legalForm },
          pillar.id
        );
        if (!organisation.success || !organisation.data)
          return { success: false, message: organisation.message };
        result = await api.createDomainRecord(code, "enrollment", {
          pillar_id: pillar.id,
          organisation_id: organisation.data.id,
          entry_category: input.data.entryCategory,
        });
        break;
      }
    }
    if (!result.success) return { success: false, message: result.message };
    revalidatePath(`/pillars/${code}`);
    revalidatePath("/dashboard");
    return { success: true, message: "Pillar record created." };
  } catch {
    return { success: false, message: "Could not create the pillar record." };
  }
}
