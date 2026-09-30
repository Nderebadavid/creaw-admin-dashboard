import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "@/lib/mock-api/handlers";
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { createSessionsApi } from "./api";

beforeEach(() => resetMockStore());
const apiFor = (userId: number) =>
  createSessionsApi(createApiClient(new MockApiTransport(handleMockRequest)), issueMockToken(userId));
const today = new Date(2026, 8, 30);

describe("sessions workspace", () => {
  it("maps SRHR sessions with type, planned or free topic and facilitator label", async () => {
    const workspace = await apiFor(1).workspace("srhr", "quarter", today);
    expect(workspace.sessions.length).toBeGreaterThanOrEqual(3);
    expect(workspace.sessions.every((row) => ["Health Talk", "YSLA", "Mentorship", "Male Engagement"].includes(row.activityType))).toBe(true);
    const free = workspace.sessions.find((row) => row.topic === "Facility referral day")!;
    expect(free).toMatchObject({ topicId: null, freeTopic: "Facility referral day", facilitator: "CREAW staff" });
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

  it("counts coverage for the period and lists attendees with masked names", async () => {
    const workspace = await apiFor(1).workspace("srhr", "quarter", today);
    const health = workspace.coverage.find((row) => row.name === "Health Talk")!;
    expect(health.topics.find((row) => row.name === "Menstrual health")?.sessions).toBe(1);
    expect(workspace.summary.topicsPlanned).toBe(14);
    const withPeople = workspace.sessions.find((row) => row.attendees.length > 0)!;
    expect(withPeople.attendees[0].name).toMatch(/•/);
  });

  it("still shows a session's retired topic and type names", async () => {
    const store = getMockStore();
    const topic = store.activity_topic.find((row) => row.name === "Menstrual health")!;
    Object.assign(topic, { is_deleted: true, status: "INACTIVE" });
    const workspace = await apiFor(1).workspace("srhr", "all", today);
    expect(workspace.sessions.some((row) => row.topic === "Menstrual health")).toBe(true);
    expect(workspace.topics.find((row) => row.id === topic.id)?.active ?? false).toBe(false);
  });

  it("loads with no planned topics when the topic lookup fails", async () => {
    const api = apiFor(1);
    const store = getMockStore();
    store.activity_topic.splice(0);
    const workspace = await api.workspace("srhr", "quarter", today);
    expect(workspace.summary.topicsPlanned).toBe(0);
    expect(workspace.sessions.length).toBeGreaterThanOrEqual(3);
  });
});
