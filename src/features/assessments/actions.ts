"use server";
import type { ViewedDocument } from "@/components/ui/document-viewer";
/**
 * Server Actions for assessment recommendations, approvals and due-diligence documents.
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
import { createAssessmentsApi } from "./api";
import { assessmentRecordSchema, attachSchema, recommendationSchema } from "./schemas";
function api() {
  return withSessionApi(createAssessmentsApi);
}
export async function listAssessmentsAction(page: number, pageSize: number) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "ORG_ASSESSMENT_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    return { ...actionResult(200, "OK"), data: await (await api()).list(page, pageSize) };
  } catch {
    return { ...actionResult(500, "Could not load assessments"), data: null };
  }
}
/** Records a scored assessment from the portal, as the field app does. */
export async function recordAssessmentAction(input: unknown) {
  const session = await requireSession();
  const parsed = assessmentRecordSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the assessment scores");
  if (!hasPermission(session.grants, "ORG_ASSESSMENT_EDIT", { pillarId: 5 }))
    return actionResult(403, "Permission denied");
  // The document checklist is due-diligence work; without that grant only the scores are saved.
  const withChecks = hasPermission(session.grants, "DUE_DILIGENCE_MANAGE", { pillarId: 5 });
  try {
    const response = await (await api()).record(parsed.data, withChecks);
    if (response.success) {
      revalidatePath("/assessments");
      revalidatePath("/pillars/wros");
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not save the assessment");
  }
}
export async function recommendAssessmentAction(input: unknown) {
  const session = await requireSession();
  const parsed = recommendationSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the recommendation");
  if (!hasPermission(session.grants, "ORG_ASSESSMENT_EDIT", { pillarId: 5 }))
    return actionResult(403, "Permission denied");
  try {
    const response = await (await api()).recommend(parsed.data.id, parsed.data.recommendation);
    if (response.success) revalidatePath("/assessments");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not save recommendation");
  }
}
export async function approveAssessmentAction(input: unknown) {
  const session = await requireSession();
  const parsed = recommendationSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the approval");
  if (!hasPermission(session.grants, "ORG_ASSESSMENT_APPROVE", { pillarId: 5 }))
    return actionResult(403, "Permission denied");
  try {
    const response = await (await api()).approve(parsed.data.id, parsed.data.recommendation);
    if (response.success) revalidatePath("/assessments");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not approve assessment");
  }
}
export async function attachAssessmentDocumentAction(input: unknown) {
  const session = await requireSession();
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the document reference");
  if (
    !hasPermission(session.grants, "DUE_DILIGENCE_MANAGE", { pillarId: 5 }) ||
    !hasPermission(session.grants, "DOCUMENT_UPLOAD", { pillarId: 5 })
  )
    return actionResult(403, "Permission denied");
  try {
    const response = await (await api()).attach(parsed.data.checkId, parsed.data.fileUrl);
    if (response.success) revalidatePath("/assessments");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not attach document");
  }
}
export async function viewAssessmentDocumentAction(assessmentId: number, documentId: number) {
  const session = await requireSession();
  if (![assessmentId, documentId].every((id) => Number.isSafeInteger(id) && id > 0))
    return { ...actionResult(422, "Invalid document"), document: null };
  if (
    !hasPermission(session.grants, "ORG_ASSESSMENT_VIEW", { pillarId: 5 }) ||
    !hasPermission(session.grants, "DOCUMENT_DOWNLOAD", { pillarId: 5 })
  )
    return { ...actionResult(403, "Permission denied"), document: null };
  try {
    const client = await api();
    const assessment = await client.get(assessmentId);
    const check = assessment?.documents.find((item) => item.documentId === documentId);
    if (!assessment || !check)
      return { ...actionResult(404, "Document not found"), document: null };
    const response = await client.viewDocument(documentId);
    const file = response.success ? response.data : null;
    return {
      ...actionResult(response.resultCode, response.message),
      document: file
        ? ({
            id: file.id,
            name: check.name,
            documentType: file.document_type,
            fileUrl: file.file_url,
            linkedRecord: `${assessment.organisation} · Assessment #${assessment.id}`,
          } satisfies ViewedDocument)
        : null,
    };
  } catch {
    return { ...actionResult(500, "Could not open document"), document: null };
  }
}
