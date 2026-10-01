import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createSessionsApi } from "./api";

beforeEach(() => resetMockStore());
const clientFor = () => createApiClient(new MockApiTransport(handleMockRequest));
const apiFor = (userId: number, client = clientFor()) =>
  createSessionsApi(client, issueMockToken(userId));
const today = new Date(2026, 8, 30);

describe("session facilitators", () => {
  it("lists facilitator options only for users who can log sessions", async () => {
    const withLog = await apiFor(9).workspace("srhr", "all", today, { canLog: true });
    expect(withLog.facilitators.map((row) => row.name)).toContain("Faith Kimani");
    expect(withLog.facilitators.find((row) => row.name === "Faith Kimani")).toMatchObject({
      kind: "provider",
      id: 1,
    });
    const without = await apiFor(9).workspace("srhr", "all", today, { canLog: false });
    expect(without.facilitators).toEqual([]);
    expect((await apiFor(9).workspace("srhr", "all", today)).facilitators).toEqual([]);
  });

  it("passes the current user through and survives a failed options read", async () => {
    const client = clientFor();
    const real = client.request.bind(client);
    vi.spyOn(client, "request").mockImplementation(((
      req: { query?: { table?: string } },
      schema: never
    ) =>
      req.query?.table === "facilitator_option"
        ? Promise.reject(new Error("down"))
        : real(req as never, schema)) as never);
    const workspace = await apiFor(9, client).workspace("srhr", "all", today, {
      canLog: true,
      currentUser: { id: 9, name: "Pat Lee" },
    });
    expect(workspace.facilitators).toEqual([]);
    expect(workspace.currentUser).toEqual({ id: 9, name: "Pat Lee" });
    expect(workspace.sessions.length).toBeGreaterThan(0);
  });

  it("falls back to a generic label, never an id, when the name is missing", async () => {
    const client = clientFor();
    const real = client.request.bind(client);
    vi.spyOn(client, "request").mockImplementation((async (req: never, schema: never) => {
      const result = (await real(req, schema)) as {
        data?: { items?: Record<string, unknown>[] } | null;
      };
      for (const item of result.data?.items ?? []) {
        if ("facilitator_user_id" in item) {
          delete item.facilitator_name;
          delete item.facilitator_kind;
        }
      }
      return result;
    }) as never);
    const workspace = await apiFor(9, client).workspace("srhr", "all", today);
    const provider = workspace.sessions.find((row) => row.topic === "Facility referral day")!;
    expect(provider.facilitator).toEqual({ name: "External provider", kind: "provider" });
    const staff = workspace.sessions.find((row) => row.facilitatorRef?.kind === "staff")!;
    expect(staff.facilitator).toEqual({ name: "CREAW staff", kind: "staff" });
    expect(JSON.stringify(workspace.sessions.map((row) => row.facilitator))).not.toMatch(/#\d/);
  });
});

describe("sessions workspace", () => {
  it("maps SRHR sessions with type, planned or free topic and facilitator label", async () => {
    const workspace = await apiFor(1).workspace("srhr", "quarter", today);
    expect(workspace.sessions.length).toBeGreaterThanOrEqual(3);
    expect(
      workspace.sessions.every((row) =>
        ["Health Talk", "YSLA", "Mentorship", "Male Engagement"].includes(row.activityType)
      )
    ).toBe(true);
    const free = workspace.sessions.find((row) => row.topic === "Facility referral day")!;
    expect(free).toMatchObject({
      topicId: null,
      freeTopic: "Facility referral day",
      facilitator: { name: "Faith Kimani", kind: "provider" },
      facilitatorRef: { kind: "provider", id: 1 },
    });
    const planned = workspace.sessions.find((row) => row.topic === "Menstrual health")!;
    expect(planned.date).toBe("2026-07-01");
    expect(workspace.sessions.map((row) => row.date)).toEqual(
      [...workspace.sessions.map((row) => row.date)].sort().reverse()
    );
  });

  it("keeps Skilling sessions on the Skilling page only", async () => {
    const skilling = await apiFor(1).workspace("skilling", "all", today);
    expect(skilling.sessions.map((row) => row.topic)).toEqual(["Workplace conduct"]);
    expect(skilling.activityTypes.map((row) => row.name)).toEqual(["Life Skills Session"]);
  });

  it("counts coverage for the period and lists attendees by full name", async () => {
    const workspace = await apiFor(1).workspace("srhr", "quarter", today);
    const health = workspace.coverage.find((row) => row.name === "Health Talk")!;
    expect(health.topics.find((row) => row.name === "Menstrual health")?.sessions).toBe(1);
    expect(workspace.summary.topicsPlanned).toBe(14);
    const withPeople = workspace.sessions.find((row) => row.attendees.length > 0)!;
    expect(withPeople.attendees[0].name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("still shows a session's retired topic and type names", async () => {
    const store = getMockStore();
    const topic = store.activity_topic.find((row) => row.name === "Menstrual health")!;
    Object.assign(topic, { is_deleted: true, status: "INACTIVE" });
    const workspace = await apiFor(1).workspace("srhr", "all", today);
    expect(workspace.sessions.some((row) => row.topic === "Menstrual health")).toBe(true);
    const retired = workspace.topics.find((row) => row.id === topic.id);
    expect(retired).toBeDefined();
    expect(retired!.active).toBe(false);
  });

  it("shows retired names to pillar staff without lookup management", async () => {
    const store = getMockStore();
    const topic = store.activity_topic.find((row) => row.name === "Menstrual health")!;
    Object.assign(topic, { is_deleted: true, status: "INACTIVE" });
    const workspace = await apiFor(9).workspace("srhr", "all", today);
    expect(workspace.sessions.some((row) => row.topic === "Menstrual health")).toBe(true);
    expect(workspace.topics.find((row) => row.id === topic.id)?.active).toBe(false);
  });

  it("labels unreadable attendees and unresolved types without raw ids", async () => {
    const store = getMockStore();
    const session = store.activity_session.find((row) => row.pillar_id === 3)!;
    const attendee = store.activity_attendance.find((row) => row.session_id === session.id)!;
    store.participant.splice(
      store.participant.findIndex((row) => row.id === attendee.participant_id),
      1
    );
    const type = store.activity_type_definition.find((row) => row.id === session.activity_type_id)!;
    store.activity_type_definition.splice(store.activity_type_definition.indexOf(type), 1);
    const workspace = await apiFor(1).workspace("srhr", "all", today);
    const view = workspace.sessions.find((row) => row.id === session.id)!;
    expect(view.activityType).toBe("Unknown activity type");
    expect(view.attendees.map((row) => row.name)).toContain("Unknown participant");
  });

  it("loads with no planned topics when the topic lookup fails", async () => {
    const client = clientFor();
    const request = client.request.bind(client);
    const spy = vi
      .spyOn(client, "request")
      .mockImplementation(((req: { path: string }, schema: never) =>
        req.path === "/lookups/activity_topic"
          ? Promise.reject(new Error("topic lookup down"))
          : request(req as never, schema)) as typeof client.request);
    const workspace = await apiFor(1, client).workspace("srhr", "quarter", today);
    expect(spy.mock.calls.some(([req]) => req.path === "/lookups/activity_topic")).toBe(true);
    expect(workspace.summary.topicsPlanned).toBe(0);
    expect(workspace.sessions.length).toBeGreaterThanOrEqual(3);
  });

  it("excludes sessions of another pillar that the route returns", async () => {
    const client = clientFor();
    const request = client.request.bind(client);
    vi.spyOn(client, "request").mockImplementation((async (
      req: { query?: Record<string, unknown> },
      schema: never
    ) => {
      const result = (await request(req as never, schema)) as {
        data: { items: Record<string, unknown>[] } | null;
      };
      if (req.query?.table === "activity_session" && result.data)
        result.data.items.push({
          ...result.data.items[0],
          id: 9999,
          pillar_id: 6,
          topic: "Foreign",
        });
      return result;
    }) as typeof client.request);
    const workspace = await apiFor(1, client).workspace("srhr", "all", today);
    expect(workspace.sessions.some((row) => row.id === 9999 || row.topic === "Foreign")).toBe(
      false
    );
  });
});

describe("attendee picker labels", () => {
  it("uses the ward and adds the id only to identical labels", async () => {
    const store = getMockStore();
    const [a, b, c] = store.participant;
    Object.assign(a, { first_name: "Same", last_name: "Name", ward_id: store.ward[0].id });
    Object.assign(b, { first_name: "Same", last_name: "Name", ward_id: store.ward[0].id });
    Object.assign(c, { first_name: "Same", last_name: "Name", ward_id: null });
    const { participants } = await apiFor(1).workspace("srhr", "all", today);
    const ward = store.ward[0].name;
    const label = (id: number) => participants.find((row) => row.id === id)?.label;
    expect(label(a.id)).toBe(`Same Name · ${ward} · #${a.id}`);
    expect(label(b.id)).toBe(`Same Name · ${ward} · #${b.id}`);
    expect(label(c.id)).toBe("Same Name · Ward not recorded");
    expect(participants.filter((row) => row.label.includes("#"))).toHaveLength(2);
  });
});
