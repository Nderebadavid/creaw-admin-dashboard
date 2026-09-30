import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ userId: 1, token: "" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session-server", () => ({
  requireSession: async () => ({
    user: { id: state.userId },
    grants: (await import("@/lib/auth/permissions")).getEffectiveGrants(state.userId),
  }),
}));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import {
  advanceGrantAction,
  createGrantApplicationAction,
  declineGrantAction,
  logGrantReportAction,
} from "./actions";
import { createGrantsApi } from "./api";

beforeEach(() => {
  resetMockStore();
  state.userId = 1;
  state.token = issueMockToken(1);
});
const asUser = (id: number) => {
  state.userId = id;
  state.token = issueMockToken(id);
};

describe("grant Server Actions", () => {
  it("rechecks prior sign-off actor even when the officer has review permission", async () => {
    asUser(4); // Seeded preparer for application 3.
    expect((await advanceGrantAction({ id: 3, status: "REVIEWED" })).resultCode).toBe(403);
    expect(getMockStore().grant_application[2].status).toBe("PREPARED");
  });

  it("allows a scoped grant-report manager without award-view permission to log a period", async () => {
    const store = getMockStore();
    store.user[12].status = "ACTIVE";
    const roleId = store.user_role.find((row) => row.user_id === 13)!.role_id;
    for (const code of ["GRANT_APPLICATION_VIEW", "GRANT_REPORT_MANAGE"]) {
      const permission = store.permission.find((row) => row.code === code)!;
      store.role_permission.push({
        ...store.role_permission[0],
        id: 1000 + permission.id,
        role_id: roleId,
        permission_id: permission.id,
      });
    }
    asUser(13);
    const response = await logGrantReportAction({
      applicationId: 1,
      periodStart: "2026-10-01",
      periodEnd: "2026-12-31",
      dueDate: "2027-01-15",
    });
    expect(response.resultCode).toBe(201);
    expect(store.grant_report.at(-1)?.grant_award_id).toBe(1);
  });
});

describe("declining a grant application", () => {
  const application = (id: number) =>
    getMockStore().grant_application.find((row) => row.id === id)!;
  const api = () =>
    createGrantsApi(createApiClient(new MockApiTransport(handleMockRequest)), state.token);
  const patch = (id: number, body: unknown) =>
    handleMockRequest({
      method: "PATCH",
      path: `/grants/${id}`,
      routeTemplate: "/grants/:id",
      correlationId: "decline",
      token: state.token,
      body,
    });
  /** A seeded application that is still in its sign-off chain. */
  const inChain = () =>
    getMockStore().grant_application.find((row) =>
      ["ACTIVE", "PREPARED", "REVIEWED"].includes(row.status)
    )!;

  it("closes the application with its reason and records who declined it", async () => {
    const { id, status } = inChain();
    const audited = getMockStore().audit_logs.length;
    const result = await declineGrantAction({ id, reason: "  Business plan not viable  " });
    expect(result).toMatchObject({ success: true });
    expect(application(id)).toMatchObject({
      status: "DECLINED",
      status_description: "Business plan not viable",
    });
    expect(getMockStore().audit_logs.slice(audited).at(-1)).toMatchObject({
      entity_type: "grant_application",
      entity_id: id,
      action: "UPDATE",
      performed_by: 1,
    });
    expect(JSON.parse(getMockStore().audit_logs.at(-1)!.previous_state!).status).toBe(status);
    expect(getMockStore().grant_award.some((award) => award.application_id === id)).toBe(false);
  });

  it("is final: no sign-off, second decline or reopening afterwards", async () => {
    const { id } = inChain();
    await declineGrantAction({ id, reason: "Duplicate application" });
    const detail = await api().get(id);
    expect(detail).toMatchObject({
      status: "DECLINED",
      nextStatus: null,
      declineReason: "Duplicate application",
    });
    for (const status of ["PREPARED", "REVIEWED", "APPROVED"] as const)
      expect((await advanceGrantAction({ id, status })).success).toBe(false);
    expect((await declineGrantAction({ id, reason: "Again" })).success).toBe(false);
    for (const status of ["ACTIVE", "PREPARED", "APPROVED"])
      expect((await patch(id, { status })).resultCode).toBe(422);
    expect(application(id).status_description).toBe("Duplicate application");
  });

  it("requires a reason", async () => {
    const { id, status } = inChain();
    for (const reason of ["", "   ", "x".repeat(256), undefined])
      expect((await declineGrantAction({ id, reason })).resultCode).toBe(422);
    expect((await patch(id, { status: "DECLINED" })).resultCode).toBe(422);
    expect((await patch(id, { status: "DECLINED", status_description: " " })).resultCode).toBe(422);
    expect(application(id).status).toBe(status);
  });

  it("cannot undo an approval or change other fields along the way", async () => {
    const approved = getMockStore().grant_application.find((row) => row.status === "APPROVED")!;
    expect(
      (await declineGrantAction({ id: approved.id, reason: "Changed our mind" })).success
    ).toBe(false);
    expect(application(approved.id).status).toBe("APPROVED");
    const { id, status } = inChain();
    expect(
      (await patch(id, { status: "DECLINED", status_description: "No", requested_amount: 1 }))
        .resultCode
    ).toBe(422);
    expect(application(id).status).toBe(status);
  });

  it("is limited to an officer who could sign the next step", async () => {
    const store = getMockStore();
    const { id, status } = inChain();
    const needed = { ACTIVE: "PREPARE", PREPARED: "REVIEW", REVIEWED: "APPROVE" }[status];
    const { getEffectiveGrants } = await import("@/lib/auth/permissions");
    const outsider = store.user.find(
      (user) =>
        user.status === "ACTIVE" &&
        !getEffectiveGrants(user.id).some(
          (grant) => grant.permissionCode === `GRANT_APPLICATION_${needed}`
        )
    )!;
    asUser(outsider.id);
    expect((await declineGrantAction({ id, reason: "Not mine to decline" })).success).toBe(false);
    expect((await patch(id, { status: "DECLINED", status_description: "No" })).resultCode).toBe(
      403
    );
    expect(application(id).status).toBe(status);
  });

  it("applies maker-checker: an officer who signed an earlier step cannot decline", async () => {
    asUser(4); // Seeded preparer for application 3, who also holds the review permission.
    expect(await declineGrantAction({ id: 3, reason: "Changed my mind" })).toMatchObject({
      resultCode: 403,
      message: "A different officer must decide this sign-off step",
    });
    expect(
      await patch(3, { status: "DECLINED", status_description: "Changed my mind" })
    ).toMatchObject({ resultCode: 403 });
    expect(application(3).status).toBe("PREPARED");
    // A different officer with the review permission can.
    asUser(1);
    expect((await declineGrantAction({ id: 3, reason: "Plan not viable" })).success).toBe(true);
  });

  it("bars both earlier signers from declining at the approval step", async () => {
    asUser(1);
    expect((await advanceGrantAction({ id: 3, status: "REVIEWED" })).success).toBe(true);
    // The reviewer (1) and the preparer (4) have each signed; neither may decline now.
    expect((await declineGrantAction({ id: 3, reason: "Second thoughts" })).resultCode).toBe(403);
    expect(
      (await patch(3, { status: "DECLINED", status_description: "Second thoughts" })).resultCode
    ).toBe(403);
    expect(application(3).status).toBe("REVIEWED");
  });

  it("stops counting a declined application as awaiting sign-off", async () => {
    const before = await api().countAwaitingSignoff();
    await declineGrantAction({ id: inChain().id, reason: "Outside programme scope" });
    expect(await api().countAwaitingSignoff()).toBe(before - 1);
  });
});

describe("sign-off history", () => {
  const api = () =>
    createGrantsApi(createApiClient(new MockApiTransport(handleMockRequest)), state.token);

  it("lists who decided each step and when, oldest first", async () => {
    const before = await api().get(3);
    expect(before!.history.map((entry) => entry.event)).toEqual(["SUBMITTED", "PREPARED"]);
    expect(before!.history[0]).toMatchObject({ byName: null, at: before!.createdAt });
    const preparer = getMockStore().user.find((user) => user.id === 4)!;
    expect(before!.history[1].byName).toBe(`${preparer.first_name} ${preparer.last_name}`);

    await advanceGrantAction({ id: 3, status: "REVIEWED" });
    const after = await api().get(3);
    expect(after!.history.map((entry) => entry.event)).toEqual([
      "SUBMITTED",
      "PREPARED",
      "REVIEWED",
    ]);
    expect(after!.history[2].byName).toBe("Judy Mwangi");
    expect(Date.parse(after!.history[2].at)).not.toBeNaN();
  });

  it("records a decline as the last entry", async () => {
    await declineGrantAction({ id: 3, reason: "Plan not viable" });
    const detail = await api().get(3);
    expect(detail!.history.at(-1)).toMatchObject({ event: "DECLINED", byName: "Judy Mwangi" });
  });
});

describe("filing an application from the queue", () => {
  const api = () =>
    createGrantsApi(createApiClient(new MockApiTransport(handleMockRequest)), state.token);
  /** A participant enrolled in the pillar of programme 1, and one who is not. */
  function applicants() {
    const store = getMockStore();
    const pillarId = store.project.find((row) => row.id === 1)!.pillar_id;
    const enrolled = new Set(
      store.enrollment
        .filter((row) => row.pillar_id === pillarId && !row.is_deleted && row.participant_id)
        .map((row) => row.participant_id)
    );
    return {
      inPillar: store.participant.find((row) => enrolled.has(row.id))!.id,
      outside: store.participant.find((row) => !enrolled.has(row.id))!.id,
    };
  }
  const valid = () => ({
    projectId: 1,
    participantId: applicants().inPillar,
    requestedAmount: 75000,
    grantType: "one_off",
    notes: "Posho mill",
  });

  it("creates a prepared application signed by the officer who filed it", async () => {
    const count = getMockStore().grant_application.length;
    const result = await createGrantApplicationAction(valid());
    expect(result).toMatchObject({ success: true, data: { id: expect.any(Number) } });
    expect(getMockStore().grant_application).toHaveLength(count + 1);
    const detail = await api().get(result.data!.id);
    expect(detail).toMatchObject({
      status: "PREPARED",
      nextStatus: "REVIEWED",
      requestedAmount: "KES 75,000",
      grantType: "one_off",
      notes: "Posho mill",
      signoffs: { preparedBy: 1 },
    });
    // Maker-checker: the officer who filed it cannot also review it.
    expect((await advanceGrantAction({ id: detail!.id, status: "REVIEWED" })).resultCode).toBe(403);
  });

  it("refuses an applicant outside the programme's pillar and invalid details", async () => {
    const count = getMockStore().grant_application.length;
    expect(
      (await createGrantApplicationAction({ ...valid(), participantId: applicants().outside }))
        .resultCode
    ).toBe(422);
    for (const bad of [
      { requestedAmount: 0 },
      { requestedAmount: -5 },
      { grantType: "loan" },
      { projectId: 9999 },
      { notes: "x".repeat(501) },
    ])
      expect((await createGrantApplicationAction({ ...valid(), ...bad })).success).toBe(false);
    expect(getMockStore().grant_application).toHaveLength(count);
  });

  it("needs the prepare permission in the programme's pillar", async () => {
    const store = getMockStore();
    const { getEffectiveGrants } = await import("@/lib/auth/permissions");
    const outsider = store.user.find(
      (user) =>
        user.status === "ACTIVE" &&
        !getEffectiveGrants(user.id).some(
          (grant) => grant.permissionCode === "GRANT_APPLICATION_PREPARE"
        )
    )!;
    const count = store.grant_application.length;
    asUser(outsider.id);
    expect((await createGrantApplicationAction(valid())).success).toBe(false);
    expect(store.grant_application).toHaveLength(count);
  });
});
