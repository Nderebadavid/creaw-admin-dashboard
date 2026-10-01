"use server";
/**
 * Server Actions for one pillar's group sessions: logging and editing a session,
 * correcting its attendance list, and its files.
 *
 * Each action re-checks the session, validates its input and checks the permission
 * in the session's pillar before calling the API, which enforces the same rules
 * again and writes the audit entry.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ViewedDocument } from "@/components/ui/document-viewer";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { titleCase } from "@/lib/format";
import { createSessionsApi } from "./api";
import { SESSION_PILLAR_IDS, type SessionPillar } from "./model";

const id = z.number().int().positive();
const pillar = z.enum(["srhr", "skilling"]);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const sessionInput = z.object({
  pillar,
  sessionId: id.optional(),
  activityTypeId: id,
  topicId: id.nullable(),
  topic: text(200),
  sessionDate: z.iso.date(),
  venue: text(160),
  notes: text(2000),
  facilitator: z.object({ kind: z.enum(["staff", "provider"]), id }),
});
const attendeeInput = z.object({ pillar, sessionId: id, participantId: id });
const removeInput = z.object({ pillar, sessionId: id, attendanceId: id });
const fileInput = z.object({
  pillar,
  sessionId: id,
  documentType: z.string().regex(/^[a-z0-9_]{2,60}$/),
  fileUrl: z
    .string()
    .max(500)
    .refine((value) => value.startsWith("mock://") || /^https:\/\//.test(value)),
});
const api = () => withSessionApi(createSessionsApi);
const scope = (code: SessionPillar) => ({ pillarId: SESSION_PILLAR_IDS[code] });
const done = (
  code: SessionPillar,
  response: { success: boolean; resultCode: number; message: string }
) => {
  if (response.success) revalidatePath(`/pillars/${code}`);
  return actionResult(response.resultCode, response.message);
};

/** Validates a session form against the pillar's curriculum; the API values, or an error result. */
async function sessionValues(input: unknown) {
  const parsed = sessionInput.safeParse(input);
  if (!parsed.success)
    return { error: actionResult(422, "Check the session details and try again") };
  const value = parsed.data;
  if (value.topicId === null && !value.topic)
    return { error: actionResult(422, "Choose a planned topic or describe the topic") };
  const session = await requireSession();
  if (!hasPermission(session.grants, "ACTIVITY_SESSION_LOG", scope(value.pillar)))
    return { error: actionResult(403, "You cannot log sessions in this pillar") };
  const client = await api();
  const { types, topics } = await client.curriculum(value.pillar);
  const type = types.find((item) => item.id === value.activityTypeId);
  if (!type) return { error: actionResult(422, "That activity type is not part of this pillar") };
  const topic =
    value.topicId === null
      ? undefined
      : topics.find((item) => item.id === value.topicId && item.activityTypeId === type.id);
  if (value.topicId !== null && !topic)
    return { error: actionResult(422, "That topic does not belong to this activity type") };
  // A new log needs a live type and topic; an edit may keep the ones the session already has.
  const current = value.sessionId ? await client.session(value.pillar, value.sessionId) : undefined;
  if (value.sessionId && !current) return { error: actionResult(404, "Session not found") };
  if (!type.active && current?.activity_type_id !== type.id)
    return { error: actionResult(422, "That activity type is no longer offered") };
  if (topic && !topic.active && current?.activity_topic_id !== topic.id)
    return { error: actionResult(422, "That topic is no longer offered") };
  const { facilitator } = value;
  const options = await client.facilitators(value.pillar);
  const keeps =
    current?.facilitator_user_id === (facilitator.kind === "staff" ? facilitator.id : null) &&
    current?.facilitator_provider_id === (facilitator.kind === "provider" ? facilitator.id : null);
  const offered = options.some(
    (item) => item.kind === facilitator.kind && item.id === facilitator.id
  );
  if (!offered && !(current && keeps))
    return { error: actionResult(422, "Choose a facilitator from the list") };
  return {
    value,
    body: {
      facilitator_user_id: facilitator.kind === "staff" ? facilitator.id : null,
      facilitator_provider_id: facilitator.kind === "provider" ? facilitator.id : null,
      activity_type_id: value.activityTypeId,
      activity_topic_id: value.topicId,
      topic: value.topicId === null ? value.topic : null,
      session_date: value.sessionDate,
      venue: value.venue,
      notes: value.notes,
    },
  };
}

export async function logSessionAction(input: unknown) {
  try {
    const checked = await sessionValues(input);
    if (checked.error) return checked.error;
    const response = await (
      await api()
    ).logSession(checked.value.pillar, {
      ...checked.body,
      pillar_id: SESSION_PILLAR_IDS[checked.value.pillar],
    });
    return done(checked.value.pillar, response);
  } catch {
    return actionResult(500, "Could not log the session");
  }
}

export async function updateSessionAction(input: unknown) {
  try {
    const checked = await sessionValues(input);
    if (checked.error) return checked.error;
    if (!checked.value.sessionId)
      return actionResult(422, "Check the session details and try again");
    const response = await (
      await api()
    ).updateSession(checked.value.pillar, checked.value.sessionId, checked.body);
    return done(checked.value.pillar, response);
  } catch {
    return actionResult(500, "Could not update the session");
  }
}

export async function addAttendeeAction(input: unknown) {
  const session = await requireSession();
  const parsed = attendeeInput.safeParse(input);
  if (!parsed.success) return actionResult(422, "Choose a participant");
  const { pillar: code, sessionId, participantId } = parsed.data;
  if (!hasPermission(session.grants, "ACTIVITY_SESSION_LOG", scope(code)))
    return actionResult(403, "You cannot change attendance in this pillar");
  try {
    const client = await api();
    const rows = (await client.attendance(code, sessionId)).filter(
      (row) => row.participant_id === participantId
    );
    if (rows.some((row) => !row.is_deleted))
      return actionResult(422, "Already on the attendance list");
    const removed = rows.find((row) => row.is_deleted);
    const response = removed
      ? await client.setAttendanceDeleted(code, removed.id, false)
      : await client.addAttendance(code, sessionId, participantId);
    return done(code, response);
  } catch {
    return actionResult(500, "Could not add the attendee");
  }
}

export async function removeAttendeeAction(input: unknown) {
  const session = await requireSession();
  const parsed = removeInput.safeParse(input);
  if (!parsed.success) return actionResult(422, "Choose an attendee");
  const { pillar: code, sessionId, attendanceId } = parsed.data;
  if (!hasPermission(session.grants, "ACTIVITY_SESSION_LOG", scope(code)))
    return actionResult(403, "You cannot change attendance in this pillar");
  try {
    const client = await api();
    const rows = await client.attendance(code, sessionId);
    if (!rows.some((row) => row.id === attendanceId && !row.is_deleted))
      return actionResult(404, "Attendee not found on this session");
    return done(code, await client.setAttendanceDeleted(code, attendanceId, true));
  } catch {
    return actionResult(500, "Could not remove the attendee");
  }
}

export async function attachSessionFileAction(input: unknown) {
  const session = await requireSession();
  const parsed = fileInput.safeParse(input);
  if (!parsed.success) return actionResult(422, "Choose a document type and a file");
  const { pillar: code, sessionId, documentType, fileUrl } = parsed.data;
  if (!hasPermission(session.grants, "DOCUMENT_UPLOAD", scope(code)))
    return actionResult(403, "You cannot attach session files");
  try {
    const response = await (await api()).attach(code, sessionId, documentType, fileUrl);
    return done(code, response);
  } catch {
    return actionResult(500, "Could not attach the file");
  }
}

/** Opens a session file in the document viewer; the read is audited. */
export async function viewSessionFileAction(
  pillarCode: SessionPillar,
  sessionId: number,
  documentId: number
) {
  const session = await requireSession();
  const fail = (message: string) => ({ success: false as const, message, document: null });
  if (!pillar.safeParse(pillarCode).success) return fail("Invalid document");
  if (![sessionId, documentId].every((value) => Number.isSafeInteger(value) && value > 0))
    return fail("Invalid document");
  if (!hasPermission(session.grants, "DOCUMENT_DOWNLOAD", scope(pillarCode)))
    return fail("You cannot open session files");
  try {
    const response = await (await api()).viewDocument(pillarCode, documentId);
    const file = response.success ? response.data : null;
    if (!file || file.owner_type !== "activity_session" || file.owner_id !== sessionId)
      return fail(response.message || "Document not found");
    return {
      success: true as const,
      message: response.message,
      document: {
        id: file.id,
        name: titleCase(file.document_type),
        documentType: file.document_type,
        fileUrl: file.file_url,
        linkedRecord: `Group session #${sessionId}`,
      } satisfies ViewedDocument,
    };
  } catch {
    return fail("Could not open the document");
  }
}
