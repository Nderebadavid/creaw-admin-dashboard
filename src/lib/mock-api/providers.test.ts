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

// User 9 (Pillar Lead for SRHR, role 3) holds SENSITIVE_REVEAL scoped to pillar 3
// and neither PROVIDER_MANAGE nor any ADMIN permission.
const SENSITIVE_REVEAL_ONLY_USER = 9;

describe("provider directory", () => {
  const list = (userId: number, query: Record<string, unknown> = {}) =>
    raw(userId, {
      method: "GET",
      path: "/admin/providers",
      routeTemplate: "/admin/providers",
      query: { page: 1, pageSize: 50, ...query },
    });
  const one = (userId: number, id: number, query: Record<string, unknown> = {}) =>
    raw(userId, {
      method: "GET",
      path: `/admin/providers/${id}`,
      routeTemplate: "/admin/providers/:id",
      query,
    });

  it("lists providers to PROVIDER_MANAGE holders with contacts masked", async () => {
    const result = await list(1);
    expect(result.success).toBe(true);
    const faith = result.data.items.find((row: any) => row.first_name === "Faith");
    expect(faith).toMatchObject({ last_name: "Kimani", provider_type: "counsellor" });
    expect(faith.phone_number).toMatch(/•/);
    expect(faith.email).toMatch(/•/);
  });

  it("refuses the directory to users without PROVIDER_MANAGE", async () => {
    expect((await list(9)).resultCode).toBe(403);
    expect((await one(9, 1)).resultCode).toBe(403);
  });

  it("reveals a contact for PROVIDER_MANAGE holders and audits it", async () => {
    const before = getMockStore().audit_logs.length;
    const result = await one(1, 1, { reveal: "phone_number" });
    expect(result.data.phone_number).toBe("0711 900 221");
    expect(getMockStore().audit_logs.length).toBe(before + 1);
  });

  it("lets a pillar-scoped SENSITIVE_REVEAL holder reveal a contact but not browse", async () => {
    const userId = SENSITIVE_REVEAL_ONLY_USER;
    expect((await one(userId, 1, { reveal: "email" })).data.email).toBe("faith.kimani@nwh.example");
    expect((await one(userId, 1)).resultCode).toBe(403);
    expect((await list(userId)).resultCode).toBe(403);
  });

  it("creates, edits and deactivates a provider, keeping contacts masked in responses", async () => {
    const created = await raw(1, {
      method: "POST",
      path: "/admin/providers",
      routeTemplate: "/admin/providers",
      body: {
        first_name: "Grace",
        middle_name: null,
        last_name: "Wanjiru",
        provider_type: "nurse",
        service_description: "Clinical outreach",
        affiliated_institution_id: null,
        phone_number: "0700 111 222",
        email: null,
        notes: null,
      },
    });
    expect(created.resultCode).toBe(201);
    expect(created.data.phone_number).toMatch(/•/);
    const id = created.data.id;
    const deactivated = await raw(1, {
      method: "PATCH",
      path: `/admin/providers/${id}`,
      routeTemplate: "/admin/providers/:id",
      body: { status: "INACTIVE" },
    });
    expect(deactivated.data.status).toBe("INACTIVE");
    expect((await one(1, id)).success).toBe(true);
  });

  it("keeps contacts masked in CSV exports and audit snapshots", async () => {
    const csv = await list(1, { format: "csv" });
    expect(csv.success).toBe(true);
    expect(JSON.stringify(csv.data)).not.toContain("0711 900 221");
    await raw(1, {
      method: "PATCH",
      path: "/admin/providers/1",
      routeTemplate: "/admin/providers/:id",
      body: { notes: "Updated" },
    });
    const entry = getMockStore().audit_logs.at(-1)!;
    expect(JSON.stringify(entry)).not.toContain("0711 900 221");
    expect(JSON.stringify(entry)).not.toContain("faith.kimani@nwh.example");
  });

  it("rejects an unknown provider type and a masked contact value", async () => {
    const post = (body: Record<string, unknown>) =>
      raw(1, {
        method: "POST",
        path: "/admin/providers",
        routeTemplate: "/admin/providers",
        body: {
          first_name: "A",
          middle_name: null,
          last_name: "B",
          provider_type: "counsellor",
          service_description: null,
          affiliated_institution_id: null,
          phone_number: null,
          email: null,
          notes: null,
          ...body,
        },
      });
    expect((await post({ provider_type: "wizard" })).resultCode).toBe(422);
    expect((await post({ phone_number: "••••0221" })).resultCode).toBe(422);
  });

  it("refuses the workload view to a reveal-only holder, alone or combined with a reveal", async () => {
    const userId = SENSITIVE_REVEAL_ONLY_USER;
    expect((await one(userId, 1, { reveal: "email", include: "workload" })).resultCode).toBe(403);
    expect((await one(userId, 1, { include: "workload" })).resultCode).toBe(403);
  });

  it("caps the workload at five items, newest first", async () => {
    const store = getMockStore();
    const template = store.activity_session.find((row) => row.facilitator_provider_id === 1)!;
    for (let day = 1; day <= 6; day++)
      store.activity_session.push({
        ...template,
        id: 100 + day,
        session_date: `2026-01-0${day}`,
        topic: `Extra ${day}`,
        activity_topic_id: null,
      });
    const { sessions } = (await one(1, 1, { include: "workload" })).data.workload;
    expect(sessions.count).toBeGreaterThanOrEqual(6);
    expect(sessions.recent).toHaveLength(5);
    const dates = sessions.recent.map((item: any) => item.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("summarises a provider's linked work without participant names", async () => {
    const result = await one(1, 1, { include: "workload" });
    expect(result.data.workload.counselling.count).toBeGreaterThanOrEqual(1);
    expect(result.data.workload.sessions.recent[0]).toMatchObject({
      label: "Facility referral day",
      pillar: "SRHR",
    });
    const text = JSON.stringify(result.data.workload);
    for (const person of getMockStore().participant) expect(text).not.toContain(person.first_name);
  });
});
