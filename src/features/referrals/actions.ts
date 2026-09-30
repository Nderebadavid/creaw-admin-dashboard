"use server";
/**
 * Server Actions for referral creation, decisions, edits, withdrawal and export.
 *
 * Each action re-checks the session and validates its input with Zod before
 * checking permission (and pillar scope where it applies), then calls the
 * feature API and revalidates affected routes. The API enforces the same
 * rules again and writes the audit entry; these checks only fail fast.
 */

import { revalidatePath } from "next/cache";
import { actionResult } from "@/lib/api/action-result";
import { sortedPage } from "@/lib/api/sorted-page";
import { referralSortValues } from "./sort-values";
import { withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasModulePermission, hasPermission } from "@/lib/auth/permissions";
import { auditedExportAction } from "@/components/portal/data-actions";
import { createReferralsApi, type ReferralQuery } from "./api";
import { referralCreateSchema, referralDecisionSchema, referralEditSchema } from "./schemas";

function api() {
  return withSessionApi(createReferralsApi);
}

export async function listReferralsAction(query: ReferralQuery) {
  const session = await requireSession();
  if (!hasModulePermission(session.grants, "REFERRAL_VIEW"))
    return { ...actionResult(403, "Permission denied"), data: null };
  try {
    const { list } = await api();
    return {
      ...actionResult(200, "OK"),
      data: await sortedPage((filters: ReferralQuery) => list(filters), query, referralSortValues),
    };
  } catch {
    return { ...actionResult(422, "Could not load referrals"), data: null };
  }
}

export async function createReferralAction(input: unknown) {
  const session = await requireSession();
  const parsed = referralCreateSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the referral details and try again");
  if (!hasPermission(session.grants, "REFERRAL_CREATE", { pillarId: parsed.data.fromPillarId }))
    return actionResult(403, "You cannot refer from this pillar");
  try {
    const client = await api();
    const origin = await client.getOrigin(parsed.data.enrollmentId);
    if (!origin || origin.pillar_id !== parsed.data.fromPillarId || origin.participant_id === null)
      return actionResult(422, "Select a participant enrollment in the referring pillar");
    const response = await client.create(parsed.data);
    if (response.success) revalidatePath("/referrals");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not create referral");
  }
}

export async function respondReferralAction(input: unknown) {
  const session = await requireSession();
  const parsed = referralDecisionSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the decision and try again");
  try {
    const client = await api();
    const referral = await client.getRaw(parsed.data.id);
    if (!referral) return actionResult(404, "Referral not found");
    if (!hasPermission(session.grants, "REFERRAL_ACCEPT", { pillarId: referral.to_pillar_id }))
      return actionResult(403, "Only the receiving pillar can decide this referral");
    if (referral.status !== "NEW") return actionResult(422, "Referral already decided");
    const response = await client.respond(parsed.data.id, parsed.data.decision, parsed.data.note);
    if (response.success) {
      revalidatePath("/referrals");
      revalidatePath("/participants");
    }
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not save the decision");
  }
}

export async function editReferralAction(input: unknown) {
  const session = await requireSession();
  const parsed = referralEditSchema.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the referral reason");
  try {
    const client = await api();
    const referral = await client.getRaw(parsed.data.id);
    if (!referral) return actionResult(404, "Referral not found");
    if (!hasPermission(session.grants, "REFERRAL_CREATE", { pillarId: referral.from_pillar_id }))
      return actionResult(403, "Only the referring pillar can edit this referral");
    const response = await client.edit(parsed.data.id, parsed.data.reason);
    if (response.success) revalidatePath("/referrals");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not edit referral");
  }
}

export async function withdrawReferralAction(id: number) {
  const session = await requireSession();
  if (!Number.isSafeInteger(id) || id < 1) return actionResult(422, "Invalid referral");
  try {
    const client = await api();
    const referral = await client.getRaw(id);
    if (!referral) return actionResult(404, "Referral not found");
    if (!hasPermission(session.grants, "REFERRAL_CREATE", { pillarId: referral.from_pillar_id }))
      return actionResult(403, "Only the referring pillar can withdraw this referral");
    const response = await client.withdraw(id);
    if (response.success) revalidatePath("/referrals");
    return actionResult(response.resultCode, response.message);
  } catch {
    return actionResult(500, "Could not withdraw referral");
  }
}

export async function exportReferralsAction(query: ReferralQuery) {
  const session = await requireSession();
  if (
    !hasModulePermission(session.grants, "REFERRAL_VIEW") ||
    !hasModulePermission(session.grants, "REPORT_EXPORT_CSV")
  )
    return { success: false as const, error: "Permission denied" };
  return auditedExportAction({
    path: "/referrals",
    routeTemplate: "/referrals",
    query: { pillarId: query.pillarId, status: query.status, search: query.search },
  });
}
