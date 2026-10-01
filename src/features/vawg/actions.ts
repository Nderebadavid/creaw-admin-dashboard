"use server";
/**
 * Server Actions for the VAWG page: legal case edits, court status changes, case
 * files, the audited OB-number reveal, and logging and editing counselling sessions
 * with the audited reveal of their notes.
 *
 * Each action re-checks the session, validates its input and checks the
 * permission in the VAWG pillar before calling the API, which enforces the
 * same rules again and writes the audit entry.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ViewedDocument } from "@/components/ui/document-viewer";
import type { RevealResult } from "@/components/ui/masked-field";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { titleCase } from "@/lib/format";
import { caseNumber, createVawgApi } from "./api";
import { counsellingTypes, courtStatuses, VAWG_PILLAR_ID } from "./model";

const scope = { pillarId: VAWG_PILLAR_ID };
const id = z.number().int().positive();
const api = () => withSessionApi(createVawgApi);
const nullableText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .transform((value) => value || null);
const legalCaseUpdateSchema = z.object({
  caseId: id,
  caseTypeId: id,
  court: nullableText(160),
  courtFileNumber: nullableText(80),
  obNumber: nullableText(80).refine((value) => !value?.includes("•")),
  assignedOfficer: nullableText(160),
  counsellor: nullableText(160),
  nextCourtDate: z
    .string()
    .trim()
    .nullable()
    .transform((value) => value || null)
    .pipe(z.iso.date().nullable()),
});

export async function updateLegalCaseAction(input: unknown) {
  const session = await requireSession();
  const parsed = legalCaseUpdateSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the case details and try again");
  if (!hasPermission(session.grants, "CASE_EDIT", scope))
    return actionResult(403, "You cannot update legal cases");
  try {
    const response = await (
      await api()
    ).updateCase(parsed.data.caseId, {
      case_type_id: parsed.data.caseTypeId,
      court_name: parsed.data.court,
      court_file_number: parsed.data.courtFileNumber,
      ...(parsed.data.obNumber ? { ob_number: parsed.data.obNumber } : {}),
      assigned_officer: parsed.data.assignedOfficer,
      counsellor: parsed.data.counsellor,
      next_court_date: parsed.data.nextCourtDate,
    });
    if (response.success) revalidatePath("/pillars/vawg");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not update the case");
  }
}

export async function revealCaseObNumberAction(caseId: number): Promise<RevealResult> {
  const session = await requireSession();
  if (!Number.isSafeInteger(caseId) || caseId < 1) return { success: false, error: "Invalid case" };
  if (!hasPermission(session.grants, "SENSITIVE_REVEAL", scope))
    return { success: false, error: "Permission denied" };
  try {
    const response = await (await api()).revealCaseField(caseId, "ob_number");
    if (!response.success) return { success: false, error: response.message };
    if (!response.data) return { success: false, error: "No OB number recorded" };
    return { success: true, value: response.data.value };
  } catch {
    return { success: false, error: "Could not reveal this field" };
  }
}

export async function setCourtStatusAction(input: unknown) {
  const session = await requireSession();
  const parsed = z.object({ caseId: id, courtStatus: z.enum(courtStatuses) }).safeParse(input);
  if (!parsed.success) return actionResult(422, "Choose a court status");
  if (!hasPermission(session.grants, "CASE_EDIT", scope))
    return actionResult(403, "You cannot update legal cases");
  try {
    const response = await (
      await api()
    ).setCourtStatus(parsed.data.caseId, parsed.data.courtStatus);
    if (response.success) revalidatePath("/pillars/vawg");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not update the case");
  }
}

export async function attachCaseFileAction(input: unknown) {
  const session = await requireSession();
  const parsed = z
    .object({
      caseId: id,
      documentType: z.string().regex(/^[a-z0-9_]{2,60}$/),
      fileUrl: z
        .string()
        .max(500)
        .refine((value) => value.startsWith("mock://") || /^https:\/\//.test(value)),
    })
    .safeParse(input);
  if (!parsed.success) return actionResult(422, "Choose a document type and a file");
  if (!hasPermission(session.grants, "DOCUMENT_UPLOAD", scope))
    return actionResult(403, "You cannot attach case files");
  try {
    const response = await (
      await api()
    ).attach(parsed.data.caseId, parsed.data.documentType, parsed.data.fileUrl);
    if (response.success) revalidatePath("/pillars/vawg");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not attach the file");
  }
}

/** Opens a case file in the document viewer; the read is audited. */
export async function viewCaseFileAction(caseId: number, documentId: number) {
  const session = await requireSession();
  const fail = (message: string) => ({ success: false as const, message, document: null });
  if (![caseId, documentId].every((value) => Number.isSafeInteger(value) && value > 0))
    return fail("Invalid document");
  if (!hasPermission(session.grants, "DOCUMENT_DOWNLOAD", scope))
    return fail("You cannot open case files");
  try {
    const response = await (await api()).viewDocument(documentId);
    const file = response.success ? response.data : null;
    if (!file || file.owner_type !== "legal_case" || file.owner_id !== caseId)
      return fail(response.message || "Document not found");
    return {
      success: true as const,
      message: response.message,
      document: {
        id: file.id,
        name: titleCase(file.document_type),
        documentType: file.document_type,
        fileUrl: file.file_url,
        linkedRecord: `Legal case ${caseNumber(caseId)}`,
      } satisfies ViewedDocument,
    };
  } catch {
    return fail("Could not open the document");
  }
}

/** Today in Kenya as YYYY-MM-DD, so a session logged in the evening is not "in the future". */
const kenyaToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());

const counsellingInput = z.object({
  sessionId: id.optional(),
  enrollmentId: id.optional(),
  sessionDate: z.iso.date(),
  sessionType: z.enum(counsellingTypes),
  counsellor: z.object({ kind: z.enum(["staff", "provider"]), id }),
  /** On an edit, blank keeps the notes on file (they are masked, so never pre-filled). */
  notes: z
    .string()
    .trim()
    .max(4000)
    .refine((value) => !value.includes("•"))
    .transform((value) => value || null),
});

/** Validates a counselling form; the API values, or an error result. */
async function counsellingValues(input: unknown) {
  const parsed = counsellingInput.safeParse(input);
  if (!parsed.success)
    return { error: actionResult(422, "Check the session details and try again") };
  const session = await requireSession();
  if (!hasPermission(session.grants, "COUNSELLING_LOG", scope))
    return { error: actionResult(403, "You cannot log counselling sessions") };
  const value = parsed.data;
  if (value.sessionDate > kenyaToday())
    return { error: actionResult(422, "A session cannot be logged for a future date") };
  const client = await api();
  const current = value.sessionId ? await client.counsellingSession(value.sessionId) : undefined;
  if (value.sessionId && !current) return { error: actionResult(404, "Session not found") };
  const { counsellor } = value;
  const keeps =
    current?.counsellor_user_id === (counsellor.kind === "staff" ? counsellor.id : null) &&
    current?.counsellor_provider_id === (counsellor.kind === "provider" ? counsellor.id : null);
  if (!(current && keeps)) {
    const options = await client.counsellors();
    if (!options.some((item) => item.kind === counsellor.kind && item.id === counsellor.id))
      return { error: actionResult(422, "Choose a counsellor from the list") };
  }
  return {
    value,
    client,
    body: {
      session_date: value.sessionDate,
      session_type: value.sessionType,
      counsellor_user_id: counsellor.kind === "staff" ? counsellor.id : null,
      counsellor_provider_id: counsellor.kind === "provider" ? counsellor.id : null,
      ...(value.notes ? { notes: value.notes } : {}),
    },
  };
}

export async function logCounsellingAction(input: unknown) {
  try {
    const checked = await counsellingValues(input);
    if (checked.error) return checked.error;
    const { enrollmentId } = checked.value;
    if (!enrollmentId || !(await checked.client.isSurvivor(enrollmentId)))
      return actionResult(422, "Choose a survivor enrolled in VAWG");
    const response = await checked.client.logCounselling({
      ...checked.body,
      enrollment_id: enrollmentId,
    });
    if (response.success) revalidatePath("/pillars/vawg");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not log the session");
  }
}

export async function updateCounsellingAction(input: unknown) {
  try {
    const checked = await counsellingValues(input);
    if (checked.error) return checked.error;
    if (!checked.value.sessionId) return actionResult(422, "Check the session details");
    const response = await checked.client.updateCounselling(checked.value.sessionId, checked.body);
    if (response.success) revalidatePath("/pillars/vawg");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not update the session");
  }
}

export async function revealCounsellingNotesAction(sessionId: number): Promise<RevealResult> {
  const session = await requireSession();
  if (!Number.isSafeInteger(sessionId) || sessionId < 1)
    return { success: false, error: "Invalid session" };
  if (
    !hasPermission(session.grants, "COUNSELLING_VIEW", scope) ||
    !hasPermission(session.grants, "SENSITIVE_REVEAL", scope)
  )
    return { success: false, error: "Permission denied" };
  try {
    const result = await (await api()).revealCounsellingNotes(sessionId);
    if (!result.success) return { success: false, error: result.message };
    if (result.value === null) return { success: false, error: "No notes recorded" };
    return { success: true, value: result.value };
  } catch {
    return { success: false, error: "Could not reveal the notes" };
  }
}
