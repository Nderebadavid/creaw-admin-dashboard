import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getMockStore, issueMockToken, resetMockStore } from "@/lib/mock-api/store";
import {
  addAttendeeAction,
  attachSessionFileAction,
  logSessionAction,
  removeAttendeeAction,
  updateSessionAction,
  viewSessionFileAction,
} from "./actions";

// Samuel Ndegwa (user 3): Pillar Lead in pillar 2 (WEE) only, so he holds ACTIVITY_SESSION_LOG there but not in SRHR (pillar 3).
const NO_SESSION_LOG_USER = 3;

const typeId = (name: string) =>
  getMockStore().activity_type_definition.find((row) => row.name === name)!.id;
const topicId = (name: string) =>
  getMockStore().activity_topic.find((row) => row.name === name)!.id;
const base = () => ({
  pillar: "srhr" as const,
  activityTypeId: typeId("Health Talk"),
  topicId: topicId("Contraception"),
  topic: "",
  sessionDate: "2026-09-29",
  venue: "Kibera Ward Office",
  notes: "",
  facilitator: { kind: "staff" as const, id: 1 },
});
beforeEach(() => {
  resetMockStore();
  cookieStore.get.mockReturnValue({ value: issueMockToken(1) });
});

describe("session actions", () => {
  it("logs a session on a planned topic with the chosen staff facilitator", async () => {
    const result = await logSessionAction(base());
    expect(result.success).toBe(true);
    expect(getMockStore().activity_session.at(-1)).toMatchObject({
      pillar_id: 3,
      activity_topic_id: topicId("Contraception"),
      topic: null,
      facilitator_user_id: 1,
      facilitator_provider_id: null,
      notes: null,
    });
  });

  it("logs a session facilitated by a provider, clearing the staff id", async () => {
    const result = await logSessionAction({
      ...base(),
      facilitator: { kind: "provider", id: 1 },
    });
    expect(result.success).toBe(true);
    expect(getMockStore().activity_session.at(-1)).toMatchObject({
      facilitator_provider_id: 1,
      facilitator_user_id: null,
    });
  });

  it("refuses a facilitator outside the options, writing nothing", async () => {
    const before = getMockStore().activity_session.length;
    const forged = await logSessionAction({
      ...base(),
      facilitator: { kind: "provider", id: 999 },
    });
    expect(forged).toMatchObject({ success: false, message: "Choose a facilitator from the list" });
    getMockStore().external_provider.find((row) => row.id === 2)!.status = "INACTIVE";
    const inactive = await logSessionAction({
      ...base(),
      facilitator: { kind: "provider", id: 2 },
    });
    expect(inactive).toMatchObject({
      success: false,
      message: "Choose a facilitator from the list",
    });
    expect(getMockStore().activity_session).toHaveLength(before);
  });

  it("refuses to move a session to an outside facilitator on edit", async () => {
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3)!;
    const result = await updateSessionAction({
      ...base(),
      sessionId: session.id,
      facilitator: { kind: "provider", id: 999 },
    });
    expect(result).toMatchObject({ success: false, message: "Choose a facilitator from the list" });
  });

  it("keeps a session's facilitator on edit after that person was deactivated", async () => {
    const session = getMockStore().activity_session.find(
      (row) => row.pillar_id === 3 && row.facilitator_provider_id === 1
    )!;
    getMockStore().external_provider.find((row) => row.id === 1)!.status = "INACTIVE";
    const result = await updateSessionAction({
      ...base(),
      sessionId: session.id,
      facilitator: { kind: "provider", id: 1 },
      venue: "Moved",
    });
    expect(result.success).toBe(true);
    expect(session).toMatchObject({ venue: "Moved", facilitator_provider_id: 1 });
  });

  it("requires a facilitator", async () => {
    const { facilitator: _omit, ...rest } = base();
    void _omit;
    expect((await logSessionAction(rest)).success).toBe(false);
  });

  it("requires a free-text topic when no planned topic is chosen", async () => {
    const result = await logSessionAction({ ...base(), topicId: null, topic: "  " });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Choose a planned topic or describe the topic");
  });

  it("rejects a topic from another activity type", async () => {
    const before = getMockStore().activity_session.length;
    const result = await logSessionAction({ ...base(), topicId: topicId("Savings cycle") });
    expect(result).toMatchObject({
      success: false,
      message: "That topic does not belong to this activity type",
    });
    expect(getMockStore().activity_session).toHaveLength(before);
  });

  it("rejects an activity type from the other pillar", async () => {
    const result = await logSessionAction({
      ...base(),
      activityTypeId: typeId("Life Skills Session"),
      topicId: null,
      topic: "x",
    });
    expect(result).toMatchObject({
      success: false,
      message: "That activity type is not part of this pillar",
    });
  });

  it("refuses users without session logging in the pillar", async () => {
    cookieStore.get.mockReturnValue({ value: issueMockToken(NO_SESSION_LOG_USER) });
    const before = getMockStore().activity_session.length;
    const result = await logSessionAction(base());
    expect(result.success).toBe(false);
    expect(getMockStore().activity_session).toHaveLength(before);
  });

  it("edits a session without changing its facilitator", async () => {
    const session = getMockStore().activity_session.find(
      (row) => row.pillar_id === 3 && row.facilitator_user_id === 9
    )!;
    const result = await updateSessionAction({
      ...base(),
      sessionId: session.id,
      venue: "New venue",
      facilitator: { kind: "staff", id: 9 },
    });
    expect(result.success).toBe(true);
    expect(session).toMatchObject({ venue: "New venue", facilitator_user_id: 9 });
  });

  it("adds, removes and restores an attendee without duplicates", async () => {
    const session = getMockStore().activity_session.find((row) => row.pillar_id === 3)!;
    const participantId = getMockStore().participant.find(
      (person) =>
        !getMockStore().activity_attendance.some(
          (row) => row.session_id === session.id && row.participant_id === person.id
        )
    )!.id;
    expect(
      (await addAttendeeAction({ pillar: "srhr", sessionId: session.id, participantId })).success
    ).toBe(true);
    const duplicate = await addAttendeeAction({
      pillar: "srhr",
      sessionId: session.id,
      participantId,
    });
    expect(duplicate).toMatchObject({ success: false, message: "Already on the attendance list" });
    const row = getMockStore().activity_attendance.find(
      (item) => item.session_id === session.id && item.participant_id === participantId
    )!;
    expect(
      (await removeAttendeeAction({ pillar: "srhr", sessionId: session.id, attendanceId: row.id }))
        .success
    ).toBe(true);
    expect(row).toMatchObject({ is_deleted: true, status: "INACTIVE" });
    expect(
      (await addAttendeeAction({ pillar: "srhr", sessionId: session.id, participantId })).success
    ).toBe(true);
    expect(row).toMatchObject({ is_deleted: false, status: "ACTIVE" });
    expect(
      getMockStore().activity_attendance.filter(
        (item) => item.session_id === session.id && item.participant_id === participantId
      )
    ).toHaveLength(1);
  });

  it("refuses to remove attendance that belongs to another session", async () => {
    const other = getMockStore().activity_attendance[0];
    const session = getMockStore().activity_session.find(
      (row) => row.pillar_id === 3 && row.id !== other.session_id
    )!;
    const result = await removeAttendeeAction({
      pillar: "srhr",
      sessionId: session.id,
      attendanceId: other.id,
    });
    expect(result.success).toBe(false);
  });

  it("lets pillar staff edit the venue of a session whose topic is retired", async () => {
    const store = getMockStore();
    const session = store.activity_session.find(
      (row) => row.activity_topic_id !== null && row.pillar_id === 3
    )!;
    const topic = store.activity_topic.find((row) => row.id === session.activity_topic_id)!;
    Object.assign(topic, { is_deleted: true, status: "INACTIVE" });
    cookieStore.get.mockReturnValue({ value: issueMockToken(9) });
    const result = await updateSessionAction({
      ...base(),
      sessionId: session.id,
      activityTypeId: session.activity_type_id,
      topicId: topic.id,
      venue: "Retired-topic venue",
    });
    expect(result.success).toBe(true);
    expect(session.venue).toBe("Retired-topic venue");
  });

  it("refuses to switch a session to a different retired topic", async () => {
    const store = getMockStore();
    const session = store.activity_session.find(
      (row) => row.activity_topic_id !== null && row.pillar_id === 3
    )!;
    const other = store.activity_topic.find(
      (row) =>
        row.activity_type_id === session.activity_type_id && row.id !== session.activity_topic_id
    )!;
    Object.assign(other, { is_deleted: true, status: "INACTIVE" });
    const result = await updateSessionAction({
      ...base(),
      sessionId: session.id,
      activityTypeId: session.activity_type_id,
      topicId: other.id,
    });
    expect(result).toMatchObject({ success: false, message: "That topic is no longer offered" });
  });

  it("refuses to log a new session on a retired topic", async () => {
    const topic = getMockStore().activity_topic.find((row) => row.name === "Contraception")!;
    Object.assign(topic, { is_deleted: true, status: "INACTIVE" });
    const before = getMockStore().activity_session.length;
    const result = await logSessionAction(base());
    expect(result).toMatchObject({ success: false, message: "That topic is no longer offered" });
    expect(getMockStore().activity_session).toHaveLength(before);
  });

  it("refuses to log a new session on a retired activity type", async () => {
    const type = getMockStore().activity_type_definition.find((row) => row.name === "Health Talk")!;
    Object.assign(type, { is_deleted: true, status: "INACTIVE" });
    const result = await logSessionAction({ ...base(), topicId: null, topic: "x" });
    expect(result).toMatchObject({
      success: false,
      message: "That activity type is no longer offered",
    });
  });

  it("refuses to open a document owned by a different session", async () => {
    const store = getMockStore();
    const [a, b] = store.activity_session.filter((row) => row.pillar_id === 3);
    const attached = await attachSessionFileAction({
      pillar: "srhr",
      sessionId: a.id,
      documentType: "attendance_sheet",
      fileUrl: "mock://sheet.pdf",
    });
    expect(attached.success).toBe(true);
    const doc = store.document.at(-1)!;
    expect(doc.owner_id).toBe(a.id);
    const wrong = await viewSessionFileAction("srhr", b.id, doc.id);
    expect(wrong.success).toBe(false);
    expect(wrong.document).toBeNull();
    expect((await viewSessionFileAction("srhr", a.id, doc.id)).success).toBe(true);
  });
});
