import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import { addAttendeeAction, logSessionAction, removeAttendeeAction, updateSessionAction } from "./actions";

// Samuel Ndegwa (user 3): Pillar Lead in pillar 2 (WEE) only, so he holds ACTIVITY_SESSION_LOG there but not in SRHR (pillar 3).
const NO_SESSION_LOG_USER = 3;

const typeId = (name: string) => getMockStore().activity_type_definition.find((row) => row.name === name)!.id;
const topicId = (name: string) => getMockStore().activity_topic.find((row) => row.name === name)!.id;
const base = () => ({
  pillar: "srhr" as const,
  activityTypeId: typeId("Health Talk"),
  topicId: topicId("Contraception"),
  topic: "",
  sessionDate: "2026-09-29",
  venue: "Kibera Ward Office",
  notes: "",
});
beforeEach(() => {
  resetMockStore();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});

describe("session actions", () => {
  it("logs a session on a planned topic with the signed-in facilitator", async () => {
    const result = await logSessionAction(base());
    expect(result.success).toBe(true);
    expect(getMockStore().activity_session.at(-1)).toMatchObject({
      pillar_id: 3,
      activity_topic_id: topicId("Contraception"),
      topic: null,
      facilitator_user_id: 1,
      notes: null,
    });
  });

  it("requires a free-text topic when no planned topic is chosen", async () => {
    const result = await logSessionAction({ ...base(), topicId: null, topic: "  " });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Choose a planned topic or describe the topic");
  });

  it("rejects a topic from another activity type", async () => {
    const before = getMockStore().activity_session.length;
    const result = await logSessionAction({ ...base(), topicId: topicId("Savings cycle") });
    expect(result).toMatchObject({ success: false, message: "That topic does not belong to this activity type" });
    expect(getMockStore().activity_session).toHaveLength(before);
  });

  it("rejects an activity type from the other pillar", async () => {
    const result = await logSessionAction({ ...base(), activityTypeId: typeId("Life Skills Session"), topicId: null, topic: "x" });
    expect(result).toMatchObject({ success: false, message: "That activity type is not part of this pillar" });
  });

  it("refuses users without session logging in the pillar", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(NO_SESSION_LOG_USER) });
    const before = getMockStore().activity_session.length;
    const result = await logSessionAction(base());
    expect(result.success).toBe(false);
    expect(getMockStore().activity_session).toHaveLength(before);
  });

  it("edits a session without changing its facilitator", async () => {
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3)!;
    const result = await updateSessionAction({ ...base(), sessionId: session.id, venue: "New venue" });
    expect(result.success).toBe(true);
    expect(session).toMatchObject({ venue: "New venue", facilitator_user_id: 9 });
  });

  it("adds, removes and restores an attendee without duplicates", async () => {
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3)!;
    const participantId = getMockStore().participant.find(
      (person) => !getMockStore().activity_attendance.some((row) => row.session_id === session.id && row.participant_id === person.id)
    )!.id;
    expect((await addAttendeeAction({ pillar: "srhr", sessionId: session.id, participantId })).success).toBe(true);
    const duplicate = await addAttendeeAction({ pillar: "srhr", sessionId: session.id, participantId });
    expect(duplicate).toMatchObject({ success: false, message: "Already on the attendance list" });
    const row = getMockStore().activity_attendance.find((item) => item.session_id === session.id && item.participant_id === participantId)!;
    expect((await removeAttendeeAction({ pillar: "srhr", sessionId: session.id, attendanceId: row.id })).success).toBe(true);
    expect(row).toMatchObject({ is_deleted: true, status: "INACTIVE" });
    expect((await addAttendeeAction({ pillar: "srhr", sessionId: session.id, participantId })).success).toBe(true);
    expect(row).toMatchObject({ is_deleted: false, status: "ACTIVE" });
    expect(getMockStore().activity_attendance.filter((item) => item.session_id === session.id && item.participant_id === participantId)).toHaveLength(1);
  });

  it("refuses to remove attendance that belongs to another session", async () => {
    const other = getMockStore().activity_attendance[0];
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3 && row.id !== other.session_id)!;
    const result = await removeAttendeeAction({ pillar: "srhr", sessionId: session.id, attendanceId: other.id });
    expect(result.success).toBe(false);
  });
});
