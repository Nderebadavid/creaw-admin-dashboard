import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createApiClient } from "@/lib/api/client";
import { MockApiTransport } from "@/lib/api/mock-transport";
import { handleMockRequest } from "./handlers";
import { getMockStore, issueMockToken, resetMockStore } from "./store";
import { curriculumProgress, isBehind } from "./curriculum";

beforeEach(() => resetMockStore());
const today = () => new Date().toISOString().slice(0, 10);

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
/** GET through the mock transport; `path` may carry a query string. */
async function get(userId: number, target: string): Promise<Json> {
  const [path, search] = target.split("?");
  const routeTemplate = path
    .replace(/^\/participants\/\d+$/, "/participants/:id")
    .replace(/^\/pillars\/\w+\/summary$/, "/pillars/:pillar/summary");
  const query = Object.fromEntries(
    [...new URLSearchParams(search ?? "")].map(([key, value]) => [
      key,
      /^\d+$/.test(value) ? Number(value) : value,
    ])
  );
  const result = (await createApiClient(new MockApiTransport(handleMockRequest)).request(
    { token: issueMockToken(userId), method: "GET", path, routeTemplate, query } as never,
    { parse: (value: unknown) => value } as never
  )) as { data: Json };
  return result.data;
}

/** Adds a live SRHR session on a topic and an attendance row for the participant. */
function attend(participantId: number, topicName: string, date: string) {
  const store = getMockStore();
  const topic = store.activity_topic.find((row) => row.name === topicName)!;
  const base = store.activity_session.find((row) => row.pillar_id === 3)!;
  const session = {
    ...base,
    id: Math.max(...store.activity_session.map((row) => row.id)) + 1,
    activity_type_id: topic.activity_type_id,
    activity_topic_id: topic.id,
    session_date: date,
  };
  store.activity_session.push(session);
  const attendance = {
    ...store.activity_attendance[0],
    id: Math.max(...store.activity_attendance.map((row) => row.id)) + 1,
    session_id: session.id,
    participant_id: participantId,
    is_deleted: false,
  };
  store.activity_attendance.push(attendance);
  return { session, attendance };
}

describe("curriculum progress", () => {
  it("counts each attended topic once, however many sessions covered it", () => {
    const store = getMockStore();
    const before = curriculumProgress(store, 8);
    attend(8, "Savings cycle", "2026-06-01");
    attend(8, "Savings cycle", "2026-06-15");
    const after = curriculumProgress(store, 8);
    expect(after.total).toBe(14);
    expect(after.done).toBe(before.done + 1);
    expect(after.topics.find((row) => row.name === "Savings cycle")?.attended_date).toBe(
      "2026-06-15"
    );
  });

  it("ignores deleted attendance and retired topics", () => {
    const store = getMockStore();
    const { attendance } = attend(8, "Consent", "2026-06-01");
    attendance.is_deleted = true;
    expect(
      curriculumProgress(store, 8).topics.find((row) => row.name === "Consent")?.attended_date
    ).toBeNull();
    attend(8, "Goal setting", "2026-06-02");
    Object.assign(
      store.activity_topic.find((row) => row.name === "Goal setting")!,
      { status: "INACTIVE" }
    );
    const retired = curriculumProgress(store, 8);
    expect(retired.total).toBe(13);
    expect(retired.topics.some((row) => row.name === "Goal setting")).toBe(false);
  });

  it("is behind after the cut-off or with no attendance, never within it", () => {
    const now = new Date("2026-10-01T00:00:00");
    expect(isBehind(null, now)).toBe(true);
    expect(isBehind("2026-07-01", now)).toBe(true);
    expect(isBehind("2026-09-15", now)).toBe(false);
  });
});

describe("curriculum over the API", () => {
  it("gives the SRHR lead derived progress on the register and the ordered topics on detail", async () => {
    attend(8, "Savings cycle", today());
    const list = await get(9, "/participants?pageSize=100");
    const row = list.items.find((item: Json) => item.id === 8);
    expect(row).toMatchObject({ curriculum_total: 14, curriculum_behind: false });
    expect(row.curriculum_done).toBeGreaterThan(0);

    const detail = await get(9, "/participants/8?include=curriculum,curriculum_milestones");
    expect(detail.curriculum).toHaveLength(14);
    expect(detail.curriculum_milestones.map((item: Json) => item.name)).toEqual([
      "Baseline survey",
      "Endline survey",
      "Graduation",
    ]);
  });

  it("sorts and filters by progress and the behind flag", async () => {
    attend(8, "Savings cycle", today());
    const sorted = await get(9, "/participants?pageSize=100&sort=curriculum_done:desc");
    const done = sorted.items.map((item: Json) => item.curriculum_done);
    expect(done[0]).toBe(Math.max(...done.filter((value: number | null) => value !== null)));
    const behind = await get(9, "/participants?pageSize=100&curriculum_behind=true");
    expect(behind.items.every((item: Json) => item.curriculum_behind === true)).toBe(true);
    expect(behind.items.some((item: Json) => item.id === 8)).toBe(false);
  });

  it("hides curriculum from callers who cannot view SRHR participants", async () => {
    // Lilian (5) leads VAWG; participant 8 is also enrolled in SRHR.
    const list = await get(5, "/participants?pageSize=100");
    const row = list.items.find((item: Json) => item.id === 8);
    expect(row).toMatchObject({ curriculum_done: null, curriculum_behind: null });
    const detail = await get(5, "/participants/8?include=curriculum");
    expect(detail.curriculum).toEqual([]);
  });

  it("adds the distribution to the SRHR summary only", async () => {
    const card = (await get(9, "/pillars/srhr/summary")).cards.curriculum;
    expect(card.buckets.map((b: Json) => b.label)).toEqual([
      "Not started",
      "1–49%",
      "50–99%",
      "Completed",
    ]);
    expect(card.buckets.reduce((sum: number, b: Json) => sum + b.count, 0)).toBe(card.participants);
    expect((await get(3, "/pillars/wee/summary")).cards.curriculum).toBeNull();
  });
});
