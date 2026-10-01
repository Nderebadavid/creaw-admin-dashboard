import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { logCounsellingAction, updateCounsellingAction } from "./actions";

// Cynthia Chelimo (user 6): VAWG staff counsellor. Amina Wekesa (user 7): case officer only.
// Lilian Otieno (user 5): VAWG lead with no counselling access.
const COUNSELLOR = 6;
const CASE_OFFICER = 7;
const signIn = (userId: number) =>
  cookieStore.get.mockReturnValue({ value: issueMockToken(userId) });
const store = () => getMockStore();
const base = {
  enrollmentId: 1,
  sessionDate: "2026-09-28",
  sessionType: "follow_up",
  counsellor: { kind: "staff", id: COUNSELLOR },
  notes: "Discussed the safety plan.",
};

beforeEach(() => {
  resetMockStore();
  signIn(COUNSELLOR);
});
afterEach(() => vi.useRealTimers());

describe("logging counselling", () => {
  it("logs the survivor's next session with a staff counsellor", async () => {
    expect((await logCounsellingAction(base)).success).toBe(true);
    expect(store().counselling_session.at(-1)).toMatchObject({
      enrollment_id: 1,
      session_no: 5,
      counsellor_user_id: COUNSELLOR,
      counsellor_provider_id: null,
      notes: "Discussed the safety plan.",
    });
  });

  it("logs with an external counsellor and rejects anyone not on the list", async () => {
    expect(
      (await logCounsellingAction({ ...base, counsellor: { kind: "provider", id: 1 } })).success
    ).toBe(true);
    expect(
      await logCounsellingAction({ ...base, counsellor: { kind: "provider", id: 2 } })
    ).toMatchObject({
      resultCode: 422,
      message: "Choose a counsellor from the list",
    });
    expect(
      await logCounsellingAction({ ...base, counsellor: { kind: "staff", id: CASE_OFFICER } })
    ).toMatchObject({ message: "Choose a counsellor from the list" });
  });

  it("refuses future dates, non-VAWG enrollments and users without log rights", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T20:00:00Z")); // 23:00 in Nairobi
    expect(await logCounsellingAction({ ...base, sessionDate: "2026-10-01" })).toMatchObject({
      message: "A session cannot be logged for a future date",
    });
    expect((await logCounsellingAction({ ...base, sessionDate: "2026-09-30" })).success).toBe(true);
    vi.useRealTimers();
    const wee = store().enrollment.find((row) => row.pillar_id === 2)!.id;
    expect(await logCounsellingAction({ ...base, enrollmentId: wee })).toMatchObject({
      message: "Choose a survivor enrolled in VAWG",
    });
    signIn(CASE_OFFICER);
    expect(await logCounsellingAction(base)).toMatchObject({ resultCode: 403 });
  });
});

describe("editing counselling", () => {
  const firstSession = () => store().counselling_session.find((row) => row.enrollment_id === 1)!;

  it("keeps the notes on file when left blank and keeps a counsellor who has since left", async () => {
    store().external_provider.find((row) => row.id === 1)!.status = "INACTIVE";
    const session = firstSession();
    const result = await updateCounsellingAction({
      sessionId: session.id,
      sessionDate: "2026-02-15",
      sessionType: "psychological_first_aid",
      counsellor: { kind: "provider", id: 1 },
      notes: "",
    });
    expect(result.success).toBe(true);
    expect(firstSession()).toMatchObject({
      session_no: 1,
      session_date: "2026-02-15",
      counsellor_provider_id: 1,
      notes: "Initial confidential counselling session.",
    });
  });

  it("never saves masked text over the notes", async () => {
    const session = firstSession();
    expect(
      await updateCounsellingAction({
        sessionId: session.id,
        sessionDate: "2026-02-14",
        sessionType: "follow_up",
        counsellor: { kind: "provider", id: 1 },
        notes: "••••••••sion.",
      })
    ).toMatchObject({ resultCode: 422 });
  });
});
