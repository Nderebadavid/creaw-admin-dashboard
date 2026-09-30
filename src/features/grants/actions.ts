"use server";
/**
 * Server Actions for grant sign-off, disbursements, reporting periods and document access.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */
import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { readSessionToken, withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { createGrantsApi, type GrantQuery } from "./api";
import { createReportingApi } from "@/features/reporting/api";
import { advanceInputSchema, disburseInputSchema, grantPeriodInputSchema } from "./schemas";
function api() {
  return withSessionApi(createGrantsApi);
}

export async function listGrantsAction(query: GrantQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "GRANT_APPLICATION_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    return { ...actionResult(200, "OK"), data: await (await api()).list(query) };
  } catch {
    return { ...actionResult(500, "Could not load grants"), data: null };
  }
}
export async function advanceGrantAction(input: unknown) {
  const session = await requireSession();
  const parsed = advanceInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Invalid sign-off request");
  try {
    const client = await api();
    const grant = await client.get(parsed.data.id);
    if (!grant) return actionResult(404, "Application not found");
    const code = {
      PREPARED: "GRANT_APPLICATION_PREPARE",
      REVIEWED: "GRANT_APPLICATION_REVIEW",
      APPROVED: "GRANT_APPLICATION_APPROVE",
    }[parsed.data.status];
    if (!hasPermission(session.grants, code, { pillarId: grant.pillarId }))
      return actionResult(403, "You cannot perform this sign-off step");
    if (grant.nextStatus !== parsed.data.status)
      return actionResult(422, "Complete the preceding sign-off step first");
    if (
      (parsed.data.status === "REVIEWED" && !grant.signoffs.preparedBy) ||
      (parsed.data.status === "APPROVED" &&
        (!grant.signoffs.preparedBy || !grant.signoffs.reviewedBy))
    )
      return actionResult(422, "Audited prior sign-offs are required");
    if (
      (parsed.data.status === "REVIEWED" && grant.signoffs.preparedBy === session.user.id) ||
      (parsed.data.status === "APPROVED" &&
        [grant.signoffs.preparedBy, grant.signoffs.reviewedBy].includes(session.user.id))
    )
      return actionResult(403, "A different officer must complete this step");
    const response = await client.advance(grant.id, parsed.data.status);
    if (response.success) {
      revalidatePath("/grants");
      revalidatePath(`/grants/${grant.id}`);
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not record sign-off");
  }
}
export async function recordDisbursementAction(input: unknown) {
  const session = await requireSession();
  const parsed = disburseInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the payment details");
  try {
    const client = await api();
    const grant = await client.get(parsed.data.applicationId);
    if (!grant) return actionResult(404, "Application not found");
    if (!hasPermission(session.grants, "GRANT_DISBURSEMENT_RECORD", { pillarId: grant.pillarId }))
      return actionResult(403, "You cannot record this payment");
    if (grant.status !== "APPROVED" || !grant.award)
      return actionResult(422, "The application must be approved first");
    const response = await client.recordDisbursement(
      grant.award.id,
      parsed.data.amount,
      parsed.data.date,
      parsed.data.notes
    );
    if (response.success) revalidatePath(`/grants/${grant.id}`);
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not record payment");
  }
}
export async function logGrantReportAction(input: unknown) {
  const session = await requireSession();
  const parsed = grantPeriodInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the reporting period dates");
  try {
    const token = await readSessionToken();
    if (!token) return actionResult(403, "Sign in required");
    const award = (await createReportingApi(createPortalApiClient(), token).catalog()).awards.find(
      (item) => item.applicationId === parsed.data.applicationId
    );
    if (!award) return actionResult(404, "Approved award not found");
    if (!hasPermission(session.grants, "GRANT_REPORT_MANAGE", { pillarId: award.pillarId }))
      return actionResult(403, "Permission denied");
    const response = await (await api()).addGrantPeriod(award.id, parsed.data);
    if (response.success) {
      revalidatePath(`/grants/${parsed.data.applicationId}`);
      revalidatePath("/reporting");
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not log reporting period");
  }
}
export async function downloadGrantPackAction(id: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1) return actionResult(422, "Invalid application");
  try {
    const client = await api();
    const grant = await client.get(id);
    if (!grant) return actionResult(404, "Application not found");
    if (
      !hasPermission(session.grants, "GRANT_APPLICATION_VIEW", { pillarId: grant.pillarId }) ||
      !hasPermission(session.grants, "DOCUMENT_DOWNLOAD", { pillarId: grant.pillarId })
    )
      return actionResult(403, "Permission denied");
    const response = await client.downloadPack(id);
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not prepare application pack");
  }
}
export async function viewGrantDocumentAction(applicationId: number, documentId: number) {
  const session = await requireSession();
  if (![applicationId, documentId].every((id) => Number.isSafeInteger(id) && id > 0))
    return actionResult(422, "Invalid document");
  try {
    const client = await api();
    const grant = await client.get(applicationId);
    if (!grant || !grant.documents.some((document) => document.id === documentId))
      return actionResult(404, "Document not found");
    if (
      !hasPermission(session.grants, "DOCUMENT_DOWNLOAD", { pillarId: grant.pillarId }) ||
      !hasPermission(session.grants, "GRANT_APPLICATION_VIEW", { pillarId: grant.pillarId })
    )
      return actionResult(403, "Permission denied");
    const response = await client.viewDocument(documentId);
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not open document");
  }
}
export async function exportGrantsAction(query: GrantQuery) {
  const session = await requireSession();
  if (
    !hasModulePermission(session.grants, "GRANT_APPLICATION_VIEW") ||
    !hasModulePermission(session.grants, "REPORT_EXPORT_CSV")
  )
    return { success: false as const, error: "Permission denied" };
  try {
    const response = await (await api()).export(query);
    return response.success && response.data
      ? { success: true as const, filename: response.data.filename, content: response.data.content }
      : { success: false as const, error: response.message };
  } catch {
    return { success: false as const, error: "Could not export grants" };
  }
}
