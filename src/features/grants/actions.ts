"use server";
import type { ViewedDocument } from "@/components/ui/document-viewer";
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
import { sortedPage } from "@/lib/api/sorted-page";
import { grantSortValues } from "./sort-values";
import { readSessionToken, withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { createGrantsApi, type GrantQuery } from "./api";
import { createReportingApi } from "@/features/reporting/api";
import { createParticipantsApi } from "@/features/participants/api";
import {
  advanceInputSchema,
  applicationCreateSchema,
  declineInputSchema,
  disburseInputSchema,
  grantPeriodInputSchema,
} from "./schemas";
function api() {
  return withSessionApi(createGrantsApi);
}

export async function listGrantsAction(query: GrantQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "GRANT_APPLICATION_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const { list } = await api();
    return {
      ...actionResult(200, "OK"),
      data: await sortedPage((filters: GrantQuery) => list(filters), query, grantSortValues),
    };
  } catch {
    return { ...actionResult(500, "Could not load grants"), data: null };
  }
}
/**
 * Skilling graduates WEE has accepted for a grant and not yet filed for: the
 * "Recommended by Skilling" group on the new-application form. Never includes salary.
 */
export async function listGrantRecommendationsAction() {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "GRANT_APPLICATION_PREPARE"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    return { ...actionResult(200, "OK"), data: await (await api()).recommendations() };
  } catch {
    return { ...actionResult(500, "Could not load Skilling recommendations"), data: null };
  }
}

/**
 * Files a new application from the grants queue. The applicant must already
 * be enrolled in the programme's pillar, and the officer filing it needs the
 * prepare permission there.
 */
export async function createGrantApplicationAction(input: unknown) {
  const session = await requireSession();
  const parsed = applicationCreateSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the application details and try again");
  try {
    const client = await api();
    const programme = (await client.programmes()).find((item) => item.id === parsed.data.projectId);
    if (!programme) return actionResult(404, "Programme not found");
    if (
      !hasPermission(session.grants, "GRANT_APPLICATION_PREPARE", { pillarId: programme.pillarId })
    )
      return actionResult(403, "You cannot file applications for this programme");
    const applicant = await (
      await withSessionApi(createParticipantsApi)
    ).get(parsed.data.participantId);
    if (!applicant?.pillarIds.includes(programme.pillarId))
      return actionResult(422, "The applicant is not enrolled in this programme's pillar");
    const response = await client.create(parsed.data);
    if (response.success) {
      revalidatePath("/grants");
      revalidatePath("/dashboard");
    }
    return actionResult(response.resultCode, response.message, response.data?.id);
  } catch {
    return actionResult(500, "Could not file the application");
  }
}

/** Permission needed to sign each step; declining needs the next step's permission. */
const STEP_PERMISSION = {
  PREPARED: "GRANT_APPLICATION_PREPARE",
  REVIEWED: "GRANT_APPLICATION_REVIEW",
  APPROVED: "GRANT_APPLICATION_APPROVE",
} as const;

/** Maker-checker: an officer who signed an earlier step cannot also decide the next one. */
function signedEarlierStep(
  grant: {
    nextStatus: string | null;
    signoffs: { preparedBy: number | null; reviewedBy: number | null };
  },
  userId: number
) {
  if (grant.nextStatus === "REVIEWED") return grant.signoffs.preparedBy === userId;
  if (grant.nextStatus === "APPROVED")
    return [grant.signoffs.preparedBy, grant.signoffs.reviewedBy].includes(userId);
  return false;
}

/**
 * Declines an application that is still in its sign-off chain. The officer
 * whose turn it is decides, under the same maker-checker rule as signing;
 * the reason is kept on the record and the decision is final.
 */
export async function declineGrantAction(input: unknown) {
  const session = await requireSession();
  const parsed = declineInputSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Give a reason of up to 255 characters");
  try {
    const client = await api();
    const grant = await client.get(parsed.data.id);
    if (!grant) return actionResult(404, "Application not found");
    if (!grant.nextStatus)
      return actionResult(422, "Only an application still awaiting sign-off can be declined");
    if (
      !hasPermission(session.grants, STEP_PERMISSION[grant.nextStatus], {
        pillarId: grant.pillarId,
      })
    )
      return actionResult(403, "Only the officer for the next sign-off step can decline");
    if (signedEarlierStep(grant, session.user.id))
      return actionResult(403, "A different officer must decide this sign-off step");
    const response = await client.decline(grant.id, parsed.data.reason);
    if (response.success) {
      revalidatePath("/grants");
      revalidatePath(`/grants/${grant.id}`);
      revalidatePath("/dashboard");
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not decline the application");
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
    const code = STEP_PERMISSION[parsed.data.status];
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
    if (signedEarlierStep(grant, session.user.id))
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
    return { ...actionResult(422, "Invalid document"), document: null };
  try {
    const client = await api();
    const grant = await client.get(applicationId);
    if (!grant || !grant.documents.some((document) => document.id === documentId))
      return { ...actionResult(404, "Document not found"), document: null };
    if (
      !hasPermission(session.grants, "DOCUMENT_DOWNLOAD", { pillarId: grant.pillarId }) ||
      !hasPermission(session.grants, "GRANT_APPLICATION_VIEW", { pillarId: grant.pillarId })
    )
      return { ...actionResult(403, "Permission denied"), document: null };
    const response = await client.viewDocument(documentId);
    const file = response.success ? response.data : null;
    return {
      ...actionResult(response.resultCode, response.message),
      document: file
        ? ({
            id: file.id,
            name: grant.documents.find((document) => document.id === documentId)!.name,
            documentType: file.document_type,
            fileUrl: file.file_url,
            linkedRecord: `${grant.applicant} · Grant application #${grant.id}`,
          } satisfies ViewedDocument)
        : null,
    };
  } catch {
    return { ...actionResult(500, "Could not open document"), document: null };
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
