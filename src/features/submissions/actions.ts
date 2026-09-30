"use server";
/**
 * Server Actions for field submission review.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */

import { revalidatePath } from "next/cache";
import { readSessionToken } from "@/lib/api/session-api";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { createSubmissionsApi } from "./api";
import { reviewInputSchema } from "./schemas";

export async function reviewSubmissionAction(
  id: number,
  decision: "approve" | "flag"
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();
  const parsed = reviewInputSchema.safeParse({ id, decision });
  if (!parsed.success) return { success: false, message: "Invalid submission review." };
  if (!session.grants.some((grant) => grant.permissionCode === "FIELD_SUBMISSION_REVIEW"))
    return { success: false, message: "You cannot review field submissions." };
  const token = await readSessionToken();
  if (!token) return { success: false, message: "Sign in required." };
  const api = createSubmissionsApi(createPortalApiClient(), token);
  try {
    const submission = await api.get(parsed.data.id);
    if (!submission) return { success: false, message: "Submission not found." };
    if (
      submission.pillarId === null ||
      !hasPermission(session.grants, "FIELD_SUBMISSION_REVIEW", { pillarId: submission.pillarId })
    )
      return { success: false, message: "You cannot review this pillar's submissions." };
    if (submission.status === "Approved")
      return { success: false, message: "Submission is already approved." };
    const result = await api.review(parsed.data.id, parsed.data.decision);
    if (!result.success) return { success: false, message: result.message };
    revalidatePath("/field-submissions");
    revalidatePath("/dashboard");
    return {
      success: true,
      message:
        parsed.data.decision === "approve"
          ? "Submission approved."
          : "Submission flagged for follow-up.",
    };
  } catch {
    return { success: false, message: "Submission review failed. Please try again." };
  }
}
