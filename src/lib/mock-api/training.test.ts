/* eslint-disable @typescript-eslint/no-explicit-any -- loose envelope shapes in a contract test */
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";

beforeEach(() => resetMockStore());
const client = createApiClient(new MockApiTransport(handleMockRequest));
const raw = (userId: number, request: Record<string, unknown>) =>
  client.request(
    { token: issueMockToken(userId), ...request } as never,
    { parse: (value: unknown) => value } as never
  ) as Promise<{ success: boolean; resultCode: number; data: any; message: string }>;

// Ann Kamau (user 10): Skilling lead with trainee edit, referral create and reveal there.
const SKILLING = 10;
// Samuel Ndegwa (user 3): WEE lead who accepts referrals and prepares applications.
const WEE = 3;
// Esther Mwangi (user 9): SRHR lead with no Skilling access.
const OUTSIDER = 9;

const pillar = { path: "/pillars/skilling", routeTemplate: "/pillars/:pillar" };
const trainees = async (userId = SKILLING) =>
  (
    await raw(userId, {
      method: "GET",
      ...pillar,
      query: { table: "training_enrollment", page: 1, pageSize: 50 },
    })
  ).data.items as any[];
const trainee = async (course: string) =>
  (await trainees()).find((row) => row.course_name === course);
const patch = (id: number, body: Record<string, unknown>, userId = SKILLING) =>
  raw(userId, { method: "PATCH", ...pillar, query: { table: "training_enrollment", id }, body });
const store = () => getMockStore();
const idOf = (course: string) =>
  store().training_enrollment.find((row) => row.course_name === course)!.id;
const decide = (referralId: number, status: string, userId = WEE) =>
  raw(userId, {
    method: "PATCH",
    path: `/referrals/${referralId}`,
    routeTemplate: "/referrals/:id",
    body: { status },
  });
const recommended = (userId = WEE) =>
  raw(userId, {
    method: "GET",
    path: "/grants",
    routeTemplate: "/grants",
    query: { view: "recommended" },
  });

describe("trainee reads", () => {
  it("adds names, the institution, life-skills sessions and the grant hand-off", async () => {
    const tailoring = await trainee("Tailoring & design");
    expect(tailoring).toMatchObject({
      institution_name: "Mathare Skills Centre",
      trainer_name: "James Otieno",
      life_skills_sessions: 1,
      grant_handoff: "application_filed",
      current_work_status: "self_employed",
    });
    expect(tailoring.participant_name).toMatch(/^[A-Z][a-z]+ [A-Z]/);
    expect(String(tailoring.monthly_salary)).toContain("•");
    expect(JSON.stringify(tailoring)).not.toContain("18000");
    expect((await trainee("Catering & pastry")).grant_handoff).toBe("referred");
    expect(await trainee("Electrical installation")).toMatchObject({
      grant_handoff: "none",
      grant_referral_id: null,
      life_skills_sessions: 1,
    });
  });

  it("offers only active trainer providers to trainee editors", async () => {
    const options = await raw(SKILLING, {
      method: "GET",
      ...pillar,
      query: { table: "trainer_option" },
    });
    expect(options.data.items).toEqual([
      expect.objectContaining({ kind: "provider", name: "James Otieno" }),
    ]);
    const denied = await raw(OUTSIDER, {
      method: "GET",
      ...pillar,
      query: { table: "trainer_option" },
    });
    expect(denied.resultCode).toBe(403);
  });
});

describe("trainee outcome rules", () => {
  it("rejects values outside the fixed lists and derived fields", async () => {
    const id = idOf("ICT basics");
    expect((await patch(id, { pathway: "online" })).resultCode).toBe(422);
    const electrical = idOf("Electrical installation");
    expect((await patch(electrical, { current_work_status: "busy" })).resultCode).toBe(422);
    expect((await patch(electrical, { participant_name: "Someone" })).resultCode).toBe(422);
    expect((await patch(electrical, { grant_handoff: "awarded" })).resultCode).toBe(422);
  });

  it("keeps outcomes off ongoing trainees and dates in order", async () => {
    const ict = idOf("ICT basics");
    expect(await patch(ict, { completion_date: "2026-09-01" })).toMatchObject({
      resultCode: 422,
      message: "An ongoing trainee has no completion date or work outcome yet",
    });
    expect(await patch(ict, { training_status: "completed" })).toMatchObject({
      message: "Record the completion or drop-out date",
    });
    expect(
      await patch(ict, { training_status: "completed", completion_date: "2026-07-01" })
    ).toMatchObject({ message: "The completion date cannot be before the start date" });
    const done = await patch(ict, {
      training_status: "completed",
      completion_date: "2026-09-20",
      current_work_status: "seeking_work",
    });
    expect(done.success).toBe(true);
  });

  it("records a salary only for employed or self-employed trainees", async () => {
    const id = idOf("Hairdressing & beauty");
    expect(await patch(id, { monthly_salary: 9000 })).toMatchObject({
      message: "A salary needs an employed or self-employed work status",
    });
    const employed = await patch(id, {
      current_work_status: "employed",
      workstation: "Salon, Thika",
      monthly_salary: 9000,
    });
    expect(employed.success).toBe(true);
    expect(String(employed.data.monthly_salary)).toContain("•");
  });
});

describe("grant recommendation hand-off", () => {
  it("only recommends completed trainees", async () => {
    expect(await patch(idOf("ICT basics"), { recommended_for_grant: true })).toMatchObject({
      resultCode: 422,
      message: "Only completed trainees can be recommended for a grant",
    });
  });

  it("creates a linked WEE referral, and withdrawing while pending withdraws it", async () => {
    const id = idOf("Electrical installation");
    expect((await patch(id, { recommended_for_grant: true })).success).toBe(true);
    const referral = store().referral.at(-1)!;
    expect(referral).toMatchObject({
      from_pillar_id: 6,
      to_pillar_id: 2,
      status: "NEW",
      source_training_enrollment_id: id,
      trigger_reason:
        "Recommended for a business grant · Electrical installation (TVET) · Employed",
    });
    expect(
      store().audit_logs.some(
        (entry) =>
          entry.entity_type === "referral" &&
          entry.entity_id === referral.id &&
          entry.action === "CREATE"
      )
    ).toBe(true);
    expect((await trainee("Electrical installation")).grant_handoff).toBe("referred");
    expect(await patch(id, { training_status: "dropped_out" })).toMatchObject({
      message: "Withdraw the grant recommendation first",
    });

    expect((await patch(id, { recommended_for_grant: false })).success).toBe(true);
    expect(store().referral.find((row) => row.id === referral.id)?.status).toBe("WITHDRAWN");
    expect((await trainee("Electrical installation")).grant_handoff).toBe("none");
  });

  it("clears the flag when WEE declines, so the trainee can be recommended again", async () => {
    const id = idOf("Catering & pastry");
    const referralId = (await trainee("Catering & pastry")).grant_referral_id;
    expect((await decide(referralId, "DECLINED")).success).toBe(true);
    expect(store().training_enrollment.find((row) => row.id === id)?.recommended_for_grant).toBe(
      false
    );
    expect((await trainee("Catering & pastry")).grant_handoff).toBe("declined");
    expect((await patch(id, { recommended_for_grant: true })).success).toBe(true);
    expect((await trainee("Catering & pastry")).grant_referral_id).not.toBe(referralId);
  });

  it("locks an accepted recommendation and lists it for the application form until filed", async () => {
    const id = idOf("Catering & pastry");
    const referralId = (await trainee("Catering & pastry")).grant_referral_id;
    expect((await decide(referralId, "ACCEPTED")).success).toBe(true);
    expect((await trainee("Catering & pastry")).grant_handoff).toBe("accepted");
    expect(await patch(id, { recommended_for_grant: false })).toMatchObject({
      message: "WEE has already accepted this recommendation",
    });
    expect(await patch(id, { training_status: "dropped_out" })).toMatchObject({
      message: "WEE has already accepted this recommendation",
    });

    const listed = await recommended();
    const item = listed.data.items.find((row: any) => row.training_enrollment_id === id);
    expect(item).toMatchObject({
      referral_id: referralId,
      course_name: "Catering & pastry",
      suggested_notes: "Skilling graduate · Catering & pastry · Self-employed, Food kiosk, Kibera",
    });
    expect(JSON.stringify(listed.data)).not.toMatch(/salary/);

    const filed = await raw(WEE, {
      method: "POST",
      path: "/grants",
      routeTemplate: "/grants",
      body: {
        project_id: store().project.find((row) => row.pillar_id === 2)!.id,
        participant_id: item.participant_id,
        requested_amount: 30000,
        grant_type: "one_off",
        notes: item.suggested_notes,
        status: "PREPARED",
      },
    });
    expect(filed.success).toBe(true);
    expect((await trainee("Catering & pastry")).grant_handoff).toBe("application_filed");
    expect(
      (await recommended()).data.items.some((row: any) => row.training_enrollment_id === id)
    ).toBe(false);
  });

  it("rejects a second recommendation for someone WEE already accepted", async () => {
    // Participant 4's tailoring recommendation was accepted; give them a second course.
    const enrollment = store().enrollment.find(
      (row) => row.participant_id === 4 && row.pillar_id === 6
    )!;
    const created = await raw(SKILLING, {
      method: "POST",
      ...pillar,
      query: { table: "training_enrollment" },
      body: {
        enrollment_id: enrollment.id,
        pathway: "life_skills",
        course_name: "Bookkeeping",
        training_status: "completed",
        start_date: "2026-05-01",
        completion_date: "2026-06-30",
      },
    });
    expect(created.success).toBe(true);
    expect(await patch(created.data.id, { recommended_for_grant: true })).toMatchObject({
      message: "Already referred to WEE",
    });
  });

  it("needs referral rights in Skilling to recommend", async () => {
    const referralCreate = store().permission.find((row) => row.code === "REFERRAL_CREATE")!;
    for (const link of store().role_permission)
      if (link.permission_id === referralCreate.id) link.is_deleted = true;
    expect(
      await patch(idOf("Electrical installation"), { recommended_for_grant: true })
    ).toMatchObject({ resultCode: 403, message: "You cannot refer trainees to WEE" });
    // Outcome edits still work without referral rights.
    expect(
      (await patch(idOf("Electrical installation"), { workstation: "Kenya Power" })).success
    ).toBe(true);
  });

  it("never lets a client link a referral to a trainee itself", async () => {
    const enrollment = store().enrollment.find((row) => row.pillar_id === 6)!;
    const result = await raw(SKILLING, {
      method: "POST",
      path: "/referrals",
      routeTemplate: "/referrals",
      body: {
        enrollment_id: enrollment.id,
        from_pillar_id: 6,
        to_pillar_id: 2,
        trigger_reason: "Manual",
        source_training_enrollment_id: 1,
      },
    });
    expect(result.resultCode).toBe(422);
  });

  it("limits the recommended list to WEE application preparers", async () => {
    expect((await recommended(SKILLING)).resultCode).toBe(403);
    expect(
      (
        await raw(WEE, {
          method: "GET",
          path: "/grants",
          routeTemplate: "/grants",
          query: { view: "recommended", page: 1 },
        })
      ).resultCode
    ).toBe(422);
  });
});
