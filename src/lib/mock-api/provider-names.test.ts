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

// User 3 is the WEE-only pillar lead: no ACTIVITY_SESSION_LOG in SRHR.
const NO_SESSION_LOG_USER = 3;

describe("derived provider and staff names", () => {
  const pillarRead = (
    userId: number,
    pillar: string,
    table: string,
    query: Record<string, unknown> = {}
  ) =>
    raw(userId, {
      method: "GET",
      path: `/pillars/${pillar}`,
      routeTemplate: "/pillars/:pillar",
      query: { table, page: 1, pageSize: 100, ...query },
    });

  it("names staff and provider facilitators on sessions", async () => {
    const { data } = await pillarRead(1, "srhr", "activity_session");
    const provider = data.items.find((row: any) => row.topic === "Facility referral day");
    expect(provider).toMatchObject({
      facilitator_name: "Faith Kimani",
      facilitator_kind: "provider",
    });
    const staff = data.items.find((row: any) => row.facilitator_user_id === 9);
    const user9 = getMockStore().user.find((row) => row.id === 9)!;
    expect(staff).toMatchObject({
      facilitator_name: `${user9.first_name} ${user9.last_name}`,
      facilitator_kind: "staff",
    });
  });

  it("names counsellors, advocates and trainers", async () => {
    expect((await pillarRead(1, "vawg", "counselling_session")).data.items[0].counsellor_name).toBe(
      "Faith Kimani"
    );
    expect((await pillarRead(1, "vawg", "legal_case")).data.items[0].advocate_name).toBe(
      "Judy Muthoni"
    );
    expect(
      (await pillarRead(1, "skilling", "training_enrollment")).data.items[0].trainer_name
    ).toBe("James Otieno");
  });

  it("keeps a deactivated provider's name on past records", async () => {
    getMockStore().external_provider.find((row) => row.id === 1)!.status = "INACTIVE";
    const { data } = await pillarRead(1, "srhr", "activity_session");
    expect(
      data.items.find((row: any) => row.topic === "Facility referral day").facilitator_name
    ).toBe("Faith Kimani");
  });

  it("carries the names on single reads and CSV exports", async () => {
    const session = getMockStore().activity_session.find(
      (row) => row.topic === "Facility referral day"
    )!;
    const single = await raw(1, {
      method: "GET",
      path: "/pillars/srhr",
      routeTemplate: "/pillars/:pillar",
      query: { table: "activity_session", id: session.id },
    });
    expect(single.data).toMatchObject({
      facilitator_name: "Faith Kimani",
      facilitator_kind: "provider",
    });
    const csv = await pillarRead(1, "srhr", "activity_session", { format: "csv" });
    expect(csv.success).toBe(true);
    const [header] = csv.data.content.split("\r\n");
    expect(header).toContain("facilitator_name");
    expect(csv.data.content).toContain('"Faith Kimani"');
  });

  it("rejects a write that includes a derived name", async () => {
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3)!;
    const result = await raw(1, {
      method: "PATCH",
      path: "/pillars/srhr",
      routeTemplate: "/pillars/:pillar",
      query: { table: "activity_session", id: session.id },
      body: { facilitator_name: "Someone" },
    });
    expect(result.resultCode).toBe(422);
  });

  it("offers active staff and providers to session loggers only", async () => {
    getMockStore().external_provider.find((row) => row.id === 2)!.status = "INACTIVE";
    const result = await pillarRead(9, "srhr", "facilitator_option");
    expect(result.success).toBe(true);
    const items = result.data.items;
    expect(items).toContainEqual({
      kind: "provider",
      id: 1,
      name: "Faith Kimani",
      detail: expect.stringMatching(/^Counsellor/),
    });
    expect(items.some((item: any) => item.kind === "provider" && item.id === 2)).toBe(false);
    expect(
      items.some(
        (item: any) => item.kind === "staff" && item.id === 9 && item.detail === "CREAW staff"
      )
    ).toBe(true);
    expect(JSON.stringify(items)).not.toMatch(/@|07\d{2}/);
    expect((await pillarRead(NO_SESSION_LOG_USER, "srhr", "facilitator_option")).resultCode).toBe(
      403
    );
  });
});
