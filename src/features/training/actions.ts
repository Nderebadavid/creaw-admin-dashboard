"use server";
/**
 * Server Actions for Skilling trainees: enrolling and editing a placement,
 * recording its outcome, recommending a graduate to WEE for a business grant,
 * and the audited salary reveal.
 *
 * Each action re-checks the session, validates its input and checks the
 * permission in the Skilling pillar before calling the API, which enforces the
 * same rules again and writes the audit entry.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RevealResult } from "@/components/ui/masked-field";
import { actionResult } from "@/lib/api/action-result";
import { withSessionApi } from "@/lib/api/session-api";
import { requireSession } from "@/lib/auth/session-server";
import { hasPermission } from "@/lib/auth/permissions";
import { createTrainingApi } from "./api";
import {
  earningStatuses,
  pathways,
  placedStatuses,
  TRAINING_PILLAR_ID,
  trainingStatuses,
  workStatuses,
} from "./model";

const scope = { pillarId: TRAINING_PILLAR_ID };
const id = z.number().int().positive();
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const optionalDate = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.iso.date().nullable());
const placementInput = z.object({
  traineeId: id.optional(),
  enrollmentId: id.optional(),
  pathway: z.enum(pathways),
  course: text(160),
  institutionId: id.nullable(),
  trainerId: id.nullable(),
  startDate: optionalDate,
});
const outcomeInput = z.object({
  traineeId: id,
  status: z.enum(trainingStatuses),
  completionDate: optionalDate,
  workStatus: z.enum(workStatuses).nullable(),
  workstation: text(160),
  /** A new salary; null keeps the one on file. */
  salary: z.number().positive().max(10_000_000).nullable(),
});
const recommendInput = z.object({ traineeId: id, recommend: z.boolean() });
const api = () => withSessionApi(createTrainingApi);
const done = (response: { success: boolean; resultCode: number; message: string }) => {
  if (response.success) {
    revalidatePath("/pillars/skilling");
    revalidatePath("/referrals");
  }
  return actionResult(response.resultCode, response.message);
};
const canEdit = async () =>
  hasPermission((await requireSession()).grants, "TRAINING_ENROLLMENT_EDIT", scope);

/** Validates a placement form; the API values, or an error result. */
async function placementValues(input: unknown) {
  const parsed = placementInput.safeParse(input);
  if (!parsed.success)
    return { error: actionResult(422, "Check the placement details and try again") };
  if (!(await canEdit()))
    return { error: actionResult(403, "You cannot manage trainees in Skilling") };
  const value = parsed.data;
  const client = await api();
  const current = value.traineeId ? await client.trainee(value.traineeId) : undefined;
  if (value.traineeId && !current) return { error: actionResult(404, "Trainee not found") };
  // A trainer must be an active trainer, unless an edit keeps the one already set.
  if (value.trainerId !== null && current?.trainer_provider_id !== value.trainerId) {
    const trainers = await client.trainers();
    if (!trainers.some((item) => item.id === value.trainerId))
      return { error: actionResult(422, "Choose a trainer from the list") };
  }
  return {
    value,
    body: {
      pathway: value.pathway,
      course_name: value.course,
      partner_institution_id: value.institutionId,
      trainer_provider_id: value.trainerId,
      start_date: value.startDate,
    },
  };
}

export async function enrolTraineeAction(input: unknown) {
  try {
    const checked = await placementValues(input);
    if (checked.error) return checked.error;
    if (!checked.value.enrollmentId) return actionResult(422, "Choose a Skilling participant");
    const client = await api();
    const enrollments = await client.enrollmentOptions();
    if (!enrollments.some((item) => item.id === checked.value.enrollmentId))
      return actionResult(422, "Choose a participant enrolled in Skilling");
    return done(
      await client.create({ ...checked.body, enrollment_id: checked.value.enrollmentId })
    );
  } catch {
    return actionResult(500, "Could not enrol the trainee");
  }
}

export async function updateTraineeAction(input: unknown) {
  try {
    const checked = await placementValues(input);
    if (checked.error) return checked.error;
    if (!checked.value.traineeId) return actionResult(422, "Check the placement details");
    return done(await (await api()).update(checked.value.traineeId, checked.body));
  } catch {
    return actionResult(500, "Could not update the trainee");
  }
}

/**
 * Records how training ended and what came after. Only the fields that apply to
 * the chosen status are kept: an ongoing trainee has no outcome, a workplace is
 * named only for those placed, and a salary only for those earning.
 */
export async function recordOutcomeAction(input: unknown) {
  const parsed = outcomeInput.safeParse(input);
  if (!parsed.success) return actionResult(422, "Check the outcome details and try again");
  if (!(await canEdit())) return actionResult(403, "You cannot manage trainees in Skilling");
  const { traineeId, status, completionDate, workStatus, workstation, salary } = parsed.data;
  if (status !== "ongoing" && !completionDate)
    return actionResult(422, "Record the completion or drop-out date");
  const finished = status !== "ongoing";
  const placed = finished && workStatus !== null && placedStatuses.includes(workStatus);
  const earning = finished && workStatus !== null && earningStatuses.includes(workStatus);
  try {
    return done(
      await (
        await api()
      ).update(traineeId, {
        training_status: status,
        completion_date: finished ? completionDate : null,
        current_work_status: finished ? workStatus : null,
        workstation: placed ? workstation : null,
        ...(earning
          ? salary === null
            ? {}
            : { monthly_salary: salary }
          : { monthly_salary: null }),
      })
    );
  } catch {
    return actionResult(500, "Could not record the outcome");
  }
}

/** Recommends a completed trainee to WEE for a business grant, or withdraws a pending one. */
export async function setRecommendationAction(input: unknown) {
  const session = await requireSession();
  const parsed = recommendInput.safeParse(input);
  if (!parsed.success) return actionResult(422, "Choose a trainee");
  if (
    !hasPermission(session.grants, "TRAINING_ENROLLMENT_EDIT", scope) ||
    !hasPermission(session.grants, "REFERRAL_CREATE", scope)
  )
    return actionResult(403, "You cannot refer trainees to WEE");
  const { traineeId, recommend } = parsed.data;
  try {
    const client = await api();
    const trainee = await client.trainee(traineeId);
    if (!trainee) return actionResult(404, "Trainee not found");
    if (recommend && trainee.training_status !== "completed")
      return actionResult(422, "Only completed trainees can be recommended for a grant");
    if (trainee.recommended_for_grant === recommend)
      return actionResult(422, recommend ? "Already recommended" : "Not recommended");
    return done(await client.update(traineeId, { recommended_for_grant: recommend }));
  } catch {
    return actionResult(500, "Could not save the recommendation");
  }
}

export async function revealSalaryAction(traineeId: number): Promise<RevealResult> {
  const session = await requireSession();
  if (!Number.isSafeInteger(traineeId) || traineeId < 1)
    return { success: false, error: "Invalid trainee" };
  if (!hasPermission(session.grants, "SENSITIVE_REVEAL", scope))
    return { success: false, error: "Permission denied" };
  try {
    const result = await (await api()).revealSalary(traineeId);
    if (!result.success || result.value === null)
      return { success: false, error: result.message || "Nothing to reveal" };
    return { success: true, value: `KES ${Number(result.value).toLocaleString("en-KE")}` };
  } catch {
    return { success: false, error: "Could not reveal the salary" };
  }
}
