"use server";
/**
 * Server Actions for the VAWG legal case register: court status changes,
 * case files, and audited reveals of a survivor's name.
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
import { revealParticipantAction } from "@/features/participants/actions";
import { caseNumber, createVawgApi } from "./api";
import { courtStatuses, VAWG_PILLAR_ID } from "./model";

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

/** The survivor's full name, revealed through the participant record (each reveal is audited). */
export async function revealSurvivorNameAction(participantId: number) {
  const [first, last] = await Promise.all([
    revealParticipantAction(participantId, "first_name"),
    revealParticipantAction(participantId, "last_name"),
  ]);
  if (!first.success) return first;
  if (!last.success) return last;
  return { success: true as const, value: `${first.value} ${last.value}` };
}
