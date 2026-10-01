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

// Cynthia Chelimo (user 6): VAWG case officer and staff counsellor, logs counselling.
const COUNSELLOR = 6;
// Lilian Otieno (user 5): VAWG lead with reveal rights but no counselling access.
// Amina Wekesa (user 7): VAWG case officer, not a counsellor.
const CASE_OFFICER = 7;

const pillar = { path: "/pillars/vawg", routeTemplate: "/pillars/:pillar" };
const store = () => getMockStore();
const sessions = async (userId = COUNSELLOR) =>
  (
    await raw(userId, {
      method: "GET",
      ...pillar,
      query: { table: "counselling_session", page: 1, pageSize: 50 },
    })
  ).data?.items as any[];
const log = (body: Record<string, unknown>, userId = COUNSELLOR) =>
  raw(userId, {
    method: "POST",
    ...pillar,
    query: { table: "counselling_session" },
    body: {
      enrollment_id: 1,
      session_date: "2026-09-28",
      session_type: "follow_up",
      counsellor_user_id: COUNSELLOR,
      notes: "Discussed safety plan.",
      ...body,
    },
  });
const edit = (id: number, body: Record<string, unknown>, userId = COUNSELLOR) =>
  raw(userId, { method: "PATCH", ...pillar, query: { table: "counselling_session", id }, body });

describe("logging counselling", () => {
  it("numbers a survivor's next session and rejects client numbering", async () => {
    const logged = await log({});
    expect(logged.success).toBe(true);
    expect(store().counselling_session.at(-1)).toMatchObject({
      enrollment_id: 1,
      session_no: 5,
      counsellor_user_id: COUNSELLOR,
    });
    expect(await log({ session_no: 9 })).toMatchObject({
      resultCode: 422,
      message: "Session numbers are assigned by the system",
    });
    expect(await edit(logged.data.id, { session_no: 1 })).toMatchObject({
      message: "Session numbers are assigned by the system",
    });
    expect(await edit(logged.data.id, { enrollment_id: 7 })).toMatchObject({
      message: "A session cannot move to another survivor",
    });
  });

  it("checks the session type and keeps derived names out of writes", async () => {
    expect((await log({ session_type: "individual" })).resultCode).toBe(422);
    expect((await log({ counsellor_name: "Someone" })).resultCode).toBe(422);
  });

  it("links one active counsellor: a staff counsellor or an external counsellor", async () => {
    expect(await log({ counsellor_provider_id: 1 })).toMatchObject({
      message: "Choose one counsellor",
    });
    expect(await log({ counsellor_user_id: CASE_OFFICER })).toMatchObject({
      message: "Choose a counsellor from the list",
    });
    expect(await log({ counsellor_user_id: null, counsellor_provider_id: 2 })).toMatchObject({
      message: "Choose a counsellor from the list",
    });
    expect((await log({ counsellor_user_id: null, counsellor_provider_id: 1 })).success).toBe(true);
  });

  it("lets an edit keep a counsellor who has since left", async () => {
    store().user.find((row) => row.id === COUNSELLOR)!.status = "INACTIVE";
    const session = store().counselling_session.find(
      (row) => row.counsellor_user_id === COUNSELLOR
    )!;
    // Judy Mwangi (user 1) edits, since the counsellor's own account is now inactive.
    expect((await edit(session.id, { session_type: "follow_up" }, 1)).success).toBe(true);
  });

  it("refuses users without counselling log rights", async () => {
    expect((await log({}, CASE_OFFICER)).resultCode).toBe(403);
  });
});

describe("reading counselling", () => {
  it("names the counsellor, tags staff or provider, and returns the notes in full", async () => {
    const rows = await sessions();
    expect(rows.find((row) => row.enrollment_id === 1 && row.session_no === 1)).toMatchObject({
      counsellor_name: "Faith Kimani",
      counsellor_kind: "provider",
    });
    expect(rows.find((row) => row.enrollment_id === 7)).toMatchObject({
      counsellor_name: "Cynthia Chelimo",
      counsellor_kind: "staff",
    });
    const stored = getMockStore().counselling_session.find((row) => row.notes !== null)!;
    expect(rows.find((row) => row.id === stored.id)?.notes).toBe(stored.notes);
  });

  it("offers active staff and external counsellors, names only, to loggers", async () => {
    const options = await raw(COUNSELLOR, {
      method: "GET",
      ...pillar,
      query: { table: "counsellor_option" },
    });
    expect(options.data.items).toEqual([
      { kind: "staff", id: COUNSELLOR, name: "Cynthia Chelimo", detail: "CREAW staff" },
      expect.objectContaining({ kind: "provider", id: 1, name: "Faith Kimani" }),
    ]);
    expect(JSON.stringify(options.data)).not.toMatch(/@|07\d\d/);
    const denied = await raw(CASE_OFFICER, {
      method: "GET",
      ...pillar,
      query: { table: "counsellor_option" },
    });
    expect(denied.resultCode).toBe(403);
  });
});
