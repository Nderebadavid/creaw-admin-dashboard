"use server";
/**
 * Server Actions for pillar programme records and domain registers.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */

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
import { cleanListQuery, type ListQuery } from "@/lib/api/list";

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
    const head = await api.summary(input.data.code);
    const pillar = { id: head.pillar.id, code: input.data.code, hasPipeline: !!head.pipeline };
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
    const pillar = { id: (await api.summary(input.data.code)).pillar.id, code: input.data.code };
    if (!hasPermission(session.grants, "PARTICIPANT_EDIT", { pillarId: pillar.id }))
      return { success: false, message: "You cannot edit records in this pillar." };
    if (!(await api.hasEnrollment(pillar.code, { id: input.data.id })))
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
    const pillar = { id: (await api.summary(code)).pillar.id };
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
        if (!(await api.hasEnrollment(code, { id: enrollmentId })))
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
        if (!(await api.hasEnrollment(code, { participantId })))
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
        if (!(await api.hasEnrollment(code, { id: enrollmentId })))
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

/** One page of a pillar's programme records for the records table. */
export async function listPillarRecordsAction(code: PillarCode, query: ListQuery) {
  const session = await requireSession();
  const parsed = createPillarRecordSchema.shape.code.safeParse(code);
  if (!parsed.success) return { success: false, message: "Unknown pillar.", data: null };
  const token = await readSessionToken();
  if (!token) return { success: false, message: "Sign in required.", data: null };
  try {
    const api = createPillarsApi(createPortalApiClient(), token);
    const head = await api.summary(parsed.data);
    if (!hasPermission(session.grants, "DASHBOARD_VIEW", { pillarId: head.pillar.id }))
      return { success: false, message: "You cannot view this pillar.", data: null };
    return {
      success: true,
      message: "OK",
      data: await api.listRecords(
        parsed.data,
        cleanListQuery(query, { sort: ["record", "category", "status", "updated"] })
      ),
    };
  } catch {
    return { success: false, message: "Could not load the records.", data: null };
  }
}

/** One page of a pillar's generic register (WEE's grant applications). */
export async function listPillarDomainAction(code: PillarCode, query: ListQuery) {
  const session = await requireSession();
  const parsed = createPillarRecordSchema.shape.code.safeParse(code);
  if (!parsed.success) return { success: false, message: "Unknown pillar.", data: null };
  const token = await readSessionToken();
  if (!token) return { success: false, message: "Sign in required.", data: null };
  try {
    const api = createPillarsApi(createPortalApiClient(), token);
    const head = await api.summary(parsed.data);
    if (!hasPermission(session.grants, "GRANT_APPLICATION_VIEW", { pillarId: head.pillar.id }))
      return { success: false, message: "You cannot view these applications.", data: null };
    const clean = cleanListQuery(query, { sort: ["0", "1", "2", "status"], filters: ["status"] });
    const domain = await api.listDomain(parsed.data, clean);
    if (!domain) return { success: false, message: "Could not load the register.", data: null };
    return {
      success: true,
      message: "OK",
      data: {
        items: domain.rows,
        page: clean.page ?? 1,
        pageSize: clean.pageSize ?? 25,
        totalItems: domain.totalItems,
        totalPages: Math.max(1, Math.ceil(domain.totalItems / (clean.pageSize ?? 25))),
      },
    };
  } catch {
    return { success: false, message: "Could not load the register.", data: null };
  }
}
