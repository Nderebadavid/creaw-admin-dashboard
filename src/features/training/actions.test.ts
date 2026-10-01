import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import {
  enrolTraineeAction,
  recordOutcomeAction,
  revealSalaryAction,
  setRecommendationAction,
  updateTraineeAction,
} from "./actions";
import { trainingApi } from "./api";

// Ann Kamau (user 10): Skilling lead. Samuel Ndegwa (user 3): WEE lead, no Skilling rights.
// Esther Mwangi (user 9): SRHR lead, no Skilling rights.
const SKILLING = 10;
const WEE = 3;
const OUTSIDER = 9;
const signIn = (userId: number) =>
  cookieStore.get.mockReturnValue({ value: issueMockToken(userId) });
const store = () => getMockStore();
const traineeId = (course: string) =>
  store().training_enrollment.find((row) => row.course_name === course)!.id;
const traineeRow = (course: string) =>
  store().training_enrollment.find((row) => row.course_name === course)!;
const skillingEnrollment = (participantId: number) =>
  store().enrollment.find((row) => row.participant_id === participantId && row.pillar_id === 6)!.id;

beforeEach(() => {
  resetMockStore();
  signIn(SKILLING);
});

describe("trainee workspace", () => {
  it("names trainees and sums completion, work and grant counts", async () => {
    const workspace = await trainingApi.workspace({ canEdit: true });
    expect(workspace.trainees).toHaveLength(5);
    expect(workspace.trainees.every((row) => !/#\d/.test(row.name))).toBe(true);
    expect(workspace.summary).toMatchObject({
      enrolled: 5,
      completed: 3,
      droppedOut: 1,
      completionRate: 75,
      inWork: 3,
      inWorkRate: 100,
      recommended: 2,
      acceptedByWee: 1,
    });
    const tailoring = workspace.trainees.find((row) => row.course === "Tailoring & design")!;
    expect(tailoring).toMatchObject({
      institution: "Mathare Skills Centre",
      trainer: "James Otieno",
      handoff: { stage: "application_filed" },
    });
    expect(tailoring.salary).toContain("•");
    expect(workspace.trainers).toEqual([{ id: 3, label: expect.stringMatching(/^James Otieno/) }]);
    expect(workspace.enrollments.length).toBeGreaterThan(0);
    expect(workspace.institutions.some((row) => row.label === "Mathare Skills Centre")).toBe(true);
  });

  it("leaves out the form options for users who cannot edit", async () => {
    const workspace = await trainingApi.workspace();
    expect(workspace.enrollments).toEqual([]);
    expect(workspace.trainers).toEqual([]);
  });
});

describe("placement actions", () => {
  const placement = {
    pathway: "tvet",
    course: "Plumbing",
    institutionId: 1,
    trainerId: 3,
    startDate: "2026-09-01",
  };

  it("enrols a Skilling participant with a trainer", async () => {
    const result = await enrolTraineeAction({ ...placement, enrollmentId: skillingEnrollment(7) });
    expect(result.success).toBe(true);
    expect(store().training_enrollment.at(-1)).toMatchObject({
      course_name: "Plumbing",
      trainer_provider_id: 3,
      training_status: "ongoing",
    });
  });

  it("rejects an enrollment outside Skilling, a non-trainer and users without rights", async () => {
    const vawg = store().enrollment.find((row) => row.pillar_id === 1)!.id;
    expect(await enrolTraineeAction({ ...placement, enrollmentId: vawg })).toMatchObject({
      resultCode: 422,
    });
    expect(
      await enrolTraineeAction({ ...placement, enrollmentId: skillingEnrollment(7), trainerId: 1 })
    ).toMatchObject({ message: "Choose a trainer from the list" });
    signIn(OUTSIDER);
    expect(
      await enrolTraineeAction({ ...placement, enrollmentId: skillingEnrollment(7) })
    ).toMatchObject({ resultCode: 403 });
  });

  it("keeps a trainer who has since been deactivated", async () => {
    store().external_provider.find((row) => row.id === 3)!.status = "INACTIVE";
    const result = await updateTraineeAction({
      ...placement,
      traineeId: traineeId("Tailoring & design"),
      pathway: "apprenticeship",
      course: "Tailoring & design",
      institutionId: 7,
      startDate: "2025-11-09",
    });
    expect(result.success).toBe(true);
    expect(traineeRow("Tailoring & design").trainer_provider_id).toBe(3);
  });
});

describe("outcome action", () => {
  const outcome = (course: string, change: Record<string, unknown>) =>
    recordOutcomeAction({
      traineeId: traineeId(course),
      status: "completed",
      completionDate: "2026-09-25",
      workStatus: "employed",
      workstation: "",
      salary: null,
      ...change,
    });

  it("keeps the salary on file when none is entered", async () => {
    const result = await outcome("Tailoring & design", {
      workStatus: "self_employed",
      workstation: "Own studio",
    });
    expect(result.success).toBe(true);
    expect(traineeRow("Tailoring & design")).toMatchObject({
      workstation: "Own studio",
      monthly_salary: 18000,
    });
  });

  it("clears the salary and workplace when the trainee is no longer earning", async () => {
    expect(
      (await outcome("Electrical installation", { workStatus: "seeking_work", workstation: "X" }))
        .success
    ).toBe(true);
    expect(traineeRow("Electrical installation")).toMatchObject({
      current_work_status: "seeking_work",
      workstation: null,
      monthly_salary: null,
    });
  });

  it("clears the whole outcome when training is ongoing again, and needs a date otherwise", async () => {
    expect(
      (await outcome("Hairdressing & beauty", { status: "ongoing", workStatus: "seeking_work" }))
        .success
    ).toBe(true);
    expect(traineeRow("Hairdressing & beauty")).toMatchObject({
      training_status: "ongoing",
      completion_date: null,
      current_work_status: null,
    });
    expect(await outcome("ICT basics", { completionDate: "" })).toMatchObject({
      message: "Record the completion or drop-out date",
    });
  });
});

describe("grant recommendation action", () => {
  it("refers a completed trainee to WEE and withdraws a pending recommendation", async () => {
    const id = traineeId("Electrical installation");
    expect((await setRecommendationAction({ traineeId: id, recommend: true })).success).toBe(true);
    const referral = store().referral.at(-1)!;
    expect(referral).toMatchObject({ source_training_enrollment_id: id, status: "NEW" });
    expect((await setRecommendationAction({ traineeId: id, recommend: false })).success).toBe(true);
    expect(store().referral.find((row) => row.id === referral.id)?.status).toBe("WITHDRAWN");
  });

  it("refuses ongoing trainees and users without Skilling referral rights", async () => {
    expect(
      await setRecommendationAction({ traineeId: traineeId("ICT basics"), recommend: true })
    ).toMatchObject({ message: "Only completed trainees can be recommended for a grant" });
    signIn(WEE);
    expect(
      await setRecommendationAction({
        traineeId: traineeId("Electrical installation"),
        recommend: true,
      })
    ).toMatchObject({ resultCode: 403 });
  });

  it("explains why an accepted recommendation cannot be withdrawn", async () => {
    expect(
      await setRecommendationAction({
        traineeId: traineeId("Tailoring & design"),
        recommend: false,
      })
    ).toMatchObject({ message: "WEE has already accepted this recommendation" });
  });
});

describe("salary reveal", () => {
  it("reveals the salary in shillings to Skilling reveal holders only", async () => {
    expect(await revealSalaryAction(traineeId("Tailoring & design"))).toEqual({
      success: true,
      value: "KES 18,000",
    });
    signIn(OUTSIDER);
    expect(await revealSalaryAction(traineeId("Tailoring & design"))).toMatchObject({
      success: false,
    });
  });
});
