"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { createAssessmentsApi } from "./api";
import { assessmentCreateSchema, attachSchema, recommendationSchema } from "./schemas";
const result = (resultCode: number, message: string) => ({
  resultCode,
  success: resultCode < 400,
  message,
});
async function api() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error("Sign in required");
  return createAssessmentsApi(createPortalApiClient(), token);
}
export async function listAssessmentsAction(page: number, pageSize: number) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "ORG_ASSESSMENT_VIEW"))
    return { ...result(403, "Permission denied"), data: null };
  try {
    return { ...result(200, "OK"), data: await (await api()).list(page, pageSize) };
  } catch {
    return { ...result(500, "Could not load assessments"), data: null };
  }
}
export async function createAssessmentAction(input: unknown) {
  const session = await requireSession();
  const parsed = assessmentCreateSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check the assessment details");
  if (
    !hasPermission(
      session.grants,
      parsed.data.recommendation ? "ORG_ASSESSMENT_APPROVE" : "ORG_ASSESSMENT_EDIT",
      { pillarId: 5 }
    )
  )
    return result(403, "Permission denied");
  try {
    const response = await (await api()).create(parsed.data);
    if (response.success) revalidatePath("/assessments");
    return result(response.resultCode, response.message);
  } catch {
    return result(500, "Could not create assessment");
  }
}
export async function recommendAssessmentAction(input: unknown) {
  const session = await requireSession();
  const parsed = recommendationSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check the recommendation");
  if (!hasPermission(session.grants, "ORG_ASSESSMENT_EDIT", { pillarId: 5 }))
    return result(403, "Permission denied");
  try {
    const response = await (await api()).recommend(parsed.data.id, parsed.data.recommendation);
    if (response.success) revalidatePath("/assessments");
    return result(response.resultCode, response.message);
  } catch {
    return result(500, "Could not save recommendation");
  }
}
export async function approveAssessmentAction(input: unknown) {
  const session = await requireSession();
  const parsed = recommendationSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check the approval");
  if (!hasPermission(session.grants, "ORG_ASSESSMENT_APPROVE", { pillarId: 5 }))
    return result(403, "Permission denied");
  try {
    const response = await (await api()).approve(parsed.data.id, parsed.data.recommendation);
    if (response.success) revalidatePath("/assessments");
    return result(response.resultCode, response.message);
  } catch {
    return result(500, "Could not approve assessment");
  }
}
export async function attachAssessmentDocumentAction(input: unknown) {
  const session = await requireSession();
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return result(422, "Check the document reference");
  if (
    !hasPermission(session.grants, "DUE_DILIGENCE_MANAGE", { pillarId: 5 }) ||
    !hasPermission(session.grants, "DOCUMENT_UPLOAD", { pillarId: 5 })
  )
    return result(403, "Permission denied");
  try {
    const response = await (await api()).attach(parsed.data.checkId, parsed.data.fileUrl);
    if (response.success) revalidatePath("/assessments");
    return result(response.resultCode, response.message);
  } catch {
    return result(500, "Could not attach document");
  }
}
export async function viewAssessmentDocumentAction(assessmentId: number, documentId: number) {
  const session = await requireSession();
  if (![assessmentId, documentId].every((id) => Number.isSafeInteger(id) && id > 0))
    return result(422, "Invalid document");
  if (
    !hasPermission(session.grants, "ORG_ASSESSMENT_VIEW", { pillarId: 5 }) ||
    !hasPermission(session.grants, "DOCUMENT_DOWNLOAD", { pillarId: 5 })
  )
    return result(403, "Permission denied");
  try {
    const client = await api();
    const assessment = await client.get(assessmentId);
    if (!assessment || !assessment.documents.some((check) => check.documentId === documentId))
      return result(404, "Document not found");
    const response = await client.viewDocument(documentId);
    return result(response.resultCode, response.message);
  } catch {
    return result(500, "Could not open document");
  }
}
