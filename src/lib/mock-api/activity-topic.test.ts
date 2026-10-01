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
const typeId = (name: string) =>
  getMockStore().activity_type_definition.find((row) => row.name === name)!.id;

describe("activity_topic lookup", () => {
  it("serves the seeded planned topics in sequence", async () => {
    const result = await raw(1, {
      method: "GET",
      path: "/lookups/activity_topic",
      routeTemplate: "/lookups/:table",
      query: { page: 1, pageSize: 100 },
    });
    const healthTalk = result.data.items
      .filter((row: any) => row.activity_type_id === typeId("Health Talk"))
      .sort((a: any, b: any) => a.sequence_no - b.sequence_no)
      .map((row: any) => row.name);
    expect(healthTalk).toEqual([
      "Menstrual health",
      "Contraception",
      "HIV & STIs",
      "Consent & GBV",
    ]);
  });

  it("rejects a duplicate topic name within one activity type", async () => {
    const result = await raw(1, {
      method: "POST",
      path: "/lookups/activity_topic",
      routeTemplate: "/lookups/:table",
      body: { activity_type_id: typeId("Health Talk"), name: "contraception", sequence_no: 9 },
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Lookup name already exists");
  });

  it("refuses to move a topic to another activity type", async () => {
    const topic = getMockStore().activity_topic[0];
    const result = await raw(1, {
      method: "PATCH",
      path: `/lookups/activity_topic/${topic.id}`,
      routeTemplate: "/lookups/:table/:id",
      body: {
        activity_type_id:
          typeId("YSLA") === topic.activity_type_id ? typeId("Mentorship") : typeId("YSLA"),
      },
    });
    expect(result.message).toBe("Parent cannot be changed");
  });
});

describe("activity_session topic rules", () => {
  const topicOf = (type: string) =>
    getMockStore().activity_topic.find((row) => row.activity_type_id === typeId(type))!.id;
  // A complete body, so a rejection can only come from the rule under test.
  const post = (overrides: Record<string, unknown>) =>
    raw(1, {
      method: "POST",
      path: "/pillars/srhr",
      routeTemplate: "/pillars/:pillar",
      query: { table: "activity_session" },
      body: {
        pillar_id: 3,
        enrollment_id: null,
        activity_type_id: typeId("Health Talk"),
        activity_topic_id: topicOf("Health Talk"),
        session_date: "2026-09-01",
        venue: null,
        topic: null,
        facilitator_user_id: 1,
        facilitator_provider_id: null,
        notes: null,
        ...overrides,
      },
    });

  it("accepts a session whose topic belongs to its activity type", async () => {
    const result = await post({});
    expect(result.resultCode).toBe(201);
  });

  it("rejects a session whose topic belongs to another activity type", async () => {
    const result = await post({ activity_type_id: typeId("YSLA") });
    expect(result.success).toBe(false);
    expect(result.resultCode).toBe(422);
  });

  it("rejects a session whose activity type belongs to another pillar", async () => {
    const result = await post({
      activity_type_id: typeId("Life Skills Session"),
      activity_topic_id: null,
    });
    expect(result.resultCode).toBe(422);
  });

  it("keeps Skilling sessions off the SRHR route", async () => {
    const result = await raw(1, {
      method: "GET",
      path: "/pillars/srhr",
      routeTemplate: "/pillars/:pillar",
      query: { table: "activity_session", page: 1, pageSize: 100 },
    });
    expect(result.data.items.length).toBeGreaterThanOrEqual(3);
    expect(result.data.items.every((row: any) => row.pillar_id === 3)).toBe(true);
  });

  it("lets a session logger read soft-deleted attendance to restore it", async () => {
    const row = getMockStore().activity_attendance[0];
    Object.assign(row, { is_deleted: true, status: "INACTIVE" });
    const result = await raw(1, {
      method: "GET",
      path: "/pillars/srhr",
      routeTemplate: "/pillars/:pillar",
      query: { table: "activity_attendance", includeDeleted: "true", page: 1, pageSize: 100 },
    });
    expect(result.success).toBe(true);
    expect(result.data.items.some((item: any) => item.id === row.id)).toBe(true);
  });

  it("shows retired curriculum lookups to session staff but no other retired lookups", async () => {
    const lookup = (table: string) =>
      raw(9, {
        method: "GET",
        path: `/lookups/${table}`,
        routeTemplate: "/lookups/:table",
        query: { includeDeleted: "true", page: 1, pageSize: 100 },
      });
    expect((await lookup("activity_topic")).success).toBe(true);
    expect((await lookup("activity_type_definition")).success).toBe(true);
    expect((await lookup("ward")).resultCode).toBe(422);
  });
});
