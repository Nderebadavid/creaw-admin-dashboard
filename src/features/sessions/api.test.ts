import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createParticipantsApi } from "@/features/participants/api";
import { createPillarsApi } from "@/features/pillars/api";
import { createSessionsApi } from "./api";

beforeEach(() => resetMockStore());
const clientFor = () => createApiClient(new MockApiTransport(handleMockRequest));
const apiFor = (userId: number, client = clientFor()) =>
  createSessionsApi(client, issueMockToken(userId));
/** The pillar's session cards, read from the pillar summary as the page does. */
const cardsFor = async (userId: number, pillar: "srhr" | "skilling", period = "all") => {
  const view = await createPillarsApi(clientFor(), issueMockToken(userId)).get(pillar, { period });
  return view.cards.sessions!;
};

describe("session registers", () => {
  it("maps SRHR sessions with type, planned or free topic and facilitator label", async () => {
    const page = await apiFor(1).listSessions("srhr");
    expect(page.items.length).toBeGreaterThanOrEqual(3);
    expect(
      page.items.every((row) =>
        ["Health Talk", "YSLA", "Mentorship", "Male Engagement"].includes(row.activityType)
      )
    ).toBe(true);
    const free = page.items.find((row) => row.topic === "Facility referral day")!;
    expect(free).toMatchObject({
      topicId: null,
      freeTopic: "Facility referral day",
      facilitator: { name: "Faith Kimani", kind: "provider" },
      facilitatorRef: { kind: "provider", id: 1 },
    });
    const planned = page.items.find((row) => row.topic === "Menstrual health")!;
    expect(planned.date).toBe("2026-07-01");
    // Newest first by default.
    expect(page.items.map((row) => row.date)).toEqual(
      [...page.items.map((row) => row.date)].sort().reverse()
    );
    expect(page.items.some((row) => row.attendeeCount > 0)).toBe(true);
  });

  it("keeps Skilling sessions on the Skilling page only", async () => {
    const skilling = await apiFor(1).listSessions("skilling");
    expect(skilling.items.map((row) => row.topic)).toEqual(["Workplace conduct"]);
    const srhr = await apiFor(1).listSessions("srhr");
    expect(srhr.items.some((row) => row.topic === "Workplace conduct")).toBe(false);
  });

  it("pages, filters, searches and sorts on the server", async () => {
    const api = apiFor(1);
    const all = await api.listSessions("srhr", { pageSize: 100 });
    const typeId = all.items[0].activityTypeId;
    const byType = await api.listSessions("srhr", { filters: { activity_type_id: typeId } });
    expect(byType.items.length).toBeGreaterThan(0);
    expect(byType.items.every((row) => row.activityTypeId === typeId)).toBe(true);

    expect(
      (await api.listSessions("srhr", { search: "kimani" })).items.map((row) => row.topic)
    ).toEqual(["Facility referral day"]);
    const first = await api.listSessions("srhr", { page: 1, pageSize: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.totalItems).toBe(all.totalItems);

    const byFacilitator = await api.listSessions("srhr", {
      pageSize: 100,
      sort: { by: "facilitator", order: "asc" },
    });
    const names = byFacilitator.items.map((row) => row.facilitator.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("falls back to a generic label, never an id, when the API sends no facilitator name", async () => {
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
    const page = await apiFor(9, client).listSessions("srhr");
    const provider = page.items.find((row) => row.topic === "Facility referral day")!;
    expect(provider.facilitator).toEqual({ name: "External provider", kind: "provider" });
    const staff = page.items.find((row) => row.facilitatorRef?.kind === "staff")!;
    expect(staff.facilitator).toEqual({ name: "CREAW staff", kind: "staff" });
    expect(JSON.stringify(page.items.map((row) => row.facilitator))).not.toMatch(/#\d/);
  });

  it("keeps the name of a retired activity type on its sessions", async () => {
    const store = getMockStore();
    const session = store.activity_session.find((row) => row.pillar_id === 3)!;
    const type = store.activity_type_definition.find((row) => row.id === session.activity_type_id)!;
    Object.assign(type, { is_deleted: true, status: "INACTIVE" });
    const view = (await apiFor(1).listSessions("srhr", { pageSize: 100 })).items.find(
      (row) => row.id === session.id
    )!;
    // History stays readable: the retired type keeps its name.
    expect(view.activityType).toBe(type.name);
  });
});

describe("sessions workspace", () => {
  it("returns page 1 with the pillar's coverage and summary from the cards", async () => {
    const cards = await cardsFor(1, "srhr", "quarter");
    const workspace = await apiFor(1).workspace("srhr", "quarter", cards, {
      id: 1,
      name: "Judy Mwangi",
    });
    expect(workspace.sessions.items.length).toBeGreaterThan(0);
    expect(workspace.currentUser).toEqual({ id: 1, name: "Judy Mwangi" });
    const health = workspace.coverage.find((row) => row.name === "Health Talk")!;
    expect(health.topics.find((row) => row.name === "Menstrual health")).toBeDefined();
    expect(workspace.summary.topicsPlanned).toBe(14);
  });

  it("counts coverage for the period", async () => {
    const all = await cardsFor(1, "srhr", "all");
    const health = all.coverage.find((row) => row.name === "Health Talk")!;
    expect(health.topics.find((row) => row.name === "Menstrual health")?.sessions).toBe(1);
    expect(all.summary.sessionsHeld).toBeGreaterThanOrEqual(3);
  });
});

describe("session detail and form options", () => {
  it("loads a session's attendees by full name and ward, and its files", async () => {
    const store = getMockStore();
    const session = store.activity_session.find(
      (row) =>
        row.pillar_id === 3 && store.activity_attendance.some((item) => item.session_id === row.id)
    )!;
    const detail = await apiFor(1).sessionDetail("srhr", session.id);
    expect(detail?.attendees[0].name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(detail?.attendees[0].ward).toEqual(expect.any(String));
    expect(await apiFor(1).sessionDetail("srhr", 9999)).toBeNull();
  });

  it("offers types, topics and people in one call, retired topics included", async () => {
    const store = getMockStore();
    const topic = store.activity_topic.find((row) => row.name === "Menstrual health")!;
    Object.assign(topic, { is_deleted: true, status: "INACTIVE" });
    const options = await apiFor(9).formOptions("srhr");
    expect(options.facilitators.find((row) => row.name === "Faith Kimani")).toMatchObject({
      kind: "provider",
      id: 1,
    });
    expect(options.topics.find((row) => row.id === topic.id)?.active).toBe(false);
    expect(options.activityTypes.map((row) => row.name)).toContain("Health Talk");
  });

  it("refuses the options to users who cannot log sessions", async () => {
    // Samuel Ndegwa (user 3) holds no session logging in SRHR.
    await expect(apiFor(3).formOptions("srhr")).rejects.toThrow();
  });
});

describe("attendee picker labels", () => {
  it("uses the ward and adds the id only to identical labels", async () => {
    const store = getMockStore();
    const [a, b, c] = store.participant;
    Object.assign(a, { first_name: "Same", last_name: "Name", ward_id: store.ward[0].id });
    Object.assign(b, { first_name: "Same", last_name: "Name", ward_id: store.ward[0].id });
    Object.assign(c, { first_name: "Same", last_name: "Name", ward_id: null });
    const people = await createParticipantsApi(clientFor(), issueMockToken(1)).search("Same Name");
    const ward = store.ward[0].name;
    const label = (id: number) => people.find((row) => row.id === id)?.label;
    expect(label(a.id)).toBe(`Same Name · ${ward} · #${a.id}`);
    expect(label(b.id)).toBe(`Same Name · ${ward} · #${b.id}`);
    expect(label(c.id)).toBe("Same Name · Ward not recorded");
    expect(people.filter((row) => row.label.includes("#"))).toHaveLength(2);
  });

  it("returns one small page, not the whole register", async () => {
    const people = await createParticipantsApi(clientFor(), issueMockToken(1)).search("", 5);
    expect(people).toHaveLength(5);
  });
});
